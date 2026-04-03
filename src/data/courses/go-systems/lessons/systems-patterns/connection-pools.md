---
id: "go-connection-pools"
courseId: "go-systems"
moduleId: "systems-patterns"
title: "Connection Pools"
description: "Build a connection pool using channels to reuse expensive TCP connections across concurrent requests."
order: 1
---

## Scenario

Your database client opens a new TCP connection for every query. Each connection requires a TCP handshake (1 round trip), a TLS handshake (2 more round trips), and authentication (1 more round trip). That's 50-200ms of setup time before you even send the query. Under load, your application opens hundreds of connections simultaneously, exhausting the database's connection limit and crashing the whole system.

Connection pooling solves this by maintaining a set of pre-established connections that are borrowed and returned. Instead of paying the 200ms connection cost per query, you pay it once. A query grabs an idle connection from the pool, executes, and returns it. The next query reuses the same connection. This is why every database driver, HTTP client, and gRPC framework uses connection pooling internally.

## Content

## Connection Pools

### Why Pools Exist

Creating a network connection is expensive. A TCP + TLS connection to a remote database involves multiple network round trips before any useful work happens. Connection pools amortize this cost by keeping connections alive and reusing them.

```go
package main

import (
    "fmt"
    "time"
)

func simulateConnectionCost() {
    // Simulated costs of connection establishment
    tcpHandshake := 10 * time.Millisecond
    tlsHandshake := 20 * time.Millisecond
    authentication := 5 * time.Millisecond
    total := tcpHandshake + tlsHandshake + authentication

    fmt.Println("Cost per new connection:")
    fmt.Printf("  TCP handshake:    %v\n", tcpHandshake)
    fmt.Printf("  TLS handshake:    %v\n", tlsHandshake)
    fmt.Printf("  Authentication:   %v\n", authentication)
    fmt.Printf("  Total:            %v\n", total)

    queries := 1000
    fmt.Printf("\n%d queries without pooling: %v overhead\n", queries, time.Duration(queries)*total)
    fmt.Printf("%d queries with pooling (5 conns): %v overhead\n", queries, time.Duration(5)*total)
}

func main() {
    simulateConnectionCost()
}
```

### Implementing a Pool with Channels

Go channels are a natural fit for connection pools. A buffered channel holds idle connections. `Get` receives from the channel (or creates a new connection if empty). `Put` sends back to the channel (or discards if full).

```go
package main

import (
    "errors"
    "fmt"
    "sync/atomic"
    "time"
)

// Conn simulates a network connection.
type Conn struct {
    ID        int
    CreatedAt time.Time
}

type Pool struct {
    idle    chan *Conn
    maxSize int
    counter atomic.Int32
    factory func() (*Conn, error)
}

func NewPool(maxSize int, factory func() (*Conn, error)) *Pool {
    return &Pool{
        idle:    make(chan *Conn, maxSize),
        maxSize: maxSize,
        factory: factory,
    }
}

// Get retrieves an idle connection or creates a new one.
func (p *Pool) Get() (*Conn, error) {
    // Try to get an idle connection (non-blocking)
    select {
    case conn := <-p.idle:
        fmt.Printf("  Reused connection #%d\n", conn.ID)
        return conn, nil
    default:
        // No idle connections, create a new one
        conn, err := p.factory()
        if err != nil {
            return nil, err
        }
        id := int(p.counter.Add(1))
        conn.ID = id
        fmt.Printf("  Created connection #%d\n", conn.ID)
        return conn, nil
    }
}

// Put returns a connection to the pool.
func (p *Pool) Put(conn *Conn) {
    select {
    case p.idle <- conn:
        // Returned to pool
    default:
        // Pool is full, discard the connection
        fmt.Printf("  Discarded connection #%d (pool full)\n", conn.ID)
    }
}

func main() {
    pool := NewPool(3, func() (*Conn, error) {
        return &Conn{CreatedAt: time.Now()}, nil
    })

    // Simulate 5 queries, reusing connections
    for i := 0; i < 5; i++ {
        fmt.Printf("Query %d:\n", i+1)
        conn, err := pool.Get()
        if err != nil {
            panic(err)
        }
        // Simulate work
        time.Sleep(1 * time.Millisecond)
        pool.Put(conn)
    }
}
```

### Idle Timeout and Connection Lifecycle

