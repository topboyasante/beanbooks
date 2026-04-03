---
id: "go-kv-store"
courseId: "go-systems"
moduleId: "storage-engines"
title: "Key-Value Store"
description: "Build the simplest possible database -- a persistent key-value store."
order: 1
---

## Scenario

Every database, no matter how complex, starts as a key-value store at its core. Redis, DynamoDB, etcd -- they all map keys to values with get, set, and delete operations. The difference between an in-memory map and a real database is persistence: when the process restarts, the data should still be there.

You will build a persistent key-value store from scratch. It starts as a Go map, then you will add serialization to a simple file format so data survives restarts. By the end, you will understand the fundamental tradeoffs that drive every storage engine design decision.

## Content

## Key-Value Store

### In-Memory Map-Based Store

Start with the simplest possible implementation -- a thread-safe wrapper around Go's built-in map:

```go
package kvstore

import (
	"fmt"
	"sync"
)

// KVStore is a thread-safe in-memory key-value store
type KVStore struct {
	data map[string][]byte
	mu   sync.RWMutex
}

func New() *KVStore {
	return &KVStore{
		data: make(map[string][]byte),
	}
}

func (kv *KVStore) Get(key string) ([]byte, bool) {
	kv.mu.RLock()
	defer kv.mu.RUnlock()
	val, ok := kv.data[key]
	return val, ok
}

func (kv *KVStore) Set(key string, value []byte) {
	kv.mu.Lock()
	defer kv.mu.Unlock()
	kv.data[key] = value
}

func (kv *KVStore) Delete(key string) bool {
	kv.mu.Lock()
	defer kv.mu.Unlock()
	_, existed := kv.data[key]
	delete(kv.data, key)
	return existed
}

func (kv *KVStore) Keys() []string {
	kv.mu.RLock()
	defer kv.mu.RUnlock()
	keys := make([]string, 0, len(kv.data))
	for k := range kv.data {
		keys = append(keys, k)
	}
	return keys
}

func (kv *KVStore) Len() int {
	kv.mu.RLock()
	defer kv.mu.RUnlock()
	return len(kv.data)
}
```

The `sync.RWMutex` allows multiple concurrent readers but exclusive write access. This is critical for a database -- reads are far more common than writes, and a regular `sync.Mutex` would serialize all operations.

### File Format Design

To persist data, you need a file format. A simple approach is a binary format where each record is:

```
[key_len: 4 bytes][value_len: 4 bytes][key: key_len bytes][value: value_len bytes]
```

A special sentinel value for `value_len` indicates a deletion (tombstone):

```go
package kvstore

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

const tombstoneMarker = ^uint32(0) // 0xFFFFFFFF indicates deleted

// record represents a single key-value pair on disk
type record struct {
	key     string
	value   []byte
	deleted bool
}

// writeRecord writes a single record to a writer
func writeRecord(w io.Writer, key string, value []byte, deleted bool) error {
	keyBytes := []byte(key)
	header := make([]byte, 8)

	binary.LittleEndian.PutUint32(header[0:4], uint32(len(keyBytes)))

	if deleted {
		binary.LittleEndian.PutUint32(header[4:8], tombstoneMarker)
	} else {
		binary.LittleEndian.PutUint32(header[4:8], uint32(len(value)))
	}

	if _, err := w.Write(header); err != nil {
		return fmt.Errorf("write header: %w", err)
	}
	if _, err := w.Write(keyBytes); err != nil {
		return fmt.Errorf("write key: %w", err)
	}
	if !deleted {
		if _, err := w.Write(value); err != nil {
			return fmt.Errorf("write value: %w", err)
		}
	}
	return nil
}

// readRecord reads a single record from a reader
func readRecord(r io.Reader) (record, error) {
	header := make([]byte, 8)
	if _, err := io.ReadFull(r, header); err != nil {
		return record{}, err
	}

	keyLen := binary.LittleEndian.Uint32(header[0:4])
	valueLen := binary.LittleEndian.Uint32(header[4:8])

	keyBytes := make([]byte, keyLen)
	if _, err := io.ReadFull(r, keyBytes); err != nil {
		return record{}, fmt.Errorf("read key: %w", err)
	}

	rec := record{key: string(keyBytes)}

	if valueLen == tombstoneMarker {
		rec.deleted = true
	} else {
		rec.value = make([]byte, valueLen)
		if _, err := io.ReadFull(r, rec.value); err != nil {
			return record{}, fmt.Errorf("read value: %w", err)
		}
	}

	return rec, nil
}
```

