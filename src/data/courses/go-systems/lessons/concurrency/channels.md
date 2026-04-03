---
id: "go-channels"
courseId: "go-systems"
moduleId: "concurrency"
title: "Channels"
description: "Build data pipelines with channels — Go's type-safe mechanism for goroutine communication."
order: 2
---

## Scenario

Your tunnel now handles multiple connections with goroutines, but they need to communicate. The receiver goroutine reads packets from the client, and the forwarder goroutine sends them upstream. You need a way to pass packets between them safely — no shared memory, no locks, no race conditions.

Go's answer is channels: typed conduits that let one goroutine send data and another receive it. "Don't communicate by sharing memory; share memory by communicating."

## Content

## Channels

Channels are Go's primary mechanism for communication between goroutines. They're typed — a `chan int` can only carry integers, a `chan []byte` can only carry byte slices.

### Creating and Using Channels

```go
// Create an unbuffered channel
packets := make(chan []byte)

// Send a value (blocks until someone receives)
packets <- []byte{0x48, 0x45, 0x4c, 0x4c, 0x4f}

// Receive a value (blocks until someone sends)
data := <-packets
```

A basic producer-consumer pattern:

```go
func readPackets(conn net.Conn, out chan<- []byte) {
    buf := make([]byte, 4096)
    for {
        n, err := conn.Read(buf)
        if err != nil {
            close(out)
            return
        }
        packet := make([]byte, n)
        copy(packet, buf[:n])
        out <- packet
    }
}

func forwardPackets(upstream net.Conn, in <-chan []byte) {
    for packet := range in {
        upstream.Write(packet)
    }
}

func main() {
    packets := make(chan []byte)
    go readPackets(clientConn, packets)
    go forwardPackets(upstreamConn, packets)
}
```

### Unbuffered vs Buffered Channels

**Unbuffered channels** (created with `make(chan T)`) block on both send and receive until the other side is ready. This provides synchronization — the sender knows the receiver has the value:

```go
ch := make(chan string)

go func() {
    ch <- "ready" // blocks until main receives
    fmt.Println("sent")
}()

msg := <-ch // blocks until goroutine sends
fmt.Println(msg)
```

**Buffered channels** (created with `make(chan T, capacity)`) can hold values without a receiver being ready. Sends only block when the buffer is full, and receives only block when the buffer is empty:

```go
ch := make(chan []byte, 100) // buffer up to 100 packets

// Sender can push up to 100 packets without blocking
ch <- packet1
ch <- packet2

// Receiver pulls when ready
data := <-ch
```

Use buffered channels when the sender and receiver run at different speeds and you want to absorb bursts:

```go
func packetProcessor(bufSize int) chan []byte {
    ch := make(chan []byte, bufSize)
    go func() {
        for pkt := range ch {
            // process takes variable time
            processPacket(pkt)
        }
    }()
    return ch
}

// Incoming packets get buffered while processor is busy
proc := packetProcessor(256)
proc <- rawPacket
```

### Closing Channels

The sender closes a channel to signal that no more values will be sent. Receivers can detect this:

```go
ch := make(chan int, 5)

// Sender
go func() {
    for i := 0; i < 5; i++ {
        ch <- i
    }
    close(ch) // signal: no more data
}()

// Receiver: two-value receive
for {
    val, ok := <-ch
    if !ok {
        fmt.Println("channel closed")
        break
    }
    fmt.Println(val)
}
```

Rules about closing channels:
- Only the sender should close a channel, never the receiver
- Sending on a closed channel causes a panic
- Receiving from a closed channel returns the zero value immediately
- Closing an already-closed channel causes a panic

### Range Over Channels

`range` on a channel receives values until the channel is closed — it's the idiomatic way to drain a channel:

```go
func logEvents(events <-chan string) {
    for event := range events {
        fmt.Printf("[LOG] %s\n", event)
    }
    fmt.Println("event stream ended")
}

func main() {
    events := make(chan string, 10)

    go func() {
        events <- "connection opened"
        events <- "data transferred"
        events <- "connection closed"
        close(events)
    }()

    logEvents(events) // processes all 3, then exits loop when closed
}
```

### Directional Channel Types

Function signatures can restrict channels to send-only or receive-only. This prevents misuse at compile time:

```go
// Send-only: can only send into this channel
func producer(out chan<- int) {
    for i := 0; i < 10; i++ {
        out <- i
    }
    close(out)
}

// Receive-only: can only receive from this channel
func consumer(in <-chan int) {
    for val := range in {
        fmt.Println(val)
    }
}

func main() {
    ch := make(chan int, 10)
    go producer(ch) // bidirectional converts to send-only
    consumer(ch)    // bidirectional converts to receive-only
}
```

Directional channels are documentation in the type system. When you see `<-chan []byte`, you know this function only reads from the channel. When you see `chan<- []byte`, it only writes.

### Building a Pipeline

Channels naturally compose into pipelines where each stage is a goroutine:

```go
func readStage(data [][]byte) <-chan []byte {
    out := make(chan []byte)
    go func() {
        for _, d := range data {
            out <- d
        }
        close(out)
    }()
    return out
}

func transformStage(in <-chan []byte) <-chan []byte {
    out := make(chan []byte)
    go func() {
        for pkt := range in {
            // XOR transform
            result := make([]byte, len(pkt))
            for i, b := range pkt {
                result[i] = b ^ 0xFF
            }
            out <- result
        }
        close(out)
    }()
    return out
}

func main() {
    raw := [][]byte{{0x01, 0x02}, {0x03, 0x04}, {0x05}}

    stage1 := readStage(raw)
    stage2 := transformStage(stage1)

    for result := range stage2 {
        fmt.Printf("%x\n", result)
    }
}
```

## Why It Matters

Channels eliminate data races by design. Instead of two goroutines accessing shared memory with locks, you pass ownership of data through a channel — once you send a value, you shouldn't touch it again. This makes concurrent programs easier to reason about. Buffered channels absorb bursts in packet processing, preventing a slow consumer from stalling a fast producer. Directional channel types catch communication mistakes at compile time. Pipelines let you decompose complex processing into independent, testable stages connected by channels.

## Questions

Q: What happens when you send on an unbuffered channel and no goroutine is receiving?
A) The value is discarded
B) The send returns an error
C) The sending goroutine blocks until a receiver is ready
D) The program panics
Correct: C

Q: What happens when you receive from a closed channel?
A) The program panics
B) The receive blocks forever
C) The zero value of the channel's type is returned immediately
D) An error is returned
Correct: C

Q: What does `chan<- int` mean in a function parameter?
A) A channel that can only receive integers
B) A channel that can only send integers
C) A bidirectional integer channel
D) A buffered integer channel
Correct: B

## Challenge

Build a three-stage pipeline: a generator that sends numbers 1-5, a doubler that multiplies each by 2, and a printer that displays the results. Use directional channels and range loops.

## Starter Code

```go
package main

import "fmt"

func generator(nums ...int) <-chan int {
    // Create channel, launch goroutine to send nums, return channel
}

func doubler(in <-chan int) <-chan int {
    // Create channel, launch goroutine to double each value, return channel
}

func main() {
    // Wire up: generator -> doubler -> print results
}
```

## Expected Output

```
2
4
6
8
10
```

## Hint

Each stage function creates a channel, launches a goroutine that processes input and sends to the output channel, closes the output channel when done, and returns the output channel. Use `range` to read from input channels.

## Solution

```go
package main

import "fmt"

func generator(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}

func doubler(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * 2
        }
        close(out)
    }()
    return out
}

func main() {
    gen := generator(1, 2, 3, 4, 5)
    doubled := doubler(gen)

    for val := range doubled {
        fmt.Println(val)
    }
}
```
