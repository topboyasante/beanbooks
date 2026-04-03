---
id: "go-graceful-shutdown"
courseId: "go-systems"
moduleId: "systems-patterns"
title: "Graceful Shutdown"
description: "Handle OS signals and drain active connections so your server stops cleanly without dropping requests."
order: 3
---

## Scenario

Your tunnel server is running in production behind a load balancer. You deploy a new version. The orchestrator sends SIGTERM to the old process. If your server just calls `os.Exit(0)`, every active tunnel connection drops instantly — users see broken pipes, failed downloads, and lost WebSocket sessions. They submit support tickets. Your on-call engineer gets paged.

Graceful shutdown means: stop accepting new connections, wait for active connections to finish (up to a timeout), clean up resources (flush logs, close database connections), and then exit. This is how every production server should behave. Kubernetes gives pods 30 seconds after SIGTERM before sending SIGKILL. Your server needs to use that time wisely.

## Content

## Graceful Shutdown

### OS Signals in Go

Unix signals are how the operating system communicates with your process. SIGTERM means "please shut down." SIGINT is what Ctrl+C sends. SIGKILL cannot be caught — the OS kills your process immediately. Go's `os/signal` package lets you intercept signals.

```go
package main

import (
    "fmt"
    "os"
    "os/signal"
    "syscall"
)

func main() {
    // Create a channel to receive signals
    sigCh := make(chan os.Signal, 1)

    // Register for SIGINT and SIGTERM
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

    fmt.Println("Server started. Press Ctrl+C to trigger shutdown...")

    // Block until a signal arrives
    sig := <-sigCh
    fmt.Printf("\nReceived signal: %v\n", sig)
    fmt.Println("Starting graceful shutdown...")

    // Cleanup work would go here
    fmt.Println("Shutdown complete.")
}
```

### Signal-Driven Context Cancellation

The idiomatic Go pattern is to derive a context from the signal. When the signal arrives, the context is cancelled, and every goroutine watching that context starts its shutdown sequence.

```go
package main

import (
    "context"
    "fmt"
    "os/signal"
    "sync"
    "syscall"
    "time"
)

func worker(ctx context.Context, id int, wg *sync.WaitGroup) {
    defer wg.Done()
    for {
        select {
        case <-ctx.Done():
            fmt.Printf("Worker %d: shutting down\n", id)
            return
        case <-time.After(500 * time.Millisecond):
            fmt.Printf("Worker %d: processing...\n", id)
        }
    }
}

func main() {
    // Create a context that cancels on SIGINT or SIGTERM
    ctx, stop := signal.NotifyContext(context.Background(),
        syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    var wg sync.WaitGroup

    // Start workers
    for i := 1; i <= 3; i++ {
        wg.Add(1)
        go worker(ctx, i, &wg)
    }

    fmt.Println("Server running. Send SIGINT (Ctrl+C) to stop.")

    // Simulate SIGINT after 1.5 seconds for demo purposes
    go func() {
        time.Sleep(1500 * time.Millisecond)
        stop() // cancel the context (simulates signal)
    }()

    // Wait for all workers to finish
    wg.Wait()
    fmt.Println("All workers stopped. Server exited cleanly.")
}
```

### Draining Active Connections

The key challenge: you've stopped accepting new connections, but existing connections are mid-request. You need to wait for them to complete, but not forever.

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

type Server struct {
    activeConns sync.WaitGroup
    mu          sync.Mutex
    connCount   int
    shutdown    bool
}

func (s *Server) AcceptConnection(id int) bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    if s.shutdown {
        fmt.Printf("  Rejected connection %d (shutting down)\n", id)
        return false
    }
    s.connCount++
    s.activeConns.Add(1)
    fmt.Printf("  Accepted connection %d (active: %d)\n", id, s.connCount)
    return true
}

func (s *Server) CloseConnection(id int) {
    s.mu.Lock()
    s.connCount--
    fmt.Printf("  Closed connection %d (active: %d)\n", id, s.connCount)
    s.mu.Unlock()
    s.activeConns.Done()
}

func (s *Server) Shutdown(timeout time.Duration) error {
    s.mu.Lock()
    s.shutdown = true
    count := s.connCount
    s.mu.Unlock()

    fmt.Printf("Shutdown: draining %d active connections...\n", count)

    // Wait for connections with timeout
    done := make(chan struct{})
    go func() {
        s.activeConns.Wait()
        close(done)
    }()

    select {
    case <-done:
        fmt.Println("Shutdown: all connections drained.")
        return nil
    case <-time.After(timeout):
        return fmt.Errorf("shutdown: timed out after %v with connections still active", timeout)
    }
}

func main() {
    srv := &Server{}

    // Accept some connections
    srv.AcceptConnection(1)
    srv.AcceptConnection(2)
    srv.AcceptConnection(3)

    // Simulate connections finishing over time
    go func() {
        time.Sleep(100 * time.Millisecond)
        srv.CloseConnection(1)
    }()
    go func() {
        time.Sleep(200 * time.Millisecond)
        srv.CloseConnection(2)
    }()
    go func() {
        time.Sleep(300 * time.Millisecond)
        srv.CloseConnection(3)
    }()

    // New connections after shutdown should be rejected
    go func() {
        time.Sleep(50 * time.Millisecond)
        srv.AcceptConnection(4)
    }()

    // Start shutdown
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    _ = ctx

    if err := srv.Shutdown(5 * time.Second); err != nil {
        fmt.Printf("ERROR: %v\n", err)
    }
}
```

### Cleanup Order

Resources must be cleaned up in the correct order. Close the listener first (stop accepting), then drain connections, then close the connection pool, then flush logs. Reverse the initialization order.

```go
package main

import "fmt"

type App struct {
    listener string
    pool     string
    logger   string
}

