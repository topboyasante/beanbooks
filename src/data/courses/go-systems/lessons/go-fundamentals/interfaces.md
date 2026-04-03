---
id: "go-interfaces"
courseId: "go-systems"
moduleId: "go-fundamentals"
title: "Interfaces"
description: "Build pluggable systems with Go interfaces — swap storage backends without changing a line of business logic."
order: 4
---

## Scenario

Your tunnel project needs a key-value store to track connection metadata, rate limits, and routing rules. During development, an in-memory map is fine. In production, you want file-based persistence so state survives restarts. You don't want to rewrite your tunnel logic every time you swap storage backends.

This is the exact problem interfaces solve. Define what operations your store must support, and any type that implements those operations can be plugged in — no inheritance hierarchy, no registration step, no ceremony.

## Content

## Interfaces

An interface in Go is a set of method signatures. Any type that implements all those methods satisfies the interface automatically — there's no `implements` keyword. This is called implicit satisfaction, and it's one of Go's most powerful features.

### Defining and Implementing Interfaces

```go
type Store interface {
    Get(key string) ([]byte, error)
    Set(key string, value []byte) error
    Delete(key string) error
}
```

Any type with these three methods satisfies `Store`. Here's an in-memory implementation:

```go
type MemoryStore struct {
    data map[string][]byte
}

func NewMemoryStore() *MemoryStore {
    return &MemoryStore{data: make(map[string][]byte)}
}

func (m *MemoryStore) Get(key string) ([]byte, error) {
    val, ok := m.data[key]
    if !ok {
        return nil, fmt.Errorf("key not found: %s", key)
    }
    return val, nil
}

func (m *MemoryStore) Set(key string, value []byte) error {
    m.data[key] = value
    return nil
}

func (m *MemoryStore) Delete(key string) error {
    delete(m.data, key)
    return nil
}
```

And a file-based implementation:

```go
type FileStore struct {
    dir string
}

func NewFileStore(dir string) *FileStore {
    os.MkdirAll(dir, 0755)
    return &FileStore{dir: dir}
}

func (f *FileStore) Get(key string) ([]byte, error) {
    return os.ReadFile(filepath.Join(f.dir, key))
}

func (f *FileStore) Set(key string, value []byte) error {
    return os.WriteFile(filepath.Join(f.dir, key), value, 0644)
}

func (f *FileStore) Delete(key string) error {
    return os.Remove(filepath.Join(f.dir, key))
}
```

Both `*MemoryStore` and `*FileStore` satisfy `Store` without declaring it anywhere. Your tunnel code accepts a `Store` and doesn't care which one it gets:

```go
func RecordConnection(store Store, connID string, data []byte) error {
    return store.Set(connID, data)
}
```

### Common Standard Library Interfaces

Go's standard library is built on small, focused interfaces. Knowing them is essential:

```go
// io.Reader — anything you can read bytes from
type Reader interface {
    Read(p []byte) (n int, err error)
}

// io.Writer — anything you can write bytes to
type Writer interface {
    Write(p []byte) (n int, err error)
}

// io.Closer — anything you can close
type Closer interface {
    Close() error
}

// error — the most common interface in Go
type error interface {
    Error() string
}

// fmt.Stringer — custom string representation
type Stringer interface {
    String() string
}
```

Files, network connections, HTTP bodies, buffers, compressors — they all implement `io.Reader` and `io.Writer`. This means you can write a function that works with any of them:

```go
func copyStream(dst io.Writer, src io.Reader) (int64, error) {
    buf := make([]byte, 32*1024) // 32KB buffer
    var total int64
    for {
        n, readErr := src.Read(buf)
        if n > 0 {
            written, writeErr := dst.Write(buf[:n])
            total += int64(written)
            if writeErr != nil {
                return total, writeErr
            }
        }
        if readErr == io.EOF {
            return total, nil
        }
        if readErr != nil {
            return total, readErr
        }
    }
}
```

### Interface Composition

Interfaces can embed other interfaces to build larger contracts:

```go
type ReadWriter interface {
    io.Reader
    io.Writer
}

type ReadWriteCloser interface {
    io.Reader
    io.Writer
    io.Closer
}
```

This is how the standard library builds up `io.ReadWriter`, `io.ReadCloser`, `io.ReadWriteCloser`, etc. Keep your own interfaces small and compose them:

```go
type Store interface {
    Get(key string) ([]byte, error)
    Set(key string, value []byte) error
    Delete(key string) error
}

type WatchableStore interface {
    Store
    Watch(key string) <-chan []byte
}
```

### Type Assertions and Type Switches

Sometimes you need to extract the concrete type from an interface value:

