---
id: "go-wal"
courseId: "go-systems"
moduleId: "storage-engines"
title: "Write-Ahead Log"
description: "Ensure your database does not lose data during crashes with a write-ahead log."
order: 4
---

## Scenario

Your storage engine has a critical flaw: the memtable lives in memory. If the process crashes before the memtable is flushed to an SSTable, all those writes are lost. This is not hypothetical -- processes crash from OOM kills, power failures, kernel panics, and deployment restarts.

The solution is a write-ahead log (WAL). Before any write modifies the memtable, it is first appended to a log file on disk. If the process crashes, you replay the log to reconstruct the memtable. This is the same technique used by PostgreSQL, MySQL, SQLite, and every serious database. You will build one from scratch.

## Content

## Write-Ahead Log

### The WAL Concept

The write-ahead log follows one simple rule: **write to the log before writing to the database**. The log is append-only, which makes it fast (sequential writes) and crash-safe (partial writes are detectable). The sequence is:

1. Client sends a write request
2. Append the write to the WAL file on disk
3. Call `fsync` to ensure it is durable
4. Apply the write to the in-memory data structure
5. Acknowledge success to the client

If the process crashes between steps 3 and 4, the WAL contains the write, and recovery replays it.

### Log Entry Format

Each log entry needs enough information to replay the operation:

```go
package wal

import (
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"time"
)

// OpType identifies the type of operation
type OpType byte

const (
	OpPut    OpType = 0x01
	OpDelete OpType = 0x02
)

// LogEntry represents a single operation in the WAL
type LogEntry struct {
	Sequence  uint64
	Timestamp int64
	Op        OpType
	Key       string
	Value     []byte
	CRC       uint32
}

// Encode serializes a log entry to bytes
// Format: [crc:4][seq:8][ts:8][op:1][key_len:4][val_len:4][key][value]
func (e *LogEntry) Encode() []byte {
	keyBytes := []byte(e.Key)
	headerSize := 4 + 8 + 8 + 1 + 4 + 4 // crc + seq + ts + op + key_len + val_len
	totalSize := headerSize + len(keyBytes) + len(e.Value)

	buf := make([]byte, totalSize)

	// Write all fields except CRC first
	offset := 4 // skip CRC slot
	binary.LittleEndian.PutUint64(buf[offset:], e.Sequence)
	offset += 8
	binary.LittleEndian.PutUint64(buf[offset:], uint64(e.Timestamp))
	offset += 8
	buf[offset] = byte(e.Op)
	offset++
	binary.LittleEndian.PutUint32(buf[offset:], uint32(len(keyBytes)))
	offset += 4
	binary.LittleEndian.PutUint32(buf[offset:], uint32(len(e.Value)))
	offset += 4
	copy(buf[offset:], keyBytes)
	offset += len(keyBytes)
	copy(buf[offset:], e.Value)

	// Calculate CRC over everything after the CRC field
	crc := crc32.ChecksumIEEE(buf[4:])
	binary.LittleEndian.PutUint32(buf[0:4], crc)

	return buf
}

// Decode deserializes a log entry from bytes
func Decode(buf []byte) (*LogEntry, error) {
	if len(buf) < 29 { // minimum size
		return nil, fmt.Errorf("buffer too small: %d bytes", len(buf))
	}

	storedCRC := binary.LittleEndian.Uint32(buf[0:4])
	computedCRC := crc32.ChecksumIEEE(buf[4:])
	if storedCRC != computedCRC {
		return nil, fmt.Errorf("CRC mismatch: stored=%d computed=%d", storedCRC, computedCRC)
	}

	offset := 4
	seq := binary.LittleEndian.Uint64(buf[offset:])
	offset += 8
	ts := int64(binary.LittleEndian.Uint64(buf[offset:]))
	offset += 8
	op := OpType(buf[offset])
	offset++
	keyLen := binary.LittleEndian.Uint32(buf[offset:])
	offset += 4
	valLen := binary.LittleEndian.Uint32(buf[offset:])
	offset += 4

	key := string(buf[offset : offset+int(keyLen)])
	offset += int(keyLen)

	var value []byte
	if valLen > 0 {
		value = make([]byte, valLen)
		copy(value, buf[offset:offset+int(valLen)])
	}

	return &LogEntry{
		Sequence:  seq,
		Timestamp: ts,
		Op:        op,
		Key:       key,
		Value:     value,
		CRC:       storedCRC,
	}, nil
}
```

Note the CRC32 checksum. This detects corruption from partial writes -- if the process crashed mid-write, the CRC will not match and we know to discard that entry.

### The WAL Writer

The WAL writer appends entries to a file and calls `fsync` to guarantee durability:

```go
package wal

import (
	"encoding/binary"
	"fmt"
	"os"
	"sync"
	"time"
)

// WAL manages the write-ahead log file
type WAL struct {
	file     *os.File
	path     string
	sequence uint64
	mu       sync.Mutex
}

func Open(path string) (*WAL, error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR|os.O_APPEND, 0644)
	if err != nil {
		return nil, fmt.Errorf("open wal: %w", err)
	}

	return &WAL{
		file: f,
		path: path,
	}, nil
}

// Append writes an entry to the WAL and fsyncs
func (w *WAL) Append(op OpType, key string, value []byte) (uint64, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.sequence++
	entry := &LogEntry{
		Sequence:  w.sequence,
		Timestamp: time.Now().UnixNano(),
		Op:        op,
		Key:       key,
		Value:     value,
	}

	data := entry.Encode()

	// Write entry length prefix so we can read entries back
	lenBuf := make([]byte, 4)
	binary.LittleEndian.PutUint32(lenBuf, uint32(len(data)))

	if _, err := w.file.Write(lenBuf); err != nil {
		return 0, fmt.Errorf("write length: %w", err)
	}
	if _, err := w.file.Write(data); err != nil {
		return 0, fmt.Errorf("write entry: %w", err)
	}

	// fsync ensures the data is on disk, not just in the OS buffer
	if err := w.file.Sync(); err != nil {
		return 0, fmt.Errorf("sync: %w", err)
	}

	return w.sequence, nil
}

func (w *WAL) Close() error {
	return w.file.Close()
}
```

The `fsync` call is critical. Without it, the OS may buffer the write and the data could be lost in a crash even though `Write` returned successfully.

### Crash Recovery by Replaying the Log

On startup, read the WAL and replay all entries to rebuild the memtable:

```go
package wal

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
)

// ReplayFunc is called for each valid entry during recovery
type ReplayFunc func(entry *LogEntry) error

// Replay reads the WAL file and calls fn for each valid entry
func Replay(path string, fn ReplayFunc) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil // no WAL to replay
		}
		return 0, err
	}
	defer f.Close()

	replayed := 0
	for {
		// Read entry length
		lenBuf := make([]byte, 4)
		_, err := io.ReadFull(f, lenBuf)
		if errors.Is(err, io.EOF) {
			break // end of file
		}
		if err != nil {
			// Partial length header -- crash happened here
			fmt.Printf("[wal] partial header at entry %d, stopping replay\n", replayed+1)
			break
		}

		length := binary.LittleEndian.Uint32(lenBuf)
		data := make([]byte, length)
		_, err = io.ReadFull(f, data)
		if err != nil {
			// Partial entry -- crash happened mid-write
			fmt.Printf("[wal] partial entry at entry %d, stopping replay\n", replayed+1)
			break
		}

		entry, err := Decode(data)
		if err != nil {
			// CRC mismatch -- corrupted entry, stop replay
			fmt.Printf("[wal] corrupt entry at %d: %v, stopping replay\n", replayed+1, err)
			break
		}

		if err := fn(entry); err != nil {
			return replayed, fmt.Errorf("replay entry %d: %w", replayed+1, err)
		}
		replayed++
	}

	return replayed, nil
}

// RecoverMemtable rebuilds an in-memory map from the WAL
func RecoverMemtable(walPath string) (map[string][]byte, error) {
	data := make(map[string][]byte)

	replayed, err := Replay(walPath, func(entry *LogEntry) error {
		switch entry.Op {
		case OpPut:
			data[entry.Key] = entry.Value
		case OpDelete:
			delete(data, entry.Key)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	fmt.Printf("[recovery] replayed %d entries, recovered %d keys\n", replayed, len(data))
	return data, nil
}
```

### Checkpointing and Truncation

The WAL grows forever unless you truncate it. After the memtable is successfully flushed to an SSTable, the WAL entries up to that point are no longer needed:

```go
package wal

import (
	"fmt"
	"os"
)

// Checkpoint records the sequence number at which a flush occurred
type Checkpoint struct {
	Sequence uint64
	SSTPath  string
}

// Truncate removes the current WAL and starts a new one
// Called after a successful memtable flush
func (w *WAL) Truncate() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Close current file
	w.file.Close()

	// Remove old WAL
	if err := os.Remove(w.path); err != nil {
		return fmt.Errorf("remove old wal: %w", err)
	}

	// Create new WAL
	f, err := os.OpenFile(w.path, os.O_CREATE|os.O_RDWR|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("create new wal: %w", err)
	}
	w.file = f

	fmt.Printf("[wal] truncated at sequence %d\n", w.sequence)
	return nil
}

// RotateWAL renames the old WAL and creates a new one
// Safer than truncation -- keeps the old file until the flush completes
func (w *WAL) RotateWAL() (string, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.file.Close()

	oldPath := fmt.Sprintf("%s.%d", w.path, w.sequence)
	if err := os.Rename(w.path, oldPath); err != nil {
		return "", fmt.Errorf("rename wal: %w", err)
	}

	f, err := os.OpenFile(w.path, os.O_CREATE|os.O_RDWR|os.O_APPEND, 0644)
	if err != nil {
		return "", fmt.Errorf("create new wal: %w", err)
	}
	w.file = f

	return oldPath, nil
}
```

