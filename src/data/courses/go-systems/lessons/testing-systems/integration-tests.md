---
id: "go-integration-tests"
courseId: "go-systems"
moduleId: "testing-systems"
title: "Integration Tests"
description: "Test networked Go systems end-to-end using net.Pipe, httptest, build tags, and TestMain."
order: 4
---

## Scenario

All your unit tests pass. The wire protocol parser handles every edge case. The framing layer correctly splits messages. The connection pool manages idle timeouts. You deploy the tunnel to staging — and it immediately fails. The client connects, sends a handshake, and gets back garbage. The bug: your framing layer writes a 4-byte length prefix, but your protocol handler expects a 2-byte prefix. Each component was tested in isolation, but nobody tested them working together over a real TCP connection.

Integration tests bridge this gap. They wire up real components — actual TCP connections, actual protocol parsers, actual framing — and test the system as a whole. Unit tests verify that each piece works correctly. Integration tests verify that the pieces fit together.

## Content

## Integration Tests

### Testing with net.Pipe

`net.Pipe()` creates a synchronous, in-memory network connection — two `net.Conn` values connected to each other. It behaves exactly like a TCP connection but without the overhead of binding ports or network I/O. Perfect for testing protocol implementations.

```go
package tunnel

import (
    "encoding/binary"
    "io"
    "net"
    "testing"
)

func WriteMessage(conn net.Conn, msgType uint8, payload []byte) error {
    header := make([]byte, 5)
    header[0] = msgType
    binary.BigEndian.PutUint32(header[1:5], uint32(len(payload)))
    if _, err := conn.Write(header); err != nil {
        return err
    }
    _, err := conn.Write(payload)
    return err
}

func ReadMessage(conn net.Conn) (uint8, []byte, error) {
    header := make([]byte, 5)
    if _, err := io.ReadFull(conn, header); err != nil {
        return 0, nil, err
    }
    msgType := header[0]
    length := binary.BigEndian.Uint32(header[1:5])
    payload := make([]byte, length)
    if _, err := io.ReadFull(conn, payload); err != nil {
        return 0, nil, err
    }
    return msgType, payload, nil
}

func TestProtocolRoundTrip(t *testing.T) {
    client, server := net.Pipe()
    defer client.Close()
    defer server.Close()

    // Client sends a message
    go func() {
        err := WriteMessage(client, 0x01, []byte("hello server"))
        if err != nil {
            t.Errorf("write failed: %v", err)
        }
    }()

    // Server reads it
    msgType, payload, err := ReadMessage(server)
    if err != nil {
        t.Fatalf("read failed: %v", err)
    }
    if msgType != 0x01 {
        t.Errorf("type = 0x%02X, want 0x01", msgType)
    }
    if string(payload) != "hello server" {
        t.Errorf("payload = %q, want %q", payload, "hello server")
    }
}
```

### Testing HTTP Handlers with httptest

`net/http/httptest` provides a test HTTP server that starts on a random port. Use it to test HTTP handlers, middleware, and API endpoints without manual port management.

```go
package api

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
)

type StatusResponse struct {
    Status      string `json:"status"`
    Connections int    `json:"connections"`
}

func StatusHandler(w http.ResponseWriter, r *http.Request) {
    resp := StatusResponse{Status: "ok", Connections: 42}
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(resp)
}

func TestStatusHandler(t *testing.T) {
    // httptest.NewRequest creates a request without network I/O
    req := httptest.NewRequest("GET", "/api/status", nil)
    // httptest.NewRecorder captures the response
    rec := httptest.NewRecorder()

    StatusHandler(rec, req)

    // Check status code
    if rec.Code != http.StatusOK {
        t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
    }

    // Check response body
    var resp StatusResponse
    if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
        t.Fatalf("unmarshal: %v", err)
    }
    if resp.Status != "ok" {
        t.Errorf("status = %q, want %q", resp.Status, "ok")
    }
    if resp.Connections != 42 {
        t.Errorf("connections = %d, want %d", resp.Connections, 42)
    }
}

func TestStatusHandlerWithServer(t *testing.T) {
    // Start a real HTTP server on a random port
    srv := httptest.NewServer(http.HandlerFunc(StatusHandler))
    defer srv.Close()

    // Make a real HTTP request
    resp, err := http.Get(srv.URL + "/api/status")
    if err != nil {
        t.Fatalf("GET failed: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusOK)
    }

    var status StatusResponse
    json.NewDecoder(resp.Body).Decode(&status)
    if status.Status != "ok" {
        t.Errorf("status = %q, want %q", status.Status, "ok")
    }
}
```