func (a *App) Start() {
    // Initialization order: logger -> pool -> listener
    a.logger = "started"
    fmt.Println("1. Logger initialized")
    a.pool = "started"
    fmt.Println("2. Connection pool initialized")
    a.listener = "started"
    fmt.Println("3. Listener started")
}

func (a *App) Shutdown() {
    // Cleanup order: reverse of initialization
    fmt.Println("\nShutdown sequence:")

    // 1. Stop accepting new connections
    a.listener = "stopped"
    fmt.Println("1. Listener closed (no new connections)")

    // 2. Drain active connections (simulated)
    fmt.Println("2. Draining active connections...")

    // 3. Close connection pool
    a.pool = "stopped"
    fmt.Println("3. Connection pool closed")

    // 4. Flush and close logger (last, so we can log the shutdown)
    fmt.Println("4. Flushing logs...")
    a.logger = "stopped"
    fmt.Println("5. Logger closed. Goodbye.")
}

func main() {
    app := &App{}
    app.Start()
    app.Shutdown()
}
```

### Shutdown Timeout

A hard timeout ensures your process eventually exits, even if a connection is stuck. Kubernetes will send SIGKILL after its grace period, but it's better to handle the timeout yourself and log which connections are stuck.

```go
package main

import (
    "context"
    "fmt"
    "time"
)

func shutdownWithTimeout(ctx context.Context, cleanup func(context.Context) error) {
    // Add a hard deadline beyond the context's deadline
    deadline, ok := ctx.Deadline()
    if ok {
        fmt.Printf("Shutdown deadline: %v from now\n", time.Until(deadline).Round(time.Millisecond))
    }

    err := cleanup(ctx)
    if err != nil {
        fmt.Printf("Cleanup error: %v\n", err)
        fmt.Println("Forcing exit...")
        return
    }
    fmt.Println("Clean shutdown complete.")
}

func main() {
    // 500ms shutdown timeout
    ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
    defer cancel()

    // Simulate cleanup that finishes in time
    shutdownWithTimeout(ctx, func(ctx context.Context) error {
        select {
        case <-time.After(200 * time.Millisecond):
            fmt.Println("  Resources cleaned up.")
            return nil
        case <-ctx.Done():
            return ctx.Err()
        }
    })

    fmt.Println()

    // Simulate cleanup that takes too long
    ctx2, cancel2 := context.WithTimeout(context.Background(), 100*time.Millisecond)
    defer cancel2()

    shutdownWithTimeout(ctx2, func(ctx context.Context) error {
        select {
        case <-time.After(500 * time.Millisecond):
            return nil
        case <-ctx.Done():
            return ctx.Err()
        }
    })
}
```

## Why It Matters

Graceful shutdown is table stakes for production services. Without it, every deployment causes a small outage. Container orchestrators like Kubernetes, ECS, and Nomad all rely on SIGTERM-based graceful shutdown. HTTP servers, gRPC servers, message consumers, and background workers all need it. Go's `http.Server.Shutdown()` method implements this pattern, and understanding it means you can build the same pattern for any custom server. It's the difference between "we deploy during off-hours to minimize impact" and "we deploy 50 times a day with zero downtime."

## Questions

Q: What signal does Kubernetes send to a pod before terminating it?
A) SIGKILL
B) SIGTERM
C) SIGHUP
D) SIGUSR1
Correct: B

Q: Why should the listener be closed before draining active connections?
A) To free up the port number for the new process
B) To stop accepting new connections while existing ones complete, preventing indefinite shutdown
C) Because the OS requires it
D) To trigger a SIGKILL
Correct: B

Q: What happens if your cleanup takes longer than the shutdown timeout?
A) The OS automatically extends the timeout
B) Nothing, the process keeps running
C) The process should force-exit to avoid being killed ungracefully by the orchestrator
D) The connections are automatically migrated
Correct: C

## Challenge

Write a program that starts 3 "worker" goroutines, each running a loop. When a simulated shutdown signal fires (cancel a context after 1 second), all workers should stop, and the main function should wait for them and print "shutdown complete."

## Starter Code

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

func worker(ctx context.Context, id int, wg *sync.WaitGroup) {
    defer wg.Done()
    // TODO: loop until ctx is cancelled, printing "worker N: tick" each iteration
}

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    var wg sync.WaitGroup

    // TODO: start 3 workers

    // Simulate shutdown after 1 second
    time.Sleep(1 * time.Second)
    fmt.Println("--- initiating shutdown ---")
    cancel()

    // TODO: wait for workers
    fmt.Println("shutdown complete")
}
```

## Expected Output

```
worker 1: tick
worker 2: tick
worker 3: tick
worker 1: tick
worker 2: tick
worker 3: tick
--- initiating shutdown ---
worker 1: stopping
worker 2: stopping
worker 3: stopping
shutdown complete
```

## Hint

Each worker should use a `select` with `<-ctx.Done()` and a `time.After` ticker. When `ctx.Done()` fires, print "stopping" and return. The main goroutine calls `wg.Wait()` after `cancel()`.

## Solution

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

func worker(ctx context.Context, id int, wg *sync.WaitGroup) {
    defer wg.Done()
    for {
        select {
        case <-ctx.Done():
            fmt.Printf("worker %d: stopping\n", id)
            return
        case <-time.After(400 * time.Millisecond):
            fmt.Printf("worker %d: tick\n", id)
        }
    }
}

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    var wg sync.WaitGroup

    for i := 1; i <= 3; i++ {
        wg.Add(1)
        go worker(ctx, i, &wg)
    }

    time.Sleep(1 * time.Second)
    fmt.Println("--- initiating shutdown ---")
    cancel()

    wg.Wait()
    fmt.Println("shutdown complete")
}
```
