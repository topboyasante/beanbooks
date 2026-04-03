---
id: "go-tcp-server"
courseId: "go-systems"
moduleId: "networking"
title: "TCP Server"
description: "Build a TCP server that listens for connections and handles multiple clients concurrently."
order: 1
---

## Scenario

You're building the server-side component of your TCP tunnel. This is the public-facing endpoint that clients connect to — it listens on a port, accepts incoming connections, and handles each one in its own goroutine. If this server can't handle concurrent connections cleanly, your tunnel is useless. A single slow client would block everyone else.

Your tunnel server needs to accept connections reliably, read data from each client, and respond without leaking resources. Every connection that isn't properly closed is a file descriptor leak that will eventually crash your server under load.

## Content

## TCP Server

Go's `net` package gives you everything you need to build production-grade TCP servers. The core pattern is simple: listen on a port, accept connections in a loop, and hand each connection to a goroutine.

### Listening for Connections

The entry point is `net.Listen`, which binds to an address and returns a `net.Listener`:

```go
package main

import (
    "fmt"
    "net"
    "log"
)

func main() {
    // Listen on TCP port 9000 on all interfaces
    listener, err := net.Listen("tcp", ":9000")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }
    defer listener.Close()

    fmt.Println("Server listening on :9000")
}
```

The address format is `"host:port"`. Using `":9000"` (empty host) listens on all network interfaces. You can also bind to a specific IP like `"127.0.0.1:9000"` to only accept local connections.

### Accepting Connections

`listener.Accept()` blocks until a client connects, then returns a `net.Conn`:

```go
for {
    conn, err := listener.Accept()
    if err != nil {
        log.Printf("failed to accept: %v", err)
        continue
    }
    fmt.Printf("client connected: %s\n", conn.RemoteAddr())
    go handleConnection(conn)
}
```

Each call to `Accept()` returns one connection. The `for` loop ensures the server keeps accepting new clients. The `go` keyword launches `handleConnection` in a goroutine so the server immediately returns to accepting the next connection.

### Handling Client Connections

The `net.Conn` interface provides `Read`, `Write`, and `Close` methods. Here's a handler that echoes data back to the client:

```go
func handleConnection(conn net.Conn) {
    defer conn.Close()

    buf := make([]byte, 1024)
    for {
        n, err := conn.Read(buf)
        if err != nil {
            if err.Error() == "EOF" {
                fmt.Printf("client disconnected: %s\n", conn.RemoteAddr())
            } else {
                log.Printf("read error: %v", err)
            }
            return
        }

        message := string(buf[:n])
        fmt.Printf("received from %s: %s", conn.RemoteAddr(), message)

        // Echo the data back
        _, err = conn.Write(buf[:n])
        if err != nil {
            log.Printf("write error: %v", err)
            return
        }
    }
}
```

Critical detail: `conn.Read(buf)` returns the number of bytes read `n`. You must use `buf[:n]` — not the full buffer — or you'll process garbage data from previous reads.

### The defer conn.Close() Pattern

`defer conn.Close()` is non-negotiable in server code. Without it, a panic or early return leaks the connection's file descriptor:

```go
func handleConnection(conn net.Conn) {
    defer conn.Close() // Always first line after receiving conn

    // If anything below panics or returns early,
    // the connection is still properly closed.

    // ... handle the connection
}
```

Each open TCP connection consumes a file descriptor. Most systems default to a limit of 1024. Leak enough connections and your server stops accepting new ones with "too many open files" errors.

### Putting It All Together

A complete echo server:

```go
package main

import (
    "fmt"
    "io"
    "log"
    "net"
)

func handleConnection(conn net.Conn) {
    defer conn.Close()
    fmt.Printf("client connected: %s\n", conn.RemoteAddr())

    buf := make([]byte, 4096)
    for {
        n, err := conn.Read(buf)
        if err != nil {
            if err != io.EOF {
                log.Printf("read error from %s: %v", conn.RemoteAddr(), err)
            }
            return
        }
        _, writeErr := conn.Write(buf[:n])
        if writeErr != nil {
            log.Printf("write error to %s: %v", conn.RemoteAddr(), writeErr)
            return
        }
    }
}

func main() {
    listener, err := net.Listen("tcp", ":9000")
    if err != nil {
        log.Fatalf("failed to start server: %v", err)
    }
    defer listener.Close()
    fmt.Println("echo server listening on :9000")

    for {
        conn, err := listener.Accept()
        if err != nil {
            log.Printf("accept error: %v", err)
            continue
        }
        go handleConnection(conn)
    }
}
```

## Why It Matters

Every networked system — databases, web servers, message brokers, your TCP tunnel — starts with this pattern: listen, accept, handle. Understanding how `net.Listen` and `net.Conn` work at this level means you can debug connection issues, understand why your server is leaking file descriptors, and build custom protocols that `net/http` doesn't support. When you eventually use higher-level frameworks, you'll know exactly what they're doing underneath.

## Questions

Q: What does net.Listen("tcp", ":9000") do?
A) Connects to a server running on port 9000
B) Binds to port 9000 and waits for incoming TCP connections
C) Sends data to port 9000
D) Creates a UDP socket on port 9000
Correct: B

Q: Why is defer conn.Close() critical in a connection handler?
A) It makes the connection faster
B) It encrypts the connection
C) It ensures the connection is closed even if the handler panics or returns early
D) It prevents the client from disconnecting
Correct: C

Q: What happens if you use buf instead of buf[:n] after conn.Read(buf)?
A) The program won't compile
B) You'll process stale data from previous reads along with the new data
C) The buffer will automatically resize
D) The connection will be reset
Correct: B

## Challenge

Build a TCP server that listens on port 9000, accepts a single connection, reads a message from the client, converts it to uppercase, and sends it back. Print both the original and uppercased messages.

## Starter Code

```go
package main

import (
    "fmt"
    "log"
    "net"
    "strings"
)

func main() {
    // Start listening on port 9000

    // Accept one connection

    // Read the message

    // Convert to uppercase and send back

}
```

## Expected Output

```
server listening on :9000
received: hello tunnel
sent: HELLO TUNNEL
```

## Hint

Use `net.Listen("tcp", ":9000")` to start the server, then `listener.Accept()` to get a connection. Read into a byte slice with `conn.Read(buf)`, convert to uppercase with `strings.ToUpper()`, and write the result back with `conn.Write()`.

## Solution

```go
package main

import (
    "fmt"
    "log"
    "net"
    "strings"
)

func main() {
    listener, err := net.Listen("tcp", ":9000")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }
    defer listener.Close()
    fmt.Println("server listening on :9000")

    conn, err := listener.Accept()
    if err != nil {
        log.Fatalf("failed to accept: %v", err)
    }
    defer conn.Close()

    buf := make([]byte, 1024)
    n, err := conn.Read(buf)
    if err != nil {
        log.Fatalf("failed to read: %v", err)
    }

    original := strings.TrimSpace(string(buf[:n]))
    fmt.Printf("received: %s\n", original)

    upper := strings.ToUpper(original)
    _, err = conn.Write([]byte(upper))
    if err != nil {
        log.Fatalf("failed to write: %v", err)
    }
    fmt.Printf("sent: %s\n", upper)
}
```
