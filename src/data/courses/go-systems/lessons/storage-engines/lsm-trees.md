---
id: "go-lsm-trees"
courseId: "go-systems"
moduleId: "storage-engines"
title: "LSM Trees"
description: "Build a write-heavy storage engine using the Log-Structured Merge tree architecture."
order: 3
---

## Scenario

Your B-tree storage engine handles reads well, but every write requires finding the right page on disk and updating it in place. For write-heavy workloads -- event logging, time-series data, messaging systems -- this becomes a bottleneck. Random disk writes are slow.

LSM trees flip the design: all writes go to an in-memory buffer (the memtable), and when it fills up, it is flushed to disk as an immutable sorted file (an SSTable). Reads check the memtable first, then search through SSTables. This is the architecture behind RocksDB, LevelDB, Cassandra, and ScyllaDB. You will build a simplified version to understand why write-optimized storage engines dominate modern infrastructure.

## Content

## LSM Trees

### The LSM Architecture Overview

An LSM tree consists of two layers:

1. **Memtable** -- an in-memory sorted data structure (typically a red-black tree or skip list) that absorbs all writes
2. **SSTables** -- immutable sorted files on disk, created when the memtable fills up

```go
package lsm

import (
	"fmt"
	"sort"
	"sync"
)

// LSMTree implements a basic Log-Structured Merge tree
type LSMTree struct {
	memtable     *Memtable
	sstables     []*SSTable // ordered newest to oldest
	mu           sync.RWMutex
	maxMemSize   int
	dataDir      string
	ssTableCount int
}

func New(dataDir string, maxMemSize int) *LSMTree {
	return &LSMTree{
		memtable:   NewMemtable(),
		maxMemSize: maxMemSize,
		dataDir:    dataDir,
	}
}
```

### The Memtable

The memtable is a sorted in-memory buffer. Using a sorted slice makes it simple to flush as a sorted file:

```go
package lsm

import "sort"

// Entry represents a single key-value pair with a tombstone flag
type Entry struct {
	Key       string
	Value     []byte
	Deleted   bool
	Timestamp int64
}

// Memtable is an in-memory sorted collection of entries
type Memtable struct {
	entries map[string]*Entry
	size    int
}

func NewMemtable() *Memtable {
	return &Memtable{
		entries: make(map[string]*Entry),
	}
}

func (m *Memtable) Put(key string, value []byte, ts int64) {
	old, exists := m.entries[key]
	if exists {
		m.size -= len(old.Key) + len(old.Value)
	}

	entry := &Entry{
		Key:       key,
		Value:     value,
		Deleted:   false,
		Timestamp: ts,
	}
	m.entries[key] = entry
	m.size += len(key) + len(value)
}

func (m *Memtable) Get(key string) (*Entry, bool) {
	e, ok := m.entries[key]
	return e, ok
}

func (m *Memtable) Delete(key string, ts int64) {
	m.entries[key] = &Entry{
		Key:       key,
		Deleted:   true,
		Timestamp: ts,
	}
}

// SortedEntries returns all entries sorted by key
func (m *Memtable) SortedEntries() []*Entry {
	entries := make([]*Entry, 0, len(m.entries))
	for _, e := range m.entries {
		entries = append(entries, e)
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Key < entries[j].Key
	})
	return entries
}

func (m *Memtable) Size() int {
	return m.size
}

func (m *Memtable) Len() int {
	return len(m.entries)
}
```

### SSTable: Sorted String Table

When the memtable is full, it is flushed to disk as an SSTable. Each SSTable is an immutable sorted file:

