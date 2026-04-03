---
id: "go-udp"
courseId: "go-systems"
moduleId: "networking"
title: "UDP"
description: "Understand UDP communication and when to choose it over TCP for fast, connectionless messaging."
order: 3
---

## Scenario

Your TCP tunnel works great for reliable connections, but now you want to add DNS resolution to it — so clients can use domain names instead of raw IP addresses. DNS uses UDP because it's fast. A DNS lookup is a single question-and-answer exchange: "What's the IP for example.com?" "It's 93.184.216.34." There's no need for TCP's connection setup, ordering guarantees, or teardown. The overhead would triple the lookup time.

Building a DNS forwarder means understanding UDP: how to send and receive packets without establishing a connection, and why that trade-off makes sense for certain protocols.

## Content

## UDP

UDP (User Datagram Protocol) is TCP's simpler sibling. No connection handshake, no guaranteed delivery, no ordering. You send a packet and hope it arrives. In exchange, you get lower latency and less overhead — which is exactly what protocols like DNS, game servers, and video streaming need.

### UDP vs TCP Trade-offs

| Feature | TCP | UDP |
|---------|-----|-----|
| Connection | Requires handshake | Connectionless |
| Delivery | Guaranteed, ordered | Best-effort, unordered |
| Overhead | Higher (headers, ACKs) | Lower (minimal headers) |
| Use cases | HTTP, file transfer, tunnels | DNS, gaming, streaming |

TCP gives you a reliable stream. UDP gives you raw packets. Choose based on whether you need reliability or speed.

### Listening for UDP Packets

UDP doesn't have connections, so instead of `net.Listen` and `Accept`, you use `net.ListenPacket`:

```go
package main

import (
    "fmt"
    "log"
    "net"
)

func main() {
    // Listen for UDP packets on port 8053
    pc, err := net.ListenPacket("udp", ":8053")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }
    defer pc.Close()
    fmt.Println("UDP server listening on :8053")

    buf := make([]byte, 1024)
    for {
        // ReadFrom returns the data, its length, and the sender's address
        n, addr, err := pc.ReadFrom(buf)
        if err != nil {
            log.Printf("read error: %v", err)
            continue
        }
        fmt.Printf("received %d bytes from %s: %s\n", n, addr, string(buf[:n]))

        // Send a response back to the sender
        response := []byte("ACK")
        _, err = pc.WriteTo(response, addr)
        if err != nil {
            log.Printf("write error: %v", err)
        }
    }
}
```

Key differences from TCP: there's no `Accept()` because there are no connections. `ReadFrom` returns both the data and the sender's address, which you need to send a response back. Each `ReadFrom` gives you exactly one packet.

### Sending UDP Packets

On the client side, you can use `net.Dial("udp", ...)` for a "connected" UDP socket that always sends to the same address:

```go
conn, err := net.Dial("udp", "localhost:8053")
if err != nil {
    log.Fatalf("failed to dial: %v", err)
}
defer conn.Close()

// Send a packet
_, err = conn.Write([]byte("hello"))
if err != nil {
    log.Fatalf("write failed: %v", err)
}

// Read the response
buf := make([]byte, 1024)
n, err := conn.Read(buf)
if err != nil {
    log.Fatalf("read failed: %v", err)
}
fmt.Printf("response: %s\n", string(buf[:n]))
```

Note that `net.Dial("udp", ...)` doesn't actually send anything over the network — it just sets the default destination. The "connection" is purely local bookkeeping.

### Working with net.UDPConn

For more control, use `net.ListenUDP` which returns a `*net.UDPConn`:

```go
addr, err := net.ResolveUDPAddr("udp", ":8053")
if err != nil {
    log.Fatalf("failed to resolve: %v", err)
}

conn, err := net.ListenUDP("udp", addr)
if err != nil {
    log.Fatalf("failed to listen: %v", err)
}
defer conn.Close()

buf := make([]byte, 65535) // Max UDP packet size
n, remoteAddr, err := conn.ReadFromUDP(buf)
if err != nil {
    log.Fatalf("read failed: %v", err)
}

fmt.Printf("from %s: %s\n", remoteAddr, string(buf[:n]))

// Respond
_, err = conn.WriteToUDP([]byte("reply"), remoteAddr)
```

