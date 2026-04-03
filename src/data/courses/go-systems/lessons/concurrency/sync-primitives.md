---
id: "go-sync-primitives"
courseId: "go-systems"
moduleId: "concurrency"
title: "Sync Primitives"
description: "Protect shared state with mutexes, atomic operations, and sync utilities for thread-safe systems."
order: 4
---

## Scenario

Your multi-client tunnel server maintains a connection table — a map of active connections with metadata like bytes transferred, last activity time, and client address. Multiple goroutines read and write this table simultaneously: one goroutine adds new connections, another removes closed ones, a metrics goroutine reads transfer counts, and a cleanup goroutine evicts idle connections.

Channels work well for passing data between goroutines, but sometimes you need shared state — a map, a counter, a configuration object — that multiple goroutines access directly. That's where sync primitives come in.

## Content

## Sync Primitives

Go's `sync` and `sync/atomic` packages provide low-level tools for protecting shared state. Use these when channels aren't the right fit — typically for shared data structures accessed by many goroutines.

### sync.Mutex

A mutex (mutual exclusion lock) ensures only one goroutine accesses a critical section at a time:

```go
type ConnectionTable struct {
    mu    sync.Mutex
    conns map[string]*ConnInfo
}

type ConnInfo struct {
    RemoteAddr string
    BytesSent  int64
    BytesRecv  int64
    LastActive time.Time
}

func (ct *ConnectionTable) Add(id string, info *ConnInfo) {
    ct.mu.Lock()
    defer ct.mu.Unlock()
    ct.conns[id] = info
}

func (ct *ConnectionTable) Remove(id string) {
    ct.mu.Lock()
    defer ct.mu.Unlock()
    delete(ct.conns, id)
}

func (ct *ConnectionTable) Get(id string) (*ConnInfo, bool) {
    ct.mu.Lock()
    defer ct.mu.Unlock()
    info, ok := ct.conns[id]
    return info, ok
}
```

Always use `defer ct.mu.Unlock()` to ensure the lock is released even if the function panics. Never copy a mutex — embed it in a struct or pass the struct by pointer.

### sync.RWMutex

When reads vastly outnumber writes, `RWMutex` allows multiple concurrent readers but exclusive writers:

```go
type MetricsStore struct {
    mu      sync.RWMutex
    metrics map[string]int64
}

func (ms *MetricsStore) Increment(key string, delta int64) {
    ms.mu.Lock() // exclusive write lock
    defer ms.mu.Unlock()
    ms.metrics[key] += delta
}

func (ms *MetricsStore) Get(key string) int64 {
    ms.mu.RLock() // shared read lock — multiple readers allowed
    defer ms.mu.RUnlock()
    return ms.metrics[key]
}

func (ms *MetricsStore) Snapshot() map[string]int64 {
    ms.mu.RLock()
    defer ms.mu.RUnlock()
    snap := make(map[string]int64, len(ms.metrics))
    for k, v := range ms.metrics {
        snap[k] = v
    }
    return snap
}
```

Use `RLock()`/`RUnlock()` for reads and `Lock()`/`Unlock()` for writes. Multiple goroutines can hold read locks simultaneously, but a write lock blocks all other access.

### sync.Once

`sync.Once` ensures a function runs exactly once, no matter how many goroutines call it. Perfect for lazy initialization:

```go
type DatabasePool struct {
    once sync.Once
    pool *sql.DB
}

func (dp *DatabasePool) getPool() *sql.DB {
    dp.once.Do(func() {
        var err error
        dp.pool, err = sql.Open("postgres", "postgres://localhost/tunnel")
        if err != nil {
            log.Fatal("failed to open database:", err)
        }
        dp.pool.SetMaxOpenConns(25)
        fmt.Println("database pool initialized")
    })
    return dp.pool
}
```

Even if 100 goroutines call `getPool()` simultaneously, the database connection is created exactly once. All other callers wait until the first call completes.

### sync.Map

`sync.Map` is a concurrent map optimized for two patterns: keys are written once and read many times, or multiple goroutines read/write disjoint key sets:

```go
var connRegistry sync.Map

func registerConnection(id string, conn net.Conn) {
    connRegistry.Store(id, conn)
}

func getConnection(id string) (net.Conn, bool) {
    val, ok := connRegistry.Load(id)
    if !ok {
        return nil, false
    }
    return val.(net.Conn), true
}

func removeConnection(id string) {
    connRegistry.Delete(id)
}

func countConnections() int {
    count := 0
    connRegistry.Range(func(key, value any) bool {
        count++
        return true // continue iteration
    })
    return count
}
```

For most use cases, a regular `map` protected by `sync.RWMutex` performs better and is type-safe. Use `sync.Map` only when benchmarks show it's faster for your access pattern.

### Atomic Operations

The `sync/atomic` package provides lock-free operations on integers and pointers. They're faster than mutexes for simple counters and flags:

```go
type TunnelStats struct {
    ActiveConnections int64
    TotalBytesIn      int64
    TotalBytesOut     int64
    PacketsDropped    int64
}

func (s *TunnelStats) ConnectionOpened() {
    atomic.AddInt64(&s.ActiveConnections, 1)
}

func (s *TunnelStats) ConnectionClosed() {
    atomic.AddInt64(&s.ActiveConnections, -1)
}

func (s *TunnelStats) RecordTraffic(bytesIn, bytesOut int64) {
    atomic.AddInt64(&s.TotalBytesIn, bytesIn)
    atomic.AddInt64(&s.TotalBytesOut, bytesOut)
}

func (s *TunnelStats) DropPacket() {
    atomic.AddInt64(&s.PacketsDropped, 1)
}

func (s *TunnelStats) Report() {
    active := atomic.LoadInt64(&s.ActiveConnections)
    in := atomic.LoadInt64(&s.TotalBytesIn)
    out := atomic.LoadInt64(&s.TotalBytesOut)
    dropped := atomic.LoadInt64(&s.PacketsDropped)
    fmt.Printf("active=%d in=%d out=%d dropped=%d\n", active, in, out, dropped)
}
```

Use `atomic.AddInt64` for counters, `atomic.LoadInt64`/`atomic.StoreInt64` for reading/writing, and `atomic.CompareAndSwapInt64` for lock-free conditional updates.

### Choosing the Right Primitive

| Scenario | Use |
|---|---|
| Passing data between goroutines | Channels |
| Protecting a shared data structure | `sync.Mutex` or `sync.RWMutex` |
| Read-heavy, write-rare shared data | `sync.RWMutex` |
| Simple counters and flags | `sync/atomic` |
| One-time initialization | `sync.Once` |
| High-contention disjoint key access | `sync.Map` |

## Why It Matters

Not every concurrent problem fits the channel model. When a metrics dashboard polls connection counts from 50 goroutines, locking a shared map with `RWMutex` is more natural than routing everything through channels. Atomic operations give you nanosecond-level counter updates without lock contention — critical when every packet increments a byte counter. `sync.Once` prevents the thundering herd problem where 1000 goroutines all try to initialize the same resource. Picking the right primitive for the access pattern is the difference between a tunnel that handles 10K connections and one that falls over at 1K.

## Questions

Q: When should you use `sync.RWMutex` instead of `sync.Mutex`?
A) When you need better error handling
B) When reads significantly outnumber writes
C) When the protected data is a map
D) When only two goroutines access the data
Correct: B

Q: What does `sync.Once.Do` guarantee?
A) The function runs at most once, even across multiple goroutines
B) The function runs in a separate goroutine
C) The function runs with a timeout
D) The function can be cancelled
Correct: A

Q: Why use `atomic.AddInt64` instead of `counter++` for a shared counter?
A) It's faster for single-threaded code
B) It prevents data races without requiring a mutex
C) It returns an error if the operation fails
D) It automatically logs the change
Correct: B

## Challenge

Build a thread-safe counter that tracks active connections and total bytes. Use `sync.Mutex` for the counter. Launch 5 goroutines that each "open a connection" (increment active), "transfer bytes" (add to total), then "close the connection" (decrement active). Print the final stats.

## Starter Code

```go
package main

import (
    "fmt"
    "sync"
)

type Stats struct {
    mu          sync.Mutex
    Active      int
    TotalBytes  int64
}

// Add methods: Open(), Close(), Transfer(bytes int64), Report()

func main() {
    stats := &Stats{}
    var wg sync.WaitGroup

    for i := 0; i < 5; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            stats.Open()
            stats.Transfer(int64((id + 1) * 1024))
            stats.Close()
        }(i)
    }

    wg.Wait()
    stats.Report()
}
```

## Expected Output

```
Active: 0, Total Bytes: 15360
```

## Hint

Each method locks the mutex with `s.mu.Lock()` and defers the unlock. `Open` increments `Active`, `Close` decrements it, `Transfer` adds to `TotalBytes`. The total bytes are 1024 + 2048 + 3072 + 4096 + 5120 = 15360.

## Solution

```go
package main

import (
    "fmt"
    "sync"
)

type Stats struct {
    mu         sync.Mutex
    Active     int
    TotalBytes int64
}

func (s *Stats) Open() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.Active++
}

func (s *Stats) Close() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.Active--
}

func (s *Stats) Transfer(bytes int64) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.TotalBytes += bytes
}

func (s *Stats) Report() {
    s.mu.Lock()
    defer s.mu.Unlock()
    fmt.Printf("Active: %d, Total Bytes: %d\n", s.Active, s.TotalBytes)
}

func main() {
    stats := &Stats{}
    var wg sync.WaitGroup

    for i := 0; i < 5; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            stats.Open()
            stats.Transfer(int64((id + 1) * 1024))
            stats.Close()
        }(i)
    }

    wg.Wait()
    stats.Report()
}
```
