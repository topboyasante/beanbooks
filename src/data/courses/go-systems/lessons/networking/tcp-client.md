---
id: "go-tcp-client"
courseId: "go-systems"
moduleId: "networking"
title: "TCP Client"
description: "Build a TCP client that connects to servers with timeouts and reconnection logic."
order: 2
---

## Scenario

Your TCP tunnel has a server running on a public endpoint. Now you need the client-side — the component that runs on a developer's machine, connects to the tunnel server, and forwards local traffic through it. The client needs to handle real-world network conditions: the server might be slow to respond, the connection might drop, and you need to reconnect automatically without losing data.

A naive client that just calls `net.Dial` and hopes for the best will fail in production. Network connections drop. Servers restart. Firewalls kill idle connections. Your client needs timeouts and reconnection logic.

## Content

## TCP Client

Go's `net.Dial` is the client-side counterpart to `net.Listen`. It establishes a TCP connection to a remote server and returns a `net.Conn` — the same interface the server uses.

### Connecting with net.Dial

The simplest way to connect:

```go
package main

import (
    "fmt"
    "log"
    "net"
)

func main() {
    conn, err := net.Dial("tcp", "localhost:9000")
    if err != nil {
        log.Fatalf("failed to connect: %v", err)
    }
    defer conn.Close()

    fmt.Printf("connected to %s\n", conn.RemoteAddr())
}
```

`net.Dial("tcp", "address:port")` performs a DNS lookup (if needed), establishes a TCP handshake, and returns a ready-to-use connection. The problem: it can hang indefinitely if the server is unreachable.

### Connection Timeouts with net.DialTimeout

For production code, always use `net.DialTimeout`:

```go
conn, err := net.DialTimeout("tcp", "localhost:9000", 5*time.Second)
if err != nil {
    if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
        log.Println("connection timed out")
    } else {
        log.Printf("connection failed: %v", err)
    }
    return
}
defer conn.Close()
```

This gives the connection 5 seconds to complete. If the server doesn't respond, you get a timeout error instead of hanging forever. You can check if the error is specifically a timeout by type-asserting to `net.Error`.

### Sending and Receiving Data

`net.Conn` implements both `io.Reader` and `io.Writer`. Sending and receiving data uses `Write` and `Read`:

```go
// Send a message
message := "CONNECT localhost:3000\n"
_, err := conn.Write([]byte(message))
if err != nil {
    log.Fatalf("write failed: %v", err)
}

// Read the response
buf := make([]byte, 1024)
n, err := conn.Read(buf)
if err != nil {
    log.Fatalf("read failed: %v", err)
}
response := string(buf[:n])
fmt.Printf("server responded: %s\n", response)
```

Important: `conn.Read` may return fewer bytes than you expect. TCP is a stream protocol — data arrives in chunks. If you're expecting a 500-byte response, a single `Read` might return 200 bytes, then another `Read` returns the remaining 300.

### Read and Write Deadlines

Beyond connection timeouts, you need deadlines for individual read/write operations:

```go
// Set a 10-second deadline for reading
conn.SetReadDeadline(time.Now().Add(10 * time.Second))
n, err := conn.Read(buf)
if err != nil {
    if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
        fmt.Println("read timed out — server too slow")
    }
    return
}

// Set a deadline for writing
conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
_, err = conn.Write(data)

// Set both at once
conn.SetDeadline(time.Now().Add(30 * time.Second))
```

Deadlines are absolute times, not durations. You must reset them before each operation if you want a fresh timeout. To clear a deadline, pass `time.Time{}` (the zero value).

### Reconnection Logic

Production clients need automatic reconnection. Here's a pattern with exponential backoff:

```go
func connectWithRetry(address string, maxRetries int) (net.Conn, error) {
    var conn net.Conn
    var err error
    backoff := 1 * time.Second

    for attempt := 0; attempt < maxRetries; attempt++ {
        conn, err = net.DialTimeout("tcp", address, 5*time.Second)
        if err == nil {
            fmt.Printf("connected on attempt %d\n", attempt+1)
            return conn, nil
        }

        fmt.Printf("attempt %d failed: %v, retrying in %v\n",
            attempt+1, err, backoff)
        time.Sleep(backoff)
        backoff *= 2 // Double the wait time each retry
        if backoff > 30*time.Second {
            backoff = 30 * time.Second // Cap at 30 seconds
        }
    }

    return nil, fmt.Errorf("failed after %d attempts: %w", maxRetries, err)
}
```

Exponential backoff prevents hammering a struggling server with reconnection attempts. Capping the backoff at 30 seconds means you'll still reconnect reasonably quickly once the server recovers.

## Why It Matters

The client side of any networked system needs to handle the reality that networks are unreliable. Timeouts prevent your program from hanging when a server is unreachable. Reconnection logic keeps your tunnel alive through server restarts and network blips. The `net.Conn` interface you learn here is the same one used by database drivers, HTTP clients, and gRPC — mastering it at the TCP level means you understand what every higher-level networking library is doing underneath.

## Questions

Q: What is the difference between net.Dial and net.DialTimeout?
A) net.Dial uses UDP, net.DialTimeout uses TCP
B) net.DialTimeout allows you to specify a maximum connection time
C) net.Dial is faster because it skips the TCP handshake
D) net.DialTimeout only works with localhost connections
Correct: B

Q: Why must you reset SetReadDeadline before each read operation?
A) The deadline is automatically cleared after each read
B) Deadlines are absolute times, not durations, so the old deadline may have already passed
C) The compiler requires it
D) Each read creates a new connection internally
Correct: B

Q: What is the purpose of exponential backoff in reconnection logic?
A) To make the connection faster
B) To encrypt the retry attempts
C) To avoid overwhelming a struggling server with rapid reconnection attempts
D) To increase the buffer size with each retry
Correct: C

## Challenge

Build a TCP client that connects to localhost:9000 with a 3-second timeout. Send the message "PING", read the response, and print it. If the connection fails, retry up to 3 times with a 1-second delay between retries.

## Starter Code

```go
package main

import (
    "fmt"
    "log"
    "net"
    "time"
)

func main() {
    // Connect with retry logic (up to 3 attempts)

    // Send "PING"

    // Read and print the response

}
```

## Expected Output

```
attempt 1: connecting to localhost:9000...
connected successfully
sent: PING
received: PONG
```

## Hint

Use `net.DialTimeout("tcp", "localhost:9000", 3*time.Second)` in a loop. After connecting, write `[]byte("PING")` and read the response into a buffer. Remember to `defer conn.Close()` after a successful connection.

## Solution

```go
package main

import (
    "fmt"
    "log"
    "net"
    "time"
)

func main() {
    var conn net.Conn
    var err error

    for attempt := 1; attempt <= 3; attempt++ {
        fmt.Printf("attempt %d: connecting to localhost:9000...\n", attempt)
        conn, err = net.DialTimeout("tcp", "localhost:9000", 3*time.Second)
        if err == nil {
            break
        }
        fmt.Printf("failed: %v\n", err)
        if attempt < 3 {
            time.Sleep(1 * time.Second)
        }
    }
    if err != nil {
        log.Fatalf("could not connect after 3 attempts: %v", err)
    }
    defer conn.Close()
    fmt.Println("connected successfully")

    message := "PING"
    _, err = conn.Write([]byte(message))
    if err != nil {
        log.Fatalf("write failed: %v", err)
    }
    fmt.Printf("sent: %s\n", message)

    buf := make([]byte, 1024)
    n, err := conn.Read(buf)
    if err != nil {
        log.Fatalf("read failed: %v", err)
    }
    fmt.Printf("received: %s\n", string(buf[:n]))
}
```