Connections go stale. A database might close idle connections after 5 minutes. A firewall might silently drop idle TCP sessions. Your pool needs to detect and replace stale connections.

```go
package main

import (
    "fmt"
    "time"
)

type Conn struct {
    ID       int
    LastUsed time.Time
    Healthy  bool
}

type Pool struct {
    idle       chan *Conn
    idleTimeout time.Duration
}

func NewPool(size int, idleTimeout time.Duration) *Pool {
    return &Pool{
        idle:        make(chan *Conn, size),
        idleTimeout: idleTimeout,
    }
}

func (p *Pool) isExpired(conn *Conn) bool {
    return time.Since(conn.LastUsed) > p.idleTimeout
}

func (p *Pool) Get() *Conn {
    for {
        select {
        case conn := <-p.idle:
            if p.isExpired(conn) {
                fmt.Printf("  Evicted expired connection #%d (idle %v)\n",
                    conn.ID, time.Since(conn.LastUsed).Round(time.Millisecond))
                continue // try the next connection
            }
            conn.LastUsed = time.Now()
            return conn
        default:
            // Create new connection
            return &Conn{
                ID:       int(time.Now().UnixNano() % 1000),
                LastUsed: time.Now(),
                Healthy:  true,
            }
        }
    }
}

func (p *Pool) Put(conn *Conn) {
    conn.LastUsed = time.Now()
    select {
    case p.idle <- conn:
    default:
    }
}

func main() {
    pool := NewPool(5, 50*time.Millisecond)

    // Get a connection and return it
    conn := pool.Get()
    fmt.Printf("Got connection #%d\n", conn.ID)
    pool.Put(conn)

    // Wait for it to expire
    time.Sleep(100 * time.Millisecond)

    // Next Get should evict the stale connection
    conn2 := pool.Get()
    fmt.Printf("Got connection #%d (new after eviction)\n", conn2.ID)
}
```

### Health Checks

Beyond idle timeouts, connections can become unhealthy while sitting in the pool — the remote server might restart, the network route might change. A health check pings the connection before handing it to the caller.

```go
package main

import "fmt"

type Conn struct {
    ID      int
    healthy bool
}

func (c *Conn) Ping() error {
    if !c.healthy {
        return fmt.Errorf("connection #%d is dead", c.ID)
    }
    return nil
}

type Pool struct {
    idle chan *Conn
}

func (p *Pool) Get() (*Conn, error) {
    for {
        select {
        case conn := <-p.idle:
            if err := conn.Ping(); err != nil {
                fmt.Printf("  Health check failed: %v — discarding\n", err)
                continue
            }
            fmt.Printf("  Health check passed for connection #%d\n", conn.ID)
            return conn, nil
        default:
            conn := &Conn{ID: 99, healthy: true}
            fmt.Printf("  Created new connection #%d\n", conn.ID)
            return conn, nil
        }
    }
}

func main() {
    pool := &Pool{idle: make(chan *Conn, 5)}

    // Add a healthy and an unhealthy connection
    pool.idle <- &Conn{ID: 1, healthy: false}
    pool.idle <- &Conn{ID: 2, healthy: true}

    // Get should skip the unhealthy one
    conn, err := pool.Get()
    if err != nil {
        panic(err)
    }
    fmt.Printf("Got connection #%d\n", conn.ID)
}
```

### Pool Sizing and Backpressure

A pool that's too small creates contention — goroutines block waiting for a connection. A pool that's too large wastes database resources. Production pools use a bounded semaphore to limit total connections and block callers when the limit is reached.

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

type BoundedPool struct {
    sem  chan struct{} // limits total connections
    idle chan int      // idle connection IDs
    mu   sync.Mutex
    next int
}

func NewBoundedPool(maxConns int) *BoundedPool {
    return &BoundedPool{
        sem:  make(chan struct{}, maxConns),
        idle: make(chan int, maxConns),
    }
}

func (p *BoundedPool) Get(ctx context.Context) (int, error) {
    // Try idle first
    select {
    case id := <-p.idle:
        return id, nil
    default:
    }

    // Acquire semaphore slot (blocks if at max connections)
    select {
    case p.sem <- struct{}{}:
        p.mu.Lock()
        p.next++
        id := p.next
        p.mu.Unlock()
        return id, nil
    case <-ctx.Done():
        return 0, fmt.Errorf("timed out waiting for connection: %w", ctx.Err())
    }
}

