---
id: "go-error-handling"
courseId: "go-systems"
moduleId: "go-fundamentals"
title: "Error Handling"
description: "Handle network failures gracefully with Go's explicit error model — wrapping, inspection, and recovery."
order: 5
---

## Scenario

Your TCP tunnel is running in production. A client connects, but the upstream server is unreachable. The DNS lookup fails. A connection times out after 30 seconds. A read returns only half the expected data before the socket closes. Each of these failures is different, and your tunnel needs to handle each one appropriately — retry timeouts, report DNS failures to the user, and reassemble partial reads.

Go forces you to deal with errors explicitly. There are no hidden exceptions that silently unwind the stack. Every function that can fail returns an error, and you decide what to do with it at every call site.

## Content

## Error Handling

In Go, errors are values. The built-in `error` type is an interface with a single method:

```go
type error interface {
    Error() string
}
```

Functions that can fail return an `error` as their last return value. `nil` means success.

### The Error Check Pattern

This is the most common pattern in Go code:

```go
conn, err := net.Dial("tcp", "10.0.0.1:8080")
if err != nil {
    log.Printf("connection failed: %v", err)
    return err
}
// use conn
```

You'll write this pattern hundreds of times. It's verbose by design — every error is handled at the point it occurs, making control flow explicit and debuggable.

### Error Wrapping with fmt.Errorf

When you propagate an error up the call stack, add context so the final error message tells the full story:

```go
func connectToUpstream(addr string) (net.Conn, error) {
    conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
    if err != nil {
        return nil, fmt.Errorf("upstream connection to %s: %w", addr, err)
    }
    return conn, nil
}

func setupTunnel(localPort int, remoteAddr string) error {
    upstream, err := connectToUpstream(remoteAddr)
    if err != nil {
        return fmt.Errorf("tunnel setup on port %d: %w", localPort, err)
    }
    defer upstream.Close()
    // ...
    return nil
}
```

The `%w` verb wraps the original error so it can be unwrapped later. This builds an error chain:

```
tunnel setup on port 8080: upstream connection to 10.0.0.1:9090: dial tcp 10.0.0.1:9090: connection refused
```

### Inspecting Errors with errors.Is and errors.As

`errors.Is` checks if any error in the chain matches a target value:

```go
import (
    "errors"
    "os"
)

_, err := os.Open("/etc/tunnel.conf")
if errors.Is(err, os.ErrNotExist) {
    fmt.Println("config file not found, using defaults")
} else if err != nil {
    return fmt.Errorf("reading config: %w", err)
}
```

`errors.As` extracts a specific error type from the chain:

```go
var netErr *net.OpError
if errors.As(err, &netErr) {
    fmt.Printf("network op %s failed on %s: %v\n",
        netErr.Op, netErr.Addr, netErr.Err)
    if netErr.Timeout() {
        fmt.Println("this was a timeout — consider retrying")
    }
}
```

Never use `err.(*net.OpError)` directly — it doesn't unwrap the chain. Always use `errors.As`.

### Custom Error Types

For errors that carry structured data beyond a string message, define your own error type:

```go
type ConnectionError struct {
    RemoteAddr string
    Operation  string
    Retryable  bool
    Err        error
}

func (e *ConnectionError) Error() string {
    retry := ""
    if e.Retryable {
        retry = " (retryable)"
    }
    return fmt.Sprintf("%s on %s: %v%s", e.Operation, e.RemoteAddr, e.Err, retry)
}

func (e *ConnectionError) Unwrap() error {
    return e.Err
}
```

The `Unwrap` method lets `errors.Is` and `errors.As` walk through your custom error to find wrapped errors inside.

```go
func dialWithRetry(addr string) (net.Conn, error) {
    conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
    if err != nil {
        var netErr *net.OpError
        retryable := errors.As(err, &netErr) && netErr.Timeout()
        return nil, &ConnectionError{
            RemoteAddr: addr,
            Operation:  "dial",
            Retryable:  retryable,
            Err:        err,
        }
    }
    return conn, nil
}
```

### Sentinel Errors

Package-level error values (sentinels) represent specific, well-known conditions:

```go
var (
    ErrConnectionClosed = errors.New("connection closed")
    ErrBufferFull       = errors.New("buffer full")
    ErrTimeout          = errors.New("operation timed out")
)

func readPacket(conn net.Conn, buf []byte) (int, error) {
    if len(buf) == 0 {
        return 0, ErrBufferFull
    }
    conn.SetReadDeadline(time.Now().Add(10 * time.Second))
    n, err := conn.Read(buf)
    if err != nil {
        if errors.Is(err, os.ErrDeadlineExceeded) {
            return 0, ErrTimeout
        }
        return n, fmt.Errorf("reading packet: %w", err)
    }
    return n, nil
}
```

