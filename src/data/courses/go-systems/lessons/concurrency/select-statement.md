---
id: "go-select"
courseId: "go-systems"
moduleId: "concurrency"
title: "Select Statement"
description: "Multiplex channels and handle timeouts with Go's select statement for responsive systems."
order: 3
---

## Scenario

Your tunnel now handles multiple connections, each with its own goroutine pair. But you need more control: if an upstream server doesn't respond within 5 seconds, you should timeout and close the connection. If the user sends a shutdown signal, all connections should drain gracefully. If data arrives on any of several channels, you need to handle whichever is ready first.

The `select` statement is Go's multiplexer. It waits on multiple channel operations simultaneously and proceeds with whichever one is ready first — like `epoll` for channels.

## Content

## Select Statement

`select` lets a goroutine wait on multiple channel operations. It blocks until one of its cases can proceed, then executes that case. If multiple cases are ready, one is chosen at random.

### Basic Select

```go
func forwardWithLogging(client, upstream <-chan []byte, logger chan<- string) {
    for {
        select {
        case data := <-client:
            logger <- fmt.Sprintf("client -> upstream: %d bytes", len(data))
            // forward data upstream
        case data := <-upstream:
            logger <- fmt.Sprintf("upstream -> client: %d bytes", len(data))
            // forward data to client
        }
    }
}
```

Each `case` is a channel operation (send or receive). The `select` blocks until one of them can proceed.

### Timeouts with time.After

`time.After` returns a channel that receives a value after the specified duration. Combine it with `select` to implement timeouts:

```go
func readWithTimeout(ch <-chan []byte, timeout time.Duration) ([]byte, error) {
    select {
    case data := <-ch:
        return data, nil
    case <-time.After(timeout):
        return nil, fmt.Errorf("read timed out after %v", timeout)
    }
}

func main() {
    packets := make(chan []byte)

    // Simulate: no data arrives
    data, err := readWithTimeout(packets, 3*time.Second)
    if err != nil {
        fmt.Println(err) // "read timed out after 3s"
    }
    _ = data
}
```

For recurring timeouts (like a heartbeat monitor), use `time.NewTicker`:

```go
func monitorConnection(heartbeat <-chan struct{}, timeout time.Duration) {
    timer := time.NewTimer(timeout)
    defer timer.Stop()

    for {
        select {
        case <-heartbeat:
            // Reset timer on each heartbeat
            if !timer.Stop() {
                <-timer.C
            }
            timer.Reset(timeout)
            fmt.Println("heartbeat received")
        case <-timer.C:
            fmt.Println("connection timed out — no heartbeat")
            return
        }
    }
}
```

### Non-Blocking Operations with Default

Adding a `default` case makes the `select` non-blocking. If no channel is ready, `default` runs immediately:

```go
func tryReceive(ch <-chan []byte) ([]byte, bool) {
    select {
    case data := <-ch:
        return data, true
    default:
        return nil, false // nothing available right now
    }
}

// Non-blocking send — drop the packet if the buffer is full
func trySend(ch chan<- []byte, data []byte) bool {
    select {
    case ch <- data:
        return true
    default:
        fmt.Println("buffer full, dropping packet")
        return false
    }
}
```

This is useful for polling, best-effort delivery, and implementing backpressure.

### Done Channels for Cancellation

The "done channel" pattern uses a channel that's closed to broadcast a shutdown signal to all goroutines:

```go
func worker(id int, jobs <-chan string, done <-chan struct{}) {
    for {
        select {
        case job, ok := <-jobs:
            if !ok {
                fmt.Printf("worker %d: job queue closed\n", id)
                return
            }
            fmt.Printf("worker %d: processing %s\n", id, job)
            time.Sleep(500 * time.Millisecond)
        case <-done:
            fmt.Printf("worker %d: shutting down\n", id)
            return
        }
    }
}

func main() {
    jobs := make(chan string, 10)
    done := make(chan struct{})

    // Start workers
    for i := 0; i < 3; i++ {
        go worker(i, jobs, done)
    }

    // Send some jobs
    jobs <- "scan-port-80"
    jobs <- "scan-port-443"
    jobs <- "scan-port-8080"

    // Shutdown after 2 seconds
    time.Sleep(2 * time.Second)
    close(done) // all workers receive on this simultaneously

    time.Sleep(100 * time.Millisecond) // let workers print shutdown message
}
```