```go
package lsm

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"sort"
)

// SSTable represents a sorted, immutable file of key-value pairs
type SSTable struct {
	Path    string
	Index   []IndexEntry // sparse index for fast lookups
	MinKey  string
	MaxKey  string
	Entries int
}

// IndexEntry maps a key to its byte offset in the SSTable file
type IndexEntry struct {
	Key    string
	Offset int64
}

// FlushMemtable writes the memtable to disk as a new SSTable
func FlushMemtable(mem *Memtable, path string) (*SSTable, error) {
	entries := mem.SortedEntries()
	if len(entries) == 0 {
		return nil, fmt.Errorf("empty memtable")
	}

	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	sst := &SSTable{
		Path:    path,
		MinKey:  entries[0].Key,
		MaxKey:  entries[len(entries)-1].Key,
		Entries: len(entries),
	}

	offset := int64(0)
	for i, entry := range entries {
		// Build sparse index (every 16th entry)
		if i%16 == 0 {
			sst.Index = append(sst.Index, IndexEntry{
				Key:    entry.Key,
				Offset: offset,
			})
		}

		// Write: [key_len:4][val_len:4][deleted:1][key][value]
		keyBytes := []byte(entry.Key)
		header := make([]byte, 9)
		binary.LittleEndian.PutUint32(header[0:4], uint32(len(keyBytes)))

		if entry.Deleted {
			binary.LittleEndian.PutUint32(header[4:8], 0)
			header[8] = 1
		} else {
			binary.LittleEndian.PutUint32(header[4:8], uint32(len(entry.Value)))
			header[8] = 0
		}

		n, _ := f.Write(header)
		offset += int64(n)
		n, _ = f.Write(keyBytes)
		offset += int64(n)
		if !entry.Deleted {
			n, _ = f.Write(entry.Value)
			offset += int64(n)
		}
	}

	return sst, nil
}

// SearchSSTable looks up a key in an SSTable using the sparse index
func SearchSSTable(sst *SSTable, key string) (*Entry, error) {
	if key < sst.MinKey || key > sst.MaxKey {
		return nil, nil // key out of range
	}

	// Binary search the sparse index to find the starting offset
	startOffset := int64(0)
	idx := sort.Search(len(sst.Index), func(i int) bool {
		return sst.Index[i].Key > key
	})
	if idx > 0 {
		startOffset = sst.Index[idx-1].Offset
	}

	// Scan from that offset
	f, err := os.Open(sst.Path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	f.Seek(startOffset, io.SeekStart)

	for {
		header := make([]byte, 9)
		_, err := io.ReadFull(f, header)
		if err == io.EOF {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}

		keyLen := binary.LittleEndian.Uint32(header[0:4])
		valLen := binary.LittleEndian.Uint32(header[4:8])
		deleted := header[8] == 1

		keyBuf := make([]byte, keyLen)
		io.ReadFull(f, keyBuf)
		foundKey := string(keyBuf)

		var value []byte
		if !deleted && valLen > 0 {
			value = make([]byte, valLen)
			io.ReadFull(f, value)
		}

		if foundKey == key {
			return &Entry{Key: foundKey, Value: value, Deleted: deleted}, nil
		}
		if foundKey > key {
			return nil, nil // passed it, key does not exist
		}
	}
}
```

### Bloom Filters

Reading every SSTable for a missing key is wasteful. Bloom filters provide a fast probabilistic check -- "this key is definitely not here" or "this key might be here":

```go
package lsm

import "hash/fnv"

// BloomFilter is a probabilistic set membership test
type BloomFilter struct {
	bits    []bool
	numHash int
	size    int
}

func NewBloomFilter(expectedItems int, falsePositiveRate float64) *BloomFilter {
	// Optimal size: -(n * ln(p)) / (ln(2)^2)
	// Simplified: 10 bits per item gives ~1% false positive rate
	size := expectedItems * 10
	if size < 64 {
		size = 64
	}
	return &BloomFilter{
		bits:    make([]bool, size),
		numHash: 3,
		size:    size,
	}
}

func (bf *BloomFilter) hash(key string, seed int) int {
	h := fnv.New64a()
	h.Write([]byte(key))
	h.Write([]byte{byte(seed)})
	return int(h.Sum64() % uint64(bf.size))
}

func (bf *BloomFilter) Add(key string) {
	for i := 0; i < bf.numHash; i++ {
		bf.bits[bf.hash(key, i)] = true
	}
}

// MayContain returns false if the key is definitely not in the set.
// Returns true if the key MIGHT be in the set (possible false positive).
func (bf *BloomFilter) MayContain(key string) bool {
	for i := 0; i < bf.numHash; i++ {
		if !bf.bits[bf.hash(key, i)] {
			return false
		}
	}
	return true
}
```

### LSM Read and Write Paths

Putting it all together -- writes go to the memtable, reads check memtable first then SSTables from newest to oldest:

```go
package lsm

import (
	"fmt"
	"time"
)

// Put writes a key-value pair to the LSM tree
func (l *LSMTree) Put(key string, value []byte) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.memtable.Put(key, value, time.Now().UnixNano())

	// Flush if memtable exceeds size threshold
	if l.memtable.Size() >= l.maxMemSize {
		if err := l.flushMemtable(); err != nil {
			return fmt.Errorf("flush: %w", err)
		}
	}
	return nil
}

// Get reads a key, checking memtable first then SSTables
func (l *LSMTree) Get(key string) ([]byte, bool, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	// Check memtable first (most recent data)
	if entry, ok := l.memtable.Get(key); ok {
		if entry.Deleted {
			return nil, false, nil
		}
		return entry.Value, true, nil
	}

	// Search SSTables from newest to oldest
	for _, sst := range l.sstables {
		entry, err := SearchSSTable(sst, key)
		if err != nil {
			return nil, false, err
		}
		if entry != nil {
			if entry.Deleted {
				return nil, false, nil
			}
			return entry.Value, true, nil
		}
	}

	return nil, false, nil
}

// Delete marks a key as deleted (tombstone)
func (l *LSMTree) Delete(key string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.memtable.Delete(key, time.Now().UnixNano())
	return nil
}

func (l *LSMTree) flushMemtable() error {
	path := fmt.Sprintf("%s/sstable_%04d.dat", l.dataDir, l.ssTableCount)
	sst, err := FlushMemtable(l.memtable, path)
	if err != nil {
		return err
	}

	// Prepend (newest first)
	l.sstables = append([]*SSTable{sst}, l.sstables...)
	l.ssTableCount++

	// Reset memtable
	l.memtable = NewMemtable()
	fmt.Printf("Flushed memtable to %s (%d entries)\n", path, sst.Entries)
	return nil
}
```