func (p *BoundedPool) Put(id int) {
    select {
    case p.idle <- id:
    default:
        <-p.sem // release the semaphore slot
    }
}

func main() {
    pool := NewBoundedPool(2)

    ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
    defer cancel()

    // Get 2 connections (hits max)
    id1, _ := pool.Get(ctx)
    id2, _ := pool.Get(ctx)
    fmt.Printf("Got connections: %d, %d\n", id1, id2)

    // Third Get should block and timeout
    _, err := pool.Get(ctx)
    if err != nil {
        fmt.Printf("Third Get: %v\n", err)
    }

    // Return one, now we can Get again
    pool.Put(id1)
    ctx2 := context.Background()
    id3, _ := pool.Get(ctx2)
    fmt.Printf("After return, got connection: %d\n", id3)
}
```

## Why It Matters

Connection pooling is one of the most impactful performance patterns in systems programming. The `database/sql` package in Go's standard library uses a connection pool internally. HTTP clients pool TCP connections via keep-alive. gRPC multiplexes streams over pooled HTTP/2 connections. Understanding how pools work — the channel-based idle queue, health checks, idle timeouts, bounded sizing — means you can configure them correctly, debug pool exhaustion issues in production, and build custom pools when the standard library doesn't fit your needs.

## Questions

Q: Why is a buffered channel a good data structure for a connection pool?
A) Channels automatically close idle connections
B) Channels provide thread-safe send/receive that naturally models borrow/return semantics
C) Channels are faster than slices
D) Channels encrypt the connections
Correct: B

Q: What happens when you return a connection to a pool that is already full?
A) The program panics
B) The connection is queued indefinitely
C) The connection should be discarded (closed) since the pool has enough idle connections
D) The pool automatically grows
Correct: C

Q: Why do connection pools need health checks?
A) To measure query performance
B) Because connections can become unusable while sitting idle in the pool
C) To enforce rate limits
D) To compress the data
Correct: B

## Challenge

Implement a `Pool` struct with `Get` and `Put` methods using a buffered channel. `Get` should return an idle connection if available, or create a new one. `Put` should return it to the pool or discard it if the pool is full. Track how many connections were created vs reused.

## Starter Code

```go
package main

import "fmt"

type Conn struct {
    ID int
}

type Pool struct {
    idle    chan *Conn
    created int
    reused  int
    nextID  int
}

func NewPool(size int) *Pool {
    // TODO
    return nil
}

func (p *Pool) Get() *Conn {
    // TODO: try idle channel, else create new
    return nil
}

func (p *Pool) Put(c *Conn) {
    // TODO: return to idle, or discard
}

func main() {
    pool := NewPool(2)

    for i := 0; i < 5; i++ {
        conn := pool.Get()
        fmt.Printf("Got connection #%d\n", conn.ID)
        pool.Put(conn)
    }

    fmt.Printf("Created: %d, Reused: %d\n", pool.created, pool.reused)
}
```

## Expected Output

```
Got connection #1
Got connection #1
Got connection #1
Got connection #1
Got connection #1
Created: 1, Reused: 4
```

## Hint

Use a buffered channel of size `size` for idle connections. In `Get`, use a `select` with `default` to try the channel non-blocking. In `Put`, use the same pattern to avoid blocking if the channel is full.

## Solution

```go
package main

import "fmt"

type Conn struct {
    ID int
}

type Pool struct {
    idle    chan *Conn
    created int
    reused  int
    nextID  int
}

func NewPool(size int) *Pool {
    return &Pool{
        idle: make(chan *Conn, size),
    }
}

func (p *Pool) Get() *Conn {
    select {
    case conn := <-p.idle:
        p.reused++
        return conn
    default:
        p.nextID++
        p.created++
        return &Conn{ID: p.nextID}
    }
}

func (p *Pool) Put(c *Conn) {
    select {
    case p.idle <- c:
    default:
        // pool full, discard
    }
}

func main() {
    pool := NewPool(2)

    for i := 0; i < 5; i++ {
        conn := pool.Get()
        fmt.Printf("Got connection #%d\n", conn.ID)
        pool.Put(conn)
    }

    fmt.Printf("Created: %d, Reused: %d\n", pool.created, pool.reused)
}
```
