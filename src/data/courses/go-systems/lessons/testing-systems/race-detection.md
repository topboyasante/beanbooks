---
id: "go-race-detection"
courseId: "go-systems"
moduleId: "testing-systems"
title: "Race Detection"
description: "Find and fix data races in concurrent Go code using the built-in race detector."
order: 3
---

## Scenario

Your tunnel server tracks active connections in a map. Under light testing, everything works. You deploy to production and it starts handling 500 concurrent connections. After a few minutes, the server panics: `fatal error: concurrent map read and map write`. The stack trace points to your connection tracking code where one goroutine adds a connection while another iterates the map to send heartbeats.

This is a data race — two goroutines accessing the same memory without synchronization, where at least one is writing. Data races are the most common and insidious class of concurrency bugs. They don't always crash. Sometimes they silently corrupt data. Sometimes they work fine for months and then fail under specific timing conditions. Go's race detector catches them deterministically during testing.

## Content

## Race Detection

### What Is a Data Race?

A data race occurs when two or more goroutines access the same variable concurrently and at least one of them writes. The result is undefined behavior — not just wrong values, but potentially corrupted memory, impossible states, and crashes.

```go
package main

import (
    "fmt"
    "sync"
)

func main() {
    // DATA RACE: two goroutines write to `counter` without synchronization
    counter := 0
    var wg sync.WaitGroup

    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            counter++ // unsynchronized read-modify-write
        }()
    }

    wg.Wait()
    fmt.Println("Counter:", counter)
    // Expected: 1000
    // Actual: some number <= 1000 (data race!)
    // With -race flag: "WARNING: DATA RACE" and exit code 66
}
```

Run with `go run -race main.go` to see the race detector's output. It will show exactly which goroutines are involved and which lines of code access the variable.

### The -race Flag

Go's race detector is a compile-time instrumentation that monitors memory accesses at runtime. Enable it with `-race` on any Go command: `go test -race`, `go run -race`, `go build -race`.

```go
package main

import (
    "fmt"
    "sync"
)

// Run: go test -race -run TestConcurrentMap
// The race detector instruments memory accesses and reports races.

type ConnectionTracker struct {
    connections map[string]int // BUG: unprotected map
}

func (ct *ConnectionTracker) Add(id string) {
    ct.connections[id] = 1
}

func (ct *ConnectionTracker) Remove(id string) {
    delete(ct.connections, id)
}

func (ct *ConnectionTracker) Count() int {
    return len(ct.connections)
}

func main() {
    ct := &ConnectionTracker{connections: make(map[string]int)}

    var wg sync.WaitGroup
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            id := fmt.Sprintf("conn-%d", n)
            ct.Add(id)      // concurrent write
            ct.Count()      // concurrent read
            ct.Remove(id)   // concurrent write
        }(i)
    }
    wg.Wait()
    fmt.Println("Final count:", ct.Count())
}
```

The race detector's output looks like:
```
WARNING: DATA RACE
Write at 0x00c000096000 by goroutine 7:
  main.(*ConnectionTracker).Add()
      main.go:15 +0x64
Previous write at 0x00c000096000 by goroutine 6:
  main.(*ConnectionTracker).Add()
      main.go:15 +0x64
```

### Common Race Patterns

Here are the most frequent data race patterns in Go systems code:

```go
package main

import (
    "fmt"
    "sync"
)

// Pattern 1: Unprotected shared counter
func raceCounter() {
    count := 0
    var wg sync.WaitGroup
    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            count++ // RACE
        }()
    }
    wg.Wait()
    fmt.Println(count)
}

// Pattern 2: Concurrent map access (most common in servers)
func raceMap() {
    m := make(map[string]int)
    var wg sync.WaitGroup
    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            key := fmt.Sprintf("k%d", n)
            m[key] = n // RACE: concurrent map write
        }(i)
    }
    wg.Wait()
}

// Pattern 3: Captured loop variable (classic Go gotcha)
func raceLoopVar() {
    var wg sync.WaitGroup
    results := make([]int, 5)
    for i := 0; i < 5; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            results[i] = i * i // RACE: i is shared and mutated by the loop
        }()
    }
    wg.Wait()
}

func main() {
    fmt.Println("These functions all contain data races.")
    fmt.Println("Run with: go run -race main.go")
}
```

### Fixing Races with Mutexes

The most straightforward fix: protect shared state with a `sync.Mutex` or `sync.RWMutex`.

```go
package main

import (
    "fmt"
    "sync"
)

// Fixed: ConnectionTracker with mutex protection
type ConnectionTracker struct {
    mu          sync.RWMutex
    connections map[string]int
}

func NewConnectionTracker() *ConnectionTracker {
    return &ConnectionTracker{
        connections: make(map[string]int),
    }
}

func (ct *ConnectionTracker) Add(id string) {
    ct.mu.Lock()
    defer ct.mu.Unlock()
    ct.connections[id] = 1
}

func (ct *ConnectionTracker) Remove(id string) {
    ct.mu.Lock()
    defer ct.mu.Unlock()
    delete(ct.connections, id)
}

func (ct *ConnectionTracker) Count() int {
    ct.mu.RLock()
    defer ct.mu.RUnlock()
    return len(ct.connections)
}

func main() {
    ct := NewConnectionTracker()

    var wg sync.WaitGroup
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            id := fmt.Sprintf("conn-%d", n)
            ct.Add(id)
            ct.Count()
            ct.Remove(id)
        }(i)
    }
    wg.Wait()
    fmt.Println("Final count:", ct.Count()) // always 0, no race
}
```