### Build Tags for Integration Tests

Integration tests are slower than unit tests and may require external services. Use build tags to separate them so `go test` runs only unit tests by default.

```go
//go:build integration

package tunnel

import (
    "net"
    "testing"
    "time"
)

// Run with: go test -tags=integration -v ./...
// Without the tag, these tests are skipped.

func TestRealTCPConnection(t *testing.T) {
    // Start a listener on a random port
    ln, err := net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        t.Fatalf("listen: %v", err)
    }
    defer ln.Close()

    // Accept connections in a goroutine
    accepted := make(chan net.Conn, 1)
    go func() {
        conn, err := ln.Accept()
        if err != nil {
            return
        }
        accepted <- conn
    }()

    // Connect as a client
    client, err := net.DialTimeout("tcp", ln.Addr().String(), time.Second)
    if err != nil {
        t.Fatalf("dial: %v", err)
    }
    defer client.Close()

    // Get the server-side connection
    server := <-accepted
    defer server.Close()

    // Now test protocol over a real TCP connection
    _, err = client.Write([]byte("ping"))
    if err != nil {
        t.Fatalf("write: %v", err)
    }

    buf := make([]byte, 4)
    n, err := server.Read(buf)
    if err != nil {
        t.Fatalf("read: %v", err)
    }
    if string(buf[:n]) != "ping" {
        t.Errorf("got %q, want %q", string(buf[:n]), "ping")
    }
}
```

### TestMain for Setup and Teardown

`TestMain` is a special function that controls the test lifecycle. Use it to start services, initialize databases, or set up test infrastructure before any tests run.

```go
package tunnel

import (
    "fmt"
    "net"
    "os"
    "testing"
)

var testListener net.Listener

func TestMain(m *testing.M) {
    // Setup: start a test server
    var err error
    testListener, err = net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        fmt.Fprintf(os.Stderr, "setup failed: %v\n", err)
        os.Exit(1)
    }
    fmt.Printf("Test server listening on %s\n", testListener.Addr())

    // Accept connections in background
    go func() {
        for {
            conn, err := testListener.Accept()
            if err != nil {
                return
            }
            // Echo server for testing
            go func(c net.Conn) {
                defer c.Close()
                buf := make([]byte, 1024)
                for {
                    n, err := c.Read(buf)
                    if err != nil {
                        return
                    }
                    c.Write(buf[:n])
                }
            }(conn)
        }
    }()

    // Run all tests
    exitCode := m.Run()

    // Teardown: stop the test server
    testListener.Close()
    fmt.Println("Test server stopped.")

    os.Exit(exitCode)
}

func TestEcho(t *testing.T) {
    conn, err := net.Dial("tcp", testListener.Addr().String())
    if err != nil {
        t.Fatalf("dial: %v", err)
    }
    defer conn.Close()

    _, err = conn.Write([]byte("hello"))
    if err != nil {
        t.Fatalf("write: %v", err)
    }

    buf := make([]byte, 5)
    n, err := conn.Read(buf)
    if err != nil {
        t.Fatalf("read: %v", err)
    }
    if string(buf[:n]) != "hello" {
        t.Errorf("echo = %q, want %q", string(buf[:n]), "hello")
    }
}
```

### Testing Concurrent Protocol Interactions

The real value of integration tests is testing concurrent behavior that unit tests can't catch — multiple clients, interleaved messages, connection drops mid-stream.