## Why It Matters

The write-ahead log is the single most important durability mechanism in database engineering. PostgreSQL calls theirs the WAL. MySQL calls theirs the redo log. SQLite calls theirs the journal. Every database that promises durability uses some form of write-ahead logging. Understanding how WALs work -- append-only writes, CRC validation, replay-based recovery, and checkpoint-based truncation -- gives you deep insight into how databases keep your data safe even when hardware fails.

## Questions

Q: Why must the WAL entry be written to disk (via fsync) BEFORE modifying the in-memory data structure?
A) The operating system requires this ordering for file operations
B) If the process crashes after the in-memory write but before the disk write, the data is lost with no way to recover
C) Fsync is faster when called before memory operations
D) The in-memory data structure needs the WAL sequence number before it can accept writes
Correct: B

Q: What is the purpose of the CRC32 checksum in each WAL entry?
A) To compress the entry for smaller file sizes
B) To encrypt the entry contents
C) To detect corrupt or partially written entries during crash recovery
D) To speed up sequential reads of the WAL file
Correct: C

Q: Why is `Truncate` only safe to call after a successful SSTable flush?
A) The operating system locks the file during flush operations
B) Truncation removes WAL entries, so they must already be persisted in an SSTable to avoid data loss
C) The SSTable file format requires the WAL to be empty
D) Truncation would corrupt the SSTable otherwise
Correct: B

## Challenge

Build a simple write-ahead log that appends entries to a file and replays them on startup. Write 3 entries, close the WAL, then replay and print each recovered entry.

## Starter Code

```go
package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

type Entry struct {
	Key   string
	Value string
}

func appendToWAL(f *os.File, key, value string) error {
	// TODO: Write key_len + val_len + key + value
	return nil
}

func replayWAL(path string) ([]Entry, error) {
	// TODO: Read entries until EOF
	return nil, nil
}

func main() {
	// TODO: Write 3 entries, close, replay, print
}
```

## Expected Output

```
Writing to WAL...
Wrote: name = Alice
Wrote: city = Berlin
Wrote: lang = Go
Replaying WAL...
Recovered: name = Alice
Recovered: city = Berlin
Recovered: lang = Go
```

## Hint

Use `binary.LittleEndian.PutUint32` for lengths. For replay, read in a loop until `io.ReadFull` returns `io.EOF`. Remember to close the file before replaying it.

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

type Entry struct {
	Key   string
	Value string
}

func appendToWAL(f *os.File, key, value string) error {
	header := make([]byte, 8)
	binary.LittleEndian.PutUint32(header[0:4], uint32(len(key)))
	binary.LittleEndian.PutUint32(header[4:8], uint32(len(value)))
	f.Write(header)
	f.Write([]byte(key))
	f.Write([]byte(value))
	return f.Sync()
}

func replayWAL(path string) ([]Entry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var entries []Entry
	for {
		header := make([]byte, 8)
		_, err := io.ReadFull(f, header)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return entries, err
		}

		keyLen := binary.LittleEndian.Uint32(header[0:4])
		valLen := binary.LittleEndian.Uint32(header[4:8])

		keyBuf := make([]byte, keyLen)
		io.ReadFull(f, keyBuf)
		valBuf := make([]byte, valLen)
		io.ReadFull(f, valBuf)

		entries = append(entries, Entry{Key: string(keyBuf), Value: string(valBuf)})
	}
	return entries, nil
}

func main() {
	walPath := "/tmp/test.wal"
	defer os.Remove(walPath)

	fmt.Println("Writing to WAL...")
	f, err := os.Create(walPath)
	if err != nil {
		panic(err)
	}

	data := []Entry{
		{"name", "Alice"},
		{"city", "Berlin"},
		{"lang", "Go"},
	}
	for _, e := range data {
		appendToWAL(f, e.Key, e.Value)
		fmt.Printf("Wrote: %s = %s\n", e.Key, e.Value)
	}
	f.Close()

	fmt.Println("Replaying WAL...")
	entries, err := replayWAL(walPath)
	if err != nil {
		panic(err)
	}
	for _, e := range entries {
		fmt.Printf("Recovered: %s = %s\n", e.Key, e.Value)
	}
}
```
