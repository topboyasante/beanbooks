---
id: "go-capstone"
courseId: "go-systems"
moduleId: "capstone"
title: "Capstone: TCP Relay Service"
description: "Bring it all together — build a complete TCP relay service with connection tracking, rate limiting, and metrics."
order: 1
---

## Scenario

You've learned goroutines, channels, TCP networking, wire protocols, framing, storage, connection pools, rate limiting, graceful shutdown, worker pools, and testing. Now it's time to combine them into a single, working system. You're going to build a TCP relay service — a simplified version of the tunnel you've been working toward throughout this course.

The relay accepts incoming TCP connections, routes them to a backend service based on a simple protocol, tracks active connections, enforces rate limits per client, collects metrics, and shuts down gracefully. It's not a toy — this is the architecture behind load balancers, reverse proxies, and service meshes used in production systems worldwide.

## Content

## Capstone: TCP Relay Service

### Architecture Overview

The relay service has five major components, each mapping to concepts you've learned:

```
                          ┌─────────────────────┐
   Clients ──TCP──►       │    TCP Listener      │
                          │  (Accept Loop)       │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │   Rate Limiter        │
                          │  (Per-client tokens)  │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Protocol Handler     │
                          │  (Framing + Parse)    │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Connection Tracker   │
                          │  (Metrics + State)    │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │   Backend Pool        │
                          │  (Relay to upstream)  │
                          └──────────────────────┘
```

Each component is a struct with a clear interface. They compose together in `main()`.

### Component 1: The Wire Protocol

Define a simple protocol for the relay. Every message has a header (version, type, length) and a payload. The client sends a `CONNECT` message with a target address, and the relay responds with `CONNECT_ACK` or `ERROR`.

```go
package main

import (
    "encoding/binary"
    "fmt"
    "io"
)

const (
    ProtoVersion = 1
    HeaderSize   = 8

    MsgConnect    uint8 = 0x01
    MsgConnectAck uint8 = 0x02
    MsgData       uint8 = 0x03
    MsgError      uint8 = 0x04
    MsgClose      uint8 = 0x05
)

type Header struct {
    Version uint8
    Type    uint8
    Flags   uint16
    Length  uint32
}

type Message struct {
    Header  Header
    Payload []byte
}

func WriteMessage(w io.Writer, msg Message) error {
    buf := make([]byte, HeaderSize)
    buf[0] = msg.Header.Version
    buf[1] = msg.Header.Type
    binary.BigEndian.PutUint16(buf[2:4], msg.Header.Flags)
    binary.BigEndian.PutUint32(buf[4:8], uint32(len(msg.Payload)))
    if _, err := w.Write(buf); err != nil {
        return err
    }
    if len(msg.Payload) > 0 {
        _, err := w.Write(msg.Payload)
        return err
    }
    return nil
}

func ReadMessage(r io.Reader) (Message, error) {
    hdr := make([]byte, HeaderSize)
    if _, err := io.ReadFull(r, hdr); err != nil {
        return Message{}, err
    }
    h := Header{
        Version: hdr[0],
        Type:    hdr[1],
        Flags:   binary.BigEndian.Uint16(hdr[2:4]),
        Length:  binary.BigEndian.Uint32(hdr[4:8]),
    }
    var payload []byte
    if h.Length > 0 {
        payload = make([]byte, h.Length)
        if _, err := io.ReadFull(r, payload); err != nil {
            return Message{}, err
        }
    }
    return Message{Header: h, Payload: payload}, nil
}

func NewMessage(msgType uint8, payload []byte) Message {
    return Message{
        Header: Header{
            Version: ProtoVersion,
            Type:    msgType,
            Length:  uint32(len(payload)),
        },
        Payload: payload,
    }
}

func main() {
    msg := NewMessage(MsgConnect, []byte("127.0.0.1:9090"))
    fmt.Printf("Message: type=0x%02X payload=%q\n", msg.Header.Type, msg.Payload)
}
```

### Component 2: Connection Tracker

Track active connections with a mutex-protected map. Provide methods to add, remove, and list connections, plus a count for metrics.

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type ConnInfo struct {
    ID        string
    ClientIP  string
    Target    string
    StartedAt time.Time
}

type Tracker struct {
    mu    sync.RWMutex
    conns map[string]ConnInfo
}

func NewTracker() *Tracker {
    return &Tracker{conns: make(map[string]ConnInfo)}
}

func (t *Tracker) Add(info ConnInfo) {
    t.mu.Lock()
    defer t.mu.Unlock()
    t.conns[info.ID] = info
}