```go
// Type assertion — panics if wrong type
memStore := store.(*MemoryStore)

// Safe type assertion — returns ok=false instead of panicking
memStore, ok := store.(*MemoryStore)
if ok {
    fmt.Println("Using memory store with", len(memStore.data), "entries")
}
```

Type switches let you handle multiple concrete types:

```go
func describeStore(s Store) string {
    switch v := s.(type) {
    case *MemoryStore:
        return fmt.Sprintf("in-memory store with %d keys", len(v.data))
    case *FileStore:
        return fmt.Sprintf("file store at %s", v.dir)
    default:
        return "unknown store type"
    }
}
```

### The Empty Interface and `any`

The empty interface `interface{}` (aliased as `any` since Go 1.18) is satisfied by every type:

```go
func logValue(key string, value any) {
    fmt.Printf("[LOG] %s = %v\n", key, value)
}

logValue("port", 8080)
logValue("host", "localhost")
logValue("active", true)
```

Use `any` sparingly — it throws away type safety. Prefer specific interfaces that describe the behavior you need.

## Why It Matters

Interfaces are what make Go programs testable, extensible, and loosely coupled. When your tunnel accepts a `Store` interface instead of a concrete `*MemoryStore`, you can swap in a Redis-backed store for production or a mock store for testing without touching any tunnel logic. The `io.Reader`/`io.Writer` pattern means the same function can process data from a file, a TCP connection, or an in-memory buffer. Small interfaces encourage small, composable components — the building blocks of reliable systems.

## Questions

Q: How does a type satisfy an interface in Go?
A) By using the `implements` keyword
B) By registering with the interface at runtime
C) By implementing all the methods defined in the interface
D) By extending the interface type
Correct: C

Q: What does a type switch `s.(type)` do?
A) Converts the interface to a specific type
B) Checks which concrete type is stored in the interface value
C) Creates a new interface from an existing type
D) Validates that the type implements the interface
Correct: B

Q: Why are small interfaces preferred in Go?
A) The compiler optimizes them better
B) They use less memory at runtime
C) They are easier to satisfy, making code more composable and testable
D) Go doesn't support interfaces with more than 3 methods
Correct: C

## Challenge

Define a `Logger` interface with a `Log(message string)` method. Implement two types: `ConsoleLogger` (prints to stdout) and `FileLogger` (appends to a slice of strings). Write a function `runDiagnostics` that accepts a `Logger` and logs three connection events.

## Starter Code

```go
package main

import "fmt"

// Define the Logger interface

// Implement ConsoleLogger

// Implement FileLogger (stores messages in a slice)

func runDiagnostics(logger Logger) {
    logger.Log("connection opened to 10.0.0.1:8080")
    logger.Log("transferred 2048 bytes")
    logger.Log("connection closed")
}

func main() {
    fmt.Println("=== Console Logger ===")
    consoleLog := &ConsoleLogger{}
    runDiagnostics(consoleLog)

    fmt.Println("\n=== File Logger ===")
    fileLog := &FileLogger{}
    runDiagnostics(fileLog)
    for i, msg := range fileLog.Messages {
        fmt.Printf("  [%d] %s\n", i, msg)
    }
}
```

## Expected Output

```
=== Console Logger ===
[CONSOLE] connection opened to 10.0.0.1:8080
[CONSOLE] transferred 2048 bytes
[CONSOLE] connection closed

=== File Logger ===
  [0] connection opened to 10.0.0.1:8080
  [1] transferred 2048 bytes
  [2] connection closed
```

## Hint

The `Logger` interface has one method: `Log(message string)`. `ConsoleLogger` prints with a `[CONSOLE]` prefix using `fmt.Println`. `FileLogger` has a `Messages []string` field and appends each message to it.

## Solution

```go
package main

import "fmt"

type Logger interface {
    Log(message string)
}

type ConsoleLogger struct{}

func (c *ConsoleLogger) Log(message string) {
    fmt.Printf("[CONSOLE] %s\n", message)
}

type FileLogger struct {
    Messages []string
}

func (f *FileLogger) Log(message string) {
    f.Messages = append(f.Messages, message)
}

func runDiagnostics(logger Logger) {
    logger.Log("connection opened to 10.0.0.1:8080")
    logger.Log("transferred 2048 bytes")
    logger.Log("connection closed")
}

func main() {
    fmt.Println("=== Console Logger ===")
    consoleLog := &ConsoleLogger{}
    runDiagnostics(consoleLog)

    fmt.Println("\n=== File Logger ===")
    fileLog := &FileLogger{}
    runDiagnostics(fileLog)
    for i, msg := range fileLog.Messages {
        fmt.Printf("  [%d] %s\n", i, msg)
    }
}
```