### Panic and Recover

`panic` stops normal execution and begins unwinding the stack. `recover` catches a panic inside a deferred function. Use these only for truly unrecoverable situations:

```go
// panic for programmer errors — things that should never happen
func mustParsePort(s string) uint16 {
    port, err := strconv.ParseUint(s, 10, 16)
    if err != nil {
        panic(fmt.Sprintf("invalid port: %s", s))
    }
    return uint16(port)
}

// recover to prevent a goroutine crash from taking down the server
func handleConnection(conn net.Conn) {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("recovered from panic in connection handler: %v", r)
        }
        conn.Close()
    }()
    // ... handle connection
}
```

The rule: use `error` for expected failures (network down, file missing, bad input). Use `panic` only for bugs — conditions that mean the program is broken, like an index out of range in code that should never allow it.

## Why It Matters

In systems programming, failures are not exceptions — they're the norm. Networks drop packets, disks fill up, processes get killed. Go's explicit error handling forces you to confront each failure mode at the point it occurs. Error wrapping builds a breadcrumb trail that makes debugging production issues possible: instead of a bare "connection refused," you see the full chain from the high-level operation down to the syscall. Custom error types let you attach structured data — is it retryable? what was the remote address? — so your retry logic can make intelligent decisions.

## Questions

Q: What does the `%w` verb do in `fmt.Errorf`?
A) Formats the error as a wide string
B) Wraps the error so it can be unwrapped with errors.Is/As
C) Converts the error to a warning
D) Writes the error to stderr
Correct: B

Q: When should you use `panic` instead of returning an error?
A) When the function has too many return values
B) For all network errors
C) For programmer errors that indicate a bug, not runtime failures
D) Whenever performance matters
Correct: C

Q: What is the purpose of the `Unwrap` method on a custom error type?
A) It removes the error from the error chain
B) It allows errors.Is and errors.As to traverse the error chain
C) It converts the error to a string
D) It recovers from a panic
Correct: B

## Challenge

Create a `ReadError` custom error type with fields for the operation name, bytes read, and the underlying error. Implement `Error()` and `Unwrap()`. Write a `readData` function that simulates a partial read failure and returns a `ReadError`. In `main`, use `errors.As` to extract and inspect the `ReadError`.

## Starter Code

```go
package main

import (
    "errors"
    "fmt"
)

// Define ReadError struct with Operation (string), BytesRead (int), Err (error)

// Implement Error() string

// Implement Unwrap() error

var ErrConnectionReset = errors.New("connection reset by peer")

func readData(size int) ([]byte, error) {
    // Simulate: read 512 bytes then fail with ErrConnectionReset
    // Return partial data and a ReadError wrapping ErrConnectionReset
}

func main() {
    data, err := readData(1024)
    if err != nil {
        var readErr *ReadError
        if errors.As(err, &readErr) {
            fmt.Printf("Operation: %s\n", readErr.Operation)
            fmt.Printf("Bytes read before failure: %d\n", readErr.BytesRead)
            fmt.Printf("Partial data length: %d\n", len(data))
        }
        if errors.Is(err, ErrConnectionReset) {
            fmt.Println("Cause: connection was reset")
        }
    }
}
```

## Expected Output

```
Operation: read
Bytes read before failure: 512
Partial data length: 512
Cause: connection was reset
```

## Hint

`ReadError` needs three fields and two methods. `Error()` returns a formatted string. `Unwrap()` returns the `Err` field. In `readData`, create a 512-byte slice as partial data and return it alongside `&ReadError{...}`.

## Solution

```go
package main

import (
    "errors"
    "fmt"
)

type ReadError struct {
    Operation string
    BytesRead int
    Err       error
}

func (e *ReadError) Error() string {
    return fmt.Sprintf("%s failed after %d bytes: %v", e.Operation, e.BytesRead, e.Err)
}

func (e *ReadError) Unwrap() error {
    return e.Err
}

var ErrConnectionReset = errors.New("connection reset by peer")

func readData(size int) ([]byte, error) {
    partial := make([]byte, 512)
    for i := range partial {
        partial[i] = 0xFF
    }
    return partial, &ReadError{
        Operation: "read",
        BytesRead: 512,
        Err:       ErrConnectionReset,
    }
}

func main() {
    data, err := readData(1024)
    if err != nil {
        var readErr *ReadError
        if errors.As(err, &readErr) {
            fmt.Printf("Operation: %s\n", readErr.Operation)
            fmt.Printf("Bytes read before failure: %d\n", readErr.BytesRead)
            fmt.Printf("Partial data length: %d\n", len(data))
        }
        if errors.Is(err, ErrConnectionReset) {
            fmt.Println("Cause: connection was reset")
        }
    }
}
```