func (t *Tracker) Remove(id string) {
    t.mu.Lock()
    defer t.mu.Unlock()
    delete(t.conns, id)
}

func (t *Tracker) Count() int {
    t.mu.RLock()
    defer t.mu.RUnlock()
    return len(t.conns)
}

func (t *Tracker) List() []ConnInfo {
    t.mu.RLock()
    defer t.mu.RUnlock()
    result := make([]ConnInfo, 0, len(t.conns))
    for _, c := range t.conns {
        result = append(result, c)
    }
    return result
}

func main() {
    tracker := NewTracker()
    tracker.Add(ConnInfo{ID: "c1", ClientIP: "10.0.0.1", Target: "api:8080", StartedAt: time.Now()})
    tracker.Add(ConnInfo{ID: "c2", ClientIP: "10.0.0.2", Target: "web:3000", StartedAt: time.Now()})
    fmt.Printf("Active connections: %d\n", tracker.Count())
    for _, c := range tracker.List() {
        fmt.Printf("  %s: %s -> %s\n", c.ID, c.ClientIP, c.Target)
    }
}
```

### Component 3: Rate Limiter Integration

Use a per-client rate limiter to reject connections from clients that exceed the limit. This protects the relay from abuse.

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type Bucket struct {
    tokens     float64
    max        float64
    rate       float64
    lastRefill time.Time
}

type RateLimiter struct {
    mu      sync.Mutex
    clients map[string]*Bucket
    rate    float64
    burst   float64
}

func NewRateLimiter(rate, burst float64) *RateLimiter {
    return &RateLimiter{
        clients: make(map[string]*Bucket),
        rate:    rate,
        burst:   burst,
    }
}

func (rl *RateLimiter) Allow(clientIP string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    b, ok := rl.clients[clientIP]
    if !ok {
        b = &Bucket{tokens: rl.burst, max: rl.burst, rate: rl.rate, lastRefill: time.Now()}
        rl.clients[clientIP] = b
    }

    now := time.Now()
    b.tokens += now.Sub(b.lastRefill).Seconds() * b.rate
    if b.tokens > b.max {
        b.tokens = b.max
    }
    b.lastRefill = now

    if b.tokens >= 1 {
        b.tokens--
        return true
    }
    return false
}

func main() {
    rl := NewRateLimiter(5, 3) // 5/sec, burst of 3
    for i := 0; i < 5; i++ {
        fmt.Printf("10.0.0.1 request %d: allowed=%v\n", i+1, rl.Allow("10.0.0.1"))
    }
}
```

### Component 4: The Relay Server

The server ties everything together: accept loop, rate limiting, protocol handling, connection tracking, and data relay.

```go
package main

import (
    "context"
    "fmt"
    "io"
    "net"
    "os/signal"
    "sync"
    "syscall"
)

type RelayServer struct {
    listener net.Listener
    tracker  *Tracker       // connection tracking
    limiter  *RateLimiter   // per-client rate limiting
    wg       sync.WaitGroup // tracks active connections
}

func (s *RelayServer) Serve(ctx context.Context) error {
    for {
        conn, err := s.listener.Accept()
        if err != nil {
            select {
            case <-ctx.Done():
                return nil // shutdown requested
            default:
                return err
            }
        }
        s.wg.Add(1)
        go s.handleConnection(ctx, conn)
    }
}

func (s *RelayServer) handleConnection(ctx context.Context, conn net.Conn) {
    defer s.wg.Done()
    defer conn.Close()

    clientIP := conn.RemoteAddr().String()

    // Rate limit check
    if !s.limiter.Allow(clientIP) {
        // Send error message and close
        fmt.Printf("[%s] rate limited\n", clientIP)
        return
    }

    // Read CONNECT message (simplified — reads target from payload)
    msg, err := ReadMessage(conn)
    if err != nil {
        return
    }
    if msg.Header.Type != MsgConnect {
        return
    }

    target := string(msg.Payload)
    connID := fmt.Sprintf("%s->%s", clientIP, target)

    // Track the connection
    s.tracker.Add(ConnInfo{ID: connID, ClientIP: clientIP, Target: target})
    defer s.tracker.Remove(connID)

    fmt.Printf("[%s] connected, relaying to %s (active: %d)\n",
        clientIP, target, s.tracker.Count())

    // Connect to backend
    backend, err := net.Dial("tcp", target)
    if err != nil {
        WriteMessage(conn, NewMessage(MsgError, []byte(err.Error())))
        return
    }
    defer backend.Close()

    // Send ACK
    WriteMessage(conn, NewMessage(MsgConnectAck, nil))

    // Bidirectional relay using goroutines
    done := make(chan struct{})
    go func() {
        io.Copy(backend, conn) // client -> backend
        done <- struct{}{}
    }()
    go func() {
        io.Copy(conn, backend) // backend -> client
        done <- struct{}{}
    }()

    // Wait for either direction to finish or context cancellation
    select {
    case <-done:
    case <-ctx.Done():
    }
}

func (s *RelayServer) Shutdown(ctx context.Context) {
    s.listener.Close() // stop accepting
    done := make(chan struct{})
    go func() {
        s.wg.Wait()
        close(done)
    }()
    select {
    case <-done:
        fmt.Println("All connections drained.")
    case <-ctx.Done():
        fmt.Println("Shutdown timeout — forcing exit.")
    }
}

func main() {
    ctx, stop := signal.NotifyContext(context.Background(),
        syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    fmt.Println("TCP Relay Service — Capstone Project")
    fmt.Println("Components: Protocol, Tracker, RateLimiter, GracefulShutdown")
    fmt.Println("Run the full implementation to start the relay server.")
}
```