Closing the `done` channel wakes up all goroutines waiting on it. This is broadcast semantics — unlike sending a value, which wakes up only one receiver.

### Combining Multiple Patterns

A real tunnel connection handler combines timeouts, cancellation, and data forwarding:

```go
func handleTunnel(client, upstream net.Conn, done <-chan struct{}) {
    clientData := make(chan []byte, 64)
    upstreamData := make(chan []byte, 64)

    // Reader goroutines
    go func() {
        buf := make([]byte, 4096)
        for {
            n, err := client.Read(buf)
            if err != nil {
                close(clientData)
                return
            }
            pkt := make([]byte, n)
            copy(pkt, buf[:n])
            clientData <- pkt
        }
    }()

    go func() {
        buf := make([]byte, 4096)
        for {
            n, err := upstream.Read(buf)
            if err != nil {
                close(upstreamData)
                return
            }
            pkt := make([]byte, n)
            copy(pkt, buf[:n])
            upstreamData <- pkt
        }
    }()

    // Multiplex with timeout and cancellation
    idleTimeout := 30 * time.Second
    timer := time.NewTimer(idleTimeout)
    defer timer.Stop()

    for {
        select {
        case data, ok := <-clientData:
            if !ok {
                return
            }
            upstream.Write(data)
            timer.Reset(idleTimeout)
        case data, ok := <-upstreamData:
            if !ok {
                return
            }
            client.Write(data)
            timer.Reset(idleTimeout)
        case <-timer.C:
            fmt.Println("idle timeout — closing tunnel")
            return
        case <-done:
            fmt.Println("shutdown signal — closing tunnel")
            return
        }
    }
}
```

## Why It Matters

Real systems programs rarely wait on just one thing. A tunnel handler waits for client data, upstream data, timeout expiration, and shutdown signals all at the same time. `select` is how you express this cleanly in Go — instead of polling with locks or callbacks, you declare what you're waiting for and handle whatever happens first. Timeouts prevent resource leaks from stalled connections. Done channels enable graceful shutdown so in-flight data isn't lost. Non-blocking select with `default` gives you backpressure so a slow consumer doesn't crash a fast producer.

## Questions

Q: What happens when multiple cases in a select are ready simultaneously?
A) The first case listed is always chosen
B) One is chosen at random
C) All ready cases execute in order
D) The program panics
Correct: B

Q: How does closing a "done" channel differ from sending a value on it?
A) Closing delivers to all waiting receivers; sending delivers to one
B) Closing is slower but safer
C) There is no difference
D) Closing causes a panic in all receivers
Correct: A

Q: What does the default case in a select do?
A) Runs after a timeout
B) Handles errors from other cases
C) Executes immediately if no other case is ready
D) Runs after all other cases complete
Correct: C

## Challenge

Write a program that simulates a connection monitor. A goroutine sends "heartbeats" every 500ms. The main goroutine uses `select` to listen for heartbeats and times out if none arrive within 2 seconds. After 3 heartbeats, stop sending and let the timeout trigger.

## Starter Code

```go
package main

import (
    "fmt"
    "time"
)

func sendHeartbeats(ch chan<- string, count int) {
    // Send `count` heartbeats, one every 500ms, then stop
}

func main() {
    heartbeat := make(chan string)

    go sendHeartbeats(heartbeat, 3)

    // Listen for heartbeats with a 2-second timeout
    // Print each heartbeat, and print "timeout" when none arrive
}
```

## Expected Output

```
received: heartbeat 1
received: heartbeat 2
received: heartbeat 3
connection timed out
```

## Hint

In `sendHeartbeats`, loop `count` times, sleeping 500ms between sends. In `main`, use an infinite loop with `select` that has two cases: receiving from the heartbeat channel and `time.After(2 * time.Second)`. Break out of the loop on timeout.

## Solution

```go
package main

import (
    "fmt"
    "time"
)

func sendHeartbeats(ch chan<- string, count int) {
    for i := 1; i <= count; i++ {
        time.Sleep(500 * time.Millisecond)
        ch <- fmt.Sprintf("heartbeat %d", i)
    }
}

func main() {
    heartbeat := make(chan string)

    go sendHeartbeats(heartbeat, 3)

    for {
        select {
        case msg := <-heartbeat:
            fmt.Printf("received: %s\n", msg)
        case <-time.After(2 * time.Second):
            fmt.Println("connection timed out")
            return
        }
    }
}
```