### Saving to Disk

Write the entire store to a file. This is a snapshot approach -- you write all current key-value pairs at once:

```go
package kvstore

import (
	"fmt"
	"os"
)

// SaveTo writes all key-value pairs to a file
func (kv *KVStore) SaveTo(path string) error {
	kv.mu.RLock()
	defer kv.mu.RUnlock()

	// Write to a temp file first, then rename for atomicity
	tmpPath := path + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}

	for key, value := range kv.data {
		if err := writeRecord(f, key, value, false); err != nil {
			f.Close()
			os.Remove(tmpPath)
			return fmt.Errorf("write record: %w", err)
		}
	}

	// Flush to disk before renaming
	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("sync: %w", err)
	}
	f.Close()

	// Atomic rename
	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("rename: %w", err)
	}

	fmt.Printf("Saved %d records to %s\n", len(kv.data), path)
	return nil
}
```

The write-to-temp-then-rename pattern is critical. If the process crashes mid-write, you either have the old complete file or the new complete file -- never a half-written corrupt file.

### Loading from Disk on Startup

Read the file back into memory when the store starts:

```go
package kvstore

import (
	"errors"
	"fmt"
	"io"
	"os"
)

// LoadFrom reads key-value pairs from a file into the store
func (kv *KVStore) LoadFrom(path string) error {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Println("No existing data file, starting fresh")
			return nil
		}
		return fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	count := 0
	for {
		rec, err := readRecord(f)
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return fmt.Errorf("read record: %w", err)
		}

		if rec.deleted {
			delete(kv.data, rec.key)
		} else {
			kv.data[rec.key] = rec.value
		}
		count++
	}

	fmt.Printf("Loaded %d records from %s (%d keys active)\n", count, path, len(kv.data))
	return nil
}
```

### Putting It All Together

A complete persistent KV store with a simple API:

```go
package kvstore

import "fmt"

// PersistentKV wraps KVStore with automatic persistence
type PersistentKV struct {
	*KVStore
	path string
}

func NewPersistent(path string) (*PersistentKV, error) {
	store := &PersistentKV{
		KVStore: New(),
		path:    path,
	}

	if err := store.LoadFrom(path); err != nil {
		return nil, fmt.Errorf("load: %w", err)
	}

	return store, nil
}

func (p *PersistentKV) Set(key string, value []byte) error {
	p.KVStore.Set(key, value)
	return p.SaveTo(p.path)
}

func (p *PersistentKV) Delete(key string) error {
	p.KVStore.Delete(key)
	return p.SaveTo(p.path)
}
```

Notice the tradeoff: saving after every write is safe but slow. A real database batches writes or uses a write-ahead log (covered later in this module) to balance durability and performance.

## Why It Matters

Every database you will ever use -- PostgreSQL, MySQL, MongoDB, Redis -- is built on these primitives. Understanding how key-value pairs are stored, serialized, and persisted gives you insight into why databases make the tradeoffs they do. The patterns here -- atomic file writes, thread-safe access, binary serialization -- are the building blocks of every storage engine.

## Questions

Q: Why does `SaveTo` write to a temporary file and then rename it?
A) Renaming is faster than writing directly to the target file
B) It provides atomicity -- a crash during the write leaves the old file intact instead of a corrupt one
C) The operating system requires a rename to update file permissions
D) Temporary files use less disk space
Correct: B