### Component 5: Testing the System

Write integration tests that exercise the full stack: connect, send a protocol message, verify the response, test rate limiting, test concurrent connections.

```go
package main

import (
    "net"
    "sync"
    "testing"
)

func TestRelayProtocol(t *testing.T) {
    client, server := net.Pipe()
    defer client.Close()
    defer server.Close()

    // Client sends CONNECT
    go func() {
        msg := NewMessage(MsgConnect, []byte("127.0.0.1:9090"))
        WriteMessage(client, msg)
    }()

    // Server reads CONNECT
    msg, err := ReadMessage(server)
    if err != nil {
        t.Fatal(err)
    }
    if msg.Header.Type != MsgConnect {
        t.Errorf("type = 0x%02X, want 0x01", msg.Header.Type)
    }
    if string(msg.Payload) != "127.0.0.1:9090" {
        t.Errorf("target = %q, want %q", msg.Payload, "127.0.0.1:9090")
    }
}

func TestTrackerConcurrency(t *testing.T) {
    tracker := NewTracker()
    var wg sync.WaitGroup

    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            id := fmt.Sprintf("conn-%d", n)
            tracker.Add(ConnInfo{ID: id})
            tracker.Count()
            tracker.Remove(id)
        }(i)
    }
    wg.Wait()

    if tracker.Count() != 0 {
        t.Errorf("count = %d, want 0", tracker.Count())
    }
}

func TestRateLimiting(t *testing.T) {
    rl := NewRateLimiter(10, 3)
    allowed := 0
    for i := 0; i < 5; i++ {
        if rl.Allow("test-client") {
            allowed++
        }
    }
    if allowed != 3 {
        t.Errorf("allowed = %d, want 3 (burst size)", allowed)
    }
}
```

### Project Structure

Organize the capstone as a real Go project:

```
relay/
├── main.go              // entry point, signal handling, config
├── protocol.go          // Header, Message, Read/Write functions
├── tracker.go           // ConnInfo, Tracker
├── limiter.go           // RateLimiter
├── server.go            // RelayServer, Serve, Shutdown
├── server_test.go       // integration tests
├── protocol_test.go     // table-driven protocol tests
├── limiter_test.go      // rate limiter benchmarks + tests
└── go.mod
```

Each file is focused, testable, and small enough to understand at a glance. The `main.go` wires everything together.

## Why It Matters

Building a complete system from components you understand deeply is the difference between reading about engineering and doing engineering. Every concept in this course — goroutines for concurrent connection handling, channels for worker coordination, TCP for networking, binary encoding for the wire protocol, mutexes for shared state, rate limiting for protection, graceful shutdown for reliability, and tests for confidence — comes together in this project. This is the kind of system you build in production. The relay pattern is used in HAProxy, Envoy, Cloudflare Tunnel, and ngrok. You now have the foundation to understand, debug, and build systems at that level.

## Questions

Q: Why does the relay use a per-client rate limiter instead of a global one?
A) Per-client limiters use less memory
B) A global limiter would let one abusive client consume the entire rate limit, starving legitimate clients
C) Per-client limiters are easier to implement
D) Global limiters don't work with TCP
Correct: B