```go
package tunnel

import (
    "fmt"
    "net"
    "sync"
    "testing"
    "time"
)

func TestConcurrentClients(t *testing.T) {
    // Start echo server
    ln, err := net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        t.Fatal(err)
    }
    defer ln.Close()

    go func() {
        for {
            conn, err := ln.Accept()
            if err != nil {
                return
            }
            go func(c net.Conn) {
                defer c.Close()
                buf := make([]byte, 1024)
                for {
                    n, err := c.Read(buf)
                    if err != nil {
                        return
                    }
                    c.Write(buf[:n])
                }
            }(conn)
        }
    }()

    // 10 concurrent clients
    var wg sync.WaitGroup
    errors := make(chan error, 10)

    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func(clientID int) {
            defer wg.Done()

            conn, err := net.DialTimeout("tcp", ln.Addr().String(), time.Second)
            if err != nil {
                errors <- fmt.Errorf("client %d dial: %w", clientID, err)
                return
            }
            defer conn.Close()

            msg := fmt.Sprintf("hello from client %d", clientID)
            conn.Write([]byte(msg))

            buf := make([]byte, 64)
            n, err := conn.Read(buf)
            if err != nil {
                errors <- fmt.Errorf("client %d read: %w", clientID, err)
                return
            }
            if string(buf[:n]) != msg {
                errors <- fmt.Errorf("client %d: got %q, want %q", clientID, string(buf[:n]), msg)
            }
        }(i)
    }

    wg.Wait()
    close(errors)

    for err := range errors {
        t.Error(err)
    }
}
```

## Why It Matters

Unit tests tell you that individual components work. Integration tests tell you that the system works. In networked systems, the boundary between components — the protocol layer, the framing layer, the connection management — is where most bugs live. A parser that works on a `[]byte` might fail on a real TCP stream due to partial reads. A server that handles one connection might deadlock with ten. Integration tests catch these bugs before production does. They're slower to run and harder to write, but they test what actually matters: does the system work end-to-end?

## Questions

Q: What is the advantage of `net.Pipe()` over a real TCP listener for tests?
A) net.Pipe supports UDP
B) It creates an in-memory connection without needing a port, making tests faster and avoiding port conflicts
C) It automatically tests race conditions
D) It encrypts the connection
Correct: B

Q: What is the purpose of build tags like `//go:build integration`?
A) To make tests run faster
B) To separate slow integration tests from fast unit tests so they only run when explicitly requested
C) To enable the race detector
D) To run tests in parallel
Correct: B

Q: What does `TestMain` allow you to do that regular test functions cannot?
A) Run tests in parallel
B) Perform global setup and teardown before and after all tests in a package
C) Skip individual tests
D) Benchmark code
Correct: B

## Challenge

Write an integration test that starts a TCP echo server, connects a client, sends "ping", reads back the response, and asserts it equals "ping". Use `net.Listen` with address `"127.0.0.1:0"` for a random port.

## Starter Code

```go
package main

import (
    "net"
    "testing"
)

func startEchoServer(t *testing.T) net.Listener {
    t.Helper()
    // TODO: listen on 127.0.0.1:0, accept connections, echo data back
    return nil
}

func TestEchoIntegration(t *testing.T) {
    ln := startEchoServer(t)
    defer ln.Close()

    // TODO: dial the server, send "ping", read response, assert "ping"
}
```

## Expected Output

```
=== RUN   TestEchoIntegration
--- PASS: TestEchoIntegration (0.00s)
```

## Hint

In `startEchoServer`, call `net.Listen("tcp", "127.0.0.1:0")`, then start a goroutine that accepts and echoes. In the test, use `net.Dial("tcp", ln.Addr().String())` to connect. Use `io.ReadFull` or a simple `conn.Read` to get the response.

## Solution

```go
package main

import (
    "io"
    "net"
    "testing"
    "time"
)

func startEchoServer(t *testing.T) net.Listener {
    t.Helper()
    ln, err := net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        t.Fatalf("listen: %v", err)
    }
    go func() {
        for {
            conn, err := ln.Accept()
            if err != nil {
                return
            }
            go func(c net.Conn) {
                defer c.Close()
                io.Copy(c, c) // echo
            }(conn)
        }
    }()
    return ln
}

func TestEchoIntegration(t *testing.T) {
    ln := startEchoServer(t)
    defer ln.Close()

    conn, err := net.DialTimeout("tcp", ln.Addr().String(), time.Second)
    if err != nil {
        t.Fatalf("dial: %v", err)
    }
    defer conn.Close()

    _, err = conn.Write([]byte("ping"))
    if err != nil {
        t.Fatalf("write: %v", err)
    }

    buf := make([]byte, 4)
    _, err = io.ReadFull(conn, buf)
    if err != nil {
        t.Fatalf("read: %v", err)
    }

    if string(buf) != "ping" {
        t.Errorf("got %q, want %q", string(buf), "ping")
    }
}
```