## Why It Matters

LSM trees power the storage engines behind some of the most demanding systems in the world. RocksDB (used by Facebook, Uber, Netflix), LevelDB (used by Chrome), Apache Cassandra, and CockroachDB all use LSM-based designs. The write-optimized nature of LSM trees makes them ideal for append-heavy workloads. Understanding the memtable-to-SSTable pipeline, bloom filters for read optimization, and the tradeoff between write amplification and read amplification is essential knowledge for anyone building or tuning high-performance storage systems.

## Questions

Q: Why are all writes in an LSM tree directed to the memtable instead of directly to disk?
A) The memtable compresses data better than disk files
B) Writing sequentially to memory and periodically flushing sorted data to disk converts random writes into sequential writes
C) The memtable provides encryption that disk does not support
D) Writing to disk requires administrator privileges
Correct: B

Q: What does a bloom filter guarantee when it returns `false` for a key?
A) The key exists in the SSTable but was deleted
B) The key might exist in the SSTable
C) The key definitely does not exist in the SSTable
D) The SSTable is corrupted
Correct: C

Q: Why are SSTables searched from newest to oldest?
A) Newer SSTables are smaller and faster to search
B) The newest SSTable contains the most recent version of a key, including tombstones for deletions
C) Older SSTables have been compacted and contain no valid data
D) The operating system caches newer files more efficiently
Correct: B

## Challenge

Build a simple memtable that accepts writes, marks deletions with tombstones, and flushes sorted entries. Insert 5 keys, delete 1, and print the sorted output showing which entries are live and which are tombstones.

## Starter Code

```go
package main

import (
	"fmt"
	"sort"
)

type Entry struct {
	Key     string
	Value   string
	Deleted bool
}

type Memtable struct {
	entries map[string]*Entry
}

func NewMemtable() *Memtable {
	return &Memtable{entries: make(map[string]*Entry)}
}

func (m *Memtable) Put(key, value string) {
	// TODO: add or update entry
}

func (m *Memtable) Delete(key string) {
	// TODO: mark entry as tombstone
}

func (m *Memtable) Flush() []*Entry {
	// TODO: return sorted entries
	return nil
}

func main() {
	// TODO: Put 5 keys, delete 1, flush and print
}
```

## Expected Output

```
Flushing memtable:
  key=apple value=red deleted=false
  key=banana value= deleted=true
  key=cherry value=dark-red deleted=false
  key=date value=brown deleted=false
  key=elderberry value=purple deleted=false
```

## Hint

Use a map for O(1) lookups in the memtable. For `Delete`, set the entry's `Deleted` flag to `true` and clear the value. For `Flush`, collect all entries into a slice and sort by key.

## Solution

```go
package main

import (
	"fmt"
	"sort"
)

type Entry struct {
	Key     string
	Value   string
	Deleted bool
}

type Memtable struct {
	entries map[string]*Entry
}

func NewMemtable() *Memtable {
	return &Memtable{entries: make(map[string]*Entry)}
}

func (m *Memtable) Put(key, value string) {
	m.entries[key] = &Entry{Key: key, Value: value, Deleted: false}
}

func (m *Memtable) Delete(key string) {
	m.entries[key] = &Entry{Key: key, Value: "", Deleted: true}
}

func (m *Memtable) Flush() []*Entry {
	result := make([]*Entry, 0, len(m.entries))
	for _, e := range m.entries {
		result = append(result, e)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Key < result[j].Key
	})
	return result
}

func main() {
	mem := NewMemtable()
	mem.Put("apple", "red")
	mem.Put("banana", "yellow")
	mem.Put("cherry", "dark-red")
	mem.Put("date", "brown")
	mem.Put("elderberry", "purple")

	mem.Delete("banana")

	fmt.Println("Flushing memtable:")
	for _, e := range mem.Flush() {
		fmt.Printf("  key=%s value=%s deleted=%v\n", e.Key, e.Value, e.Deleted)
	}
}
```