Q: Why does the KVStore use `sync.RWMutex` instead of `sync.Mutex`?
A) RWMutex is faster for all operations
B) RWMutex allows multiple concurrent readers while still providing exclusive write access
C) Regular Mutex does not work with maps in Go
D) RWMutex prevents deadlocks automatically
Correct: B

Q: What is the purpose of the tombstone marker in the file format?
A) To compress deleted records for smaller file sizes
B) To indicate a key has been deleted so loading replays the deletion correctly
C) To mark records that have been corrupted
D) To reserve space for future values
Correct: B

## Challenge

Build an in-memory key-value store that saves to and loads from a file. Set three keys, save to disk, create a new store, load from the file, and verify all keys are present.

## Starter Code

```go
package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

type KVStore struct {
	data map[string]string
}

func NewKVStore() *KVStore {
	return &KVStore{data: make(map[string]string)}
}

func (kv *KVStore) Set(key, value string) {
	kv.data[key] = value
}

func (kv *KVStore) Get(key string) (string, bool) {
	v, ok := kv.data[key]
	return v, ok
}

func (kv *KVStore) SaveTo(path string) error {
	// TODO: Write each key-value pair with length-prefixed encoding
	return nil
}

func (kv *KVStore) LoadFrom(path string) error {
	// TODO: Read records until EOF
	return nil
}

func main() {
	// TODO: Set 3 keys, save, load into new store, verify
}
```

## Expected Output

```
Saved 3 records
Loaded 3 records
user:1 = Alice
user:2 = Bob
user:3 = Charlie
```

## Hint

For each record, write `uint32(len(key))` + `uint32(len(value))` + key bytes + value bytes. When reading, use `io.ReadFull` to read exact byte counts, and break when you hit `io.EOF`.

## Solution

```go
package main

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
)

type KVStore struct {
	data map[string]string
}

func NewKVStore() *KVStore {
	return &KVStore{data: make(map[string]string)}
}

func (kv *KVStore) Set(key, value string) {
	kv.data[key] = value
}

func (kv *KVStore) Get(key string) (string, bool) {
	v, ok := kv.data[key]
	return v, ok
}

func (kv *KVStore) SaveTo(path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	for key, value := range kv.data {
		header := make([]byte, 8)
		binary.LittleEndian.PutUint32(header[0:4], uint32(len(key)))
		binary.LittleEndian.PutUint32(header[4:8], uint32(len(value)))
		f.Write(header)
		f.Write([]byte(key))
		f.Write([]byte(value))
	}
	fmt.Printf("Saved %d records\n", len(kv.data))
	return nil
}

func (kv *KVStore) LoadFrom(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	count := 0
	for {
		header := make([]byte, 8)
		_, err := io.ReadFull(f, header)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}

		keyLen := binary.LittleEndian.Uint32(header[0:4])
		valLen := binary.LittleEndian.Uint32(header[4:8])

		keyBuf := make([]byte, keyLen)
		io.ReadFull(f, keyBuf)

		valBuf := make([]byte, valLen)
		io.ReadFull(f, valBuf)

		kv.data[string(keyBuf)] = string(valBuf)
		count++
	}
	fmt.Printf("Loaded %d records\n", count)
	return nil
}

func main() {
	store := NewKVStore()
	store.Set("user:1", "Alice")
	store.Set("user:2", "Bob")
	store.Set("user:3", "Charlie")
	store.SaveTo("/tmp/kvstore.dat")

	store2 := NewKVStore()
	store2.LoadFrom("/tmp/kvstore.dat")

	for _, key := range []string{"user:1", "user:2", "user:3"} {
		val, _ := store2.Get(key)
		fmt.Printf("%s = %s\n", key, val)
	}

	os.Remove("/tmp/kvstore.dat")
}
```