`net.UDPConn` gives you UDP-specific methods like `ReadFromUDP` and `WriteToUDP` that return `*net.UDPAddr` instead of the generic `net.Addr` interface.

### Handling Packet Loss

UDP doesn't guarantee delivery. If you need reliability on top of UDP, you implement it yourself:

```go
func sendWithRetry(conn net.Conn, data []byte, maxRetries int) error {
    for attempt := 0; attempt < maxRetries; attempt++ {
        _, err := conn.Write(data)
        if err != nil {
            return fmt.Errorf("write failed: %w", err)
        }

        // Set a short deadline for the ACK
        conn.SetReadDeadline(time.Now().Add(2 * time.Second))

        buf := make([]byte, 64)
        _, err = conn.Read(buf)
        if err == nil {
            return nil // Got an ACK
        }

        // Timeout — packet might have been lost, retry
        if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
            fmt.Printf("attempt %d timed out, retrying...\n", attempt+1)
            continue
        }
        return err
    }
    return fmt.Errorf("no response after %d attempts", maxRetries)
}
```

This is essentially what protocols like QUIC do — build reliability on top of UDP while keeping the flexibility to optimize for their specific use case.

## Why It Matters

Not everything needs TCP's guarantees. DNS lookups, metrics collection, log shipping, service discovery, and real-time communication all use UDP because speed matters more than guaranteed delivery. Understanding UDP lets you choose the right transport for your protocol. When you build your DNS forwarder or add service discovery to your tunnel, UDP is the natural choice. Many modern protocols like QUIC (which powers HTTP/3) are built on UDP precisely because TCP's guarantees come with overhead that these protocols can handle more efficiently themselves.

## Questions

Q: What does net.ListenPacket return that net.Listen does not?
A) A TCP connection
B) A packet-based interface where each read gets one complete packet and the sender's address
C) An encrypted connection
D) A connection with guaranteed delivery
Correct: B

Q: What happens when you call net.Dial("udp", "localhost:8053")?
A) A TCP handshake is performed
B) A UDP packet is sent to localhost:8053
C) No network traffic occurs — it only sets the default destination address locally
D) The connection blocks until the server responds
Correct: C

Q: Why does DNS use UDP instead of TCP?
A) UDP is more secure than TCP
B) DNS queries are small request-response exchanges where TCP's connection overhead would be wasteful
C) UDP supports larger packet sizes than TCP
D) TCP cannot handle DNS packets
Correct: B

## Challenge

Build a UDP echo server that listens on port 8053. It should receive a message, print it, prepend "ECHO: " to it, and send the modified message back to the sender.

## Starter Code

```go
package main

import (
    "fmt"
    "log"
    "net"
)

func main() {
    // Listen for UDP packets on port 8053

    // Read a packet

    // Print the received message

    // Send back "ECHO: " + message

}
```

## Expected Output

```
UDP server listening on :8053
received from 127.0.0.1:54321: hello
sent response: ECHO: hello
```

## Hint

Use `net.ListenPacket("udp", ":8053")` to start listening. `ReadFrom` gives you the data and the sender's address. Prepend "ECHO: " to the received message and use `WriteTo` to send it back to the same address.

## Solution

```go
package main

import (
    "fmt"
    "log"
    "net"
)

func main() {
    pc, err := net.ListenPacket("udp", ":8053")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }
    defer pc.Close()
    fmt.Println("UDP server listening on :8053")

    buf := make([]byte, 1024)
    n, addr, err := pc.ReadFrom(buf)
    if err != nil {
        log.Fatalf("read failed: %v", err)
    }

    message := string(buf[:n])
    fmt.Printf("received from %s: %s\n", addr, message)

    response := "ECHO: " + message
    _, err = pc.WriteTo([]byte(response), addr)
    if err != nil {
        log.Fatalf("write failed: %v", err)
    }
    fmt.Printf("sent response: %s\n", response)
}
```