### Fixing Races with Channels

Channels provide race-free communication between goroutines. Instead of sharing memory and protecting it with a lock, send data through a channel.

```go
package main

import (
    "fmt"
    "sync"
)

// Fixed: use atomic counter via channel
func safeCounter() int {
    increment := make(chan struct{}, 100)
    done := make(chan int)

    // Single goroutine owns the counter — no shared access
    go func() {
        count := 0
        for range increment {
            count++
        }
        done <- count
    }()

    var wg sync.WaitGroup
    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            increment <- struct{}{} // send, don't share
        }()
    }
    wg.Wait()
    close(increment)

    return <-done
}

func main() {
    result := safeCounter()
    fmt.Println("Counter:", result) // always 1000
}
```

### Race Detector Limitations

The race detector only finds races that actually happen during a test run. If a race condition only triggers under heavy load or specific timing, a simple test might miss it. Always run tests with `-race` in CI, and write tests that exercise concurrent paths.

```go
package main

import "fmt"

func main() {
    fmt.Println("Race detector limitations:")
    fmt.Println("1. Only detects races that execute during the test run")
    fmt.Println("2. Adds ~2-10x CPU overhead and 5-10x memory overhead")
    fmt.Println("3. Cannot detect races in code that isn't reached by tests")
    fmt.Println("4. Not available on all platforms (but works on linux, macOS, windows)")
    fmt.Println()
    fmt.Println("Best practices:")
    fmt.Println("- Always run 'go test -race ./...' in CI")
    fmt.Println("- Write concurrent tests that stress shared state")
    fmt.Println("- Never disable the race detector to 'fix' a race")
}
```

## Why It Matters

Data races are the number one source of concurrency bugs in Go programs. They cause intermittent crashes, silent data corruption, and impossible-to-reproduce production issues. Go's race detector is one of the language's most valuable tools — it turns non-deterministic, hard-to-reproduce bugs into deterministic test failures. Running `go test -race` in your CI pipeline catches races before they reach production. Google runs all their Go tests with the race detector enabled. So should you.

## Questions

Q: What is a data race?
A) Two goroutines reading the same variable
B) Two goroutines accessing the same variable where at least one is writing, without synchronization
C) A goroutine that runs too slowly
D) A deadlock between two goroutines
Correct: B

Q: What flag enables Go's race detector?
A) -detect
B) -concurrent
C) -race
D) -safe
Correct: C

Q: Why does a `sync.RWMutex` use `RLock` for reads instead of `Lock`?
A) RLock is faster because it skips locking
B) RLock allows multiple concurrent readers while Lock blocks all access — better performance for read-heavy workloads
C) RLock only works with maps
D) There is no difference
Correct: B

## Challenge

Fix the data race in this program. A shared `stats` map is accessed by multiple goroutines without synchronization. Add a `sync.Mutex` to make it safe.

## Starter Code

```go
package main

import (
    "fmt"
    "sync"
)

type Stats struct {
    // TODO: add mutex
    counts map[string]int
}

func NewStats() *Stats {
    return &Stats{counts: make(map[string]int)}
}

func (s *Stats) Increment(key string) {
    // TODO: add locking
    s.counts[key]++
}

func (s *Stats) Get(key string) int {
    // TODO: add locking
    return s.counts[key]
}

func main() {
    stats := NewStats()
    var wg sync.WaitGroup

    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            stats.Increment("requests")
        }()
    }
    wg.Wait()
    fmt.Printf("requests: %d\n", stats.Get("requests"))
}
```

## Expected Output

```
requests: 100
```

## Hint

Add a `sync.Mutex` field to the `Stats` struct. In `Increment`, call `s.mu.Lock()` and `defer s.mu.Unlock()` before accessing the map. Do the same in `Get` (or use `sync.RWMutex` with `RLock` for reads).

## Solution

```go
package main

import (
    "fmt"
    "sync"
)

type Stats struct {
    mu     sync.Mutex
    counts map[string]int
}

func NewStats() *Stats {
    return &Stats{counts: make(map[string]int)}
}

func (s *Stats) Increment(key string) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.counts[key]++
}

func (s *Stats) Get(key string) int {
    s.mu.Lock()
    defer s.mu.Unlock()
    return s.counts[key]
}

func main() {
    stats := NewStats()
    var wg sync.WaitGroup

    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            stats.Increment("requests")
        }()
    }
    wg.Wait()
    fmt.Printf("requests: %d\n", stats.Get("requests"))
}
```