Q: In the bidirectional relay, why are two goroutines needed (one for each direction)?
A) Go requires it for TCP connections
B) Each direction of data flow (client-to-backend and backend-to-client) can block independently on `io.Copy`, so they must run concurrently
C) To double the throughput
D) To handle different protocols in each direction
Correct: B

Q: What is the correct shutdown order for the relay server?
A) Close backend connections, close client connections, close listener
B) Close listener (stop accepting), drain active connections, clean up resources
C) Send SIGKILL to all goroutines
D) Close the rate limiter first
Correct: B

## Challenge

Build a minimal version of the relay: a TCP server that accepts a connection, reads a 2-byte length-prefixed target address, connects to that target, sends back "OK", then relays data bidirectionally until either side closes. Test it with `net.Pipe` for both the client and a mock backend.

## Starter Code

```go
package main

import (
    "encoding/binary"
    "fmt"
    "io"
    "net"
)

func handleRelay(client net.Conn) {
    defer client.Close()

    // TODO: read 2-byte length prefix, then target address
    // TODO: dial the target
    // TODO: send "OK" back to client
    // TODO: relay data bidirectionally with io.Copy
}

func main() {
    ln, err := net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        panic(err)
    }
    defer ln.Close()
    fmt.Printf("Relay listening on %s\n", ln.Addr())

    for {
        conn, err := ln.Accept()
        if err != nil {
            return
        }
        go handleRelay(conn)
    }
}
```

## Expected Output

```
Relay listening on 127.0.0.1:XXXXX
Client sent: hello backend
Backend received: hello backend
Relay working correctly!
```

## Hint

Read 2 bytes for the address length, then read that many bytes for the address string. Use `net.Dial` to connect to the target. Send `"OK"` with `client.Write`. Then start two goroutines with `io.Copy` for bidirectional relay and wait for one to finish.

## Solution

```go
package main

import (
    "encoding/binary"
    "fmt"
    "io"
    "net"
    "time"
)

func handleRelay(client net.Conn) {
    defer client.Close()

    // Read target address (2-byte length prefix)
    lenBuf := make([]byte, 2)
    if _, err := io.ReadFull(client, lenBuf); err != nil {
        return
    }
    addrLen := binary.BigEndian.Uint16(lenBuf)
    addrBuf := make([]byte, addrLen)
    if _, err := io.ReadFull(client, addrBuf); err != nil {
        return
    }
    target := string(addrBuf)

    // Connect to backend
    backend, err := net.DialTimeout("tcp", target, 2*time.Second)
    if err != nil {
        client.Write([]byte("ERR"))
        return
    }
    defer backend.Close()

    // Send OK
    client.Write([]byte("OK"))

    // Bidirectional relay
    done := make(chan struct{})
    go func() {
        io.Copy(backend, client)
        done <- struct{}{}
    }()
    go func() {
        io.Copy(client, backend)
        done <- struct{}{}
    }()
    <-done
}

func main() {
    // Start a mock backend (echo server)
    backendLn, _ := net.Listen("tcp", "127.0.0.1:0")
    defer backendLn.Close()
    go func() {
        for {
            conn, err := backendLn.Accept()
            if err != nil {
                return
            }
            go func(c net.Conn) {
                defer c.Close()
                buf := make([]byte, 1024)
                n, _ := c.Read(buf)
                fmt.Printf("Backend received: %s\n", buf[:n])
                c.Write(buf[:n])
            }(conn)
        }
    }()

    // Start the relay
    relayLn, _ := net.Listen("tcp", "127.0.0.1:0")
    defer relayLn.Close()
    fmt.Printf("Relay listening on %s\n", relayLn.Addr())

    go func() {
        for {
            conn, err := relayLn.Accept()
            if err != nil {
                return
            }
            go handleRelay(conn)
        }
    }()

    // Client connects to relay, sends target, then data
    client, _ := net.Dial("tcp", relayLn.Addr().String())
    defer client.Close()

    // Send target address (length-prefixed)
    target := backendLn.Addr().String()
    header := make([]byte, 2)
    binary.BigEndian.PutUint16(header, uint16(len(target)))
    client.Write(header)
    client.Write([]byte(target))

    // Read OK
    ok := make([]byte, 2)
    io.ReadFull(client, ok)

    // Send data through relay
    msg := "hello backend"
    fmt.Printf("Client sent: %s\n", msg)
    client.Write([]byte(msg))

    // Read echoed response
    resp := make([]byte, len(msg))
    io.ReadFull(client, resp)

    if string(resp) == msg {
        fmt.Println("Relay working correctly!")
    }
}
```
