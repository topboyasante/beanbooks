---
id: "go-structs"
courseId: "go-systems"
moduleId: "go-fundamentals"
title: "Structs"
description: "Model real system state with Go structs — TCP connections, network peers, and protocol messages."
order: 3
---

## Scenario

Your TCP tunnel needs to track the state of every active connection: the source and destination addresses, how many bytes have been transferred in each direction, the connection status, and timestamps for when it opened and when the last data flowed through. A simple collection of variables won't scale — you need a structured type that groups all this state together and provides methods to operate on it.

Go doesn't have classes, but structs with methods give you everything you need to model complex system state cleanly and efficiently.

## Content

## Structs

A struct is a composite type that groups together fields of different types. It's the primary way to define custom data structures in Go.

### Declaring Structs

Define a struct type with the `type` keyword:

```go
type Connection struct {
    SourceIP   string
    SourcePort uint16
    DestIP     string
    DestPort   uint16
    BytesSent  int64
    BytesRecv  int64
    IsActive   bool
    OpenedAt   time.Time
}
```

Create instances using struct literals:

```go
// Named fields (preferred — order doesn't matter, clear at call site)
conn := Connection{
    SourceIP:   "192.168.1.10",
    SourcePort: 49152,
    DestIP:     "10.0.0.1",
    DestPort:   8080,
    IsActive:   true,
    OpenedAt:   time.Now(),
}

// Positional (fragile — breaks if you add fields)
conn2 := Connection{"192.168.1.10", 49152, "10.0.0.1", 8080, 0, 0, true, time.Now()}

// Zero value — all fields get their zero values
var conn3 Connection // IsActive is false, ports are 0, strings are ""
```

Access fields with dot notation:

```go
fmt.Printf("%s:%d -> %s:%d\n", conn.SourceIP, conn.SourcePort, conn.DestIP, conn.DestPort)
conn.BytesSent += 1024
```

### Methods: Value vs Pointer Receivers

Methods are functions attached to a type. The receiver determines whether the method gets a copy or a pointer to the struct:

```go
// Value receiver — gets a copy, cannot modify the original
func (c Connection) Summary() string {
    return fmt.Sprintf("%s:%d -> %s:%d [%d bytes sent]",
        c.SourceIP, c.SourcePort, c.DestIP, c.DestPort, c.BytesSent)
}

// Pointer receiver — gets a pointer, can modify the original
func (c *Connection) RecordBytes(sent, recv int64) {
    c.BytesSent += sent
    c.BytesRecv += recv
}

func (c *Connection) Close() {
    c.IsActive = false
}
```

Use pointer receivers when you need to modify the struct or when the struct is large (avoid copying). Use value receivers for small, read-only operations. As a rule of thumb: if any method needs a pointer receiver, make all methods use pointer receivers for consistency.

```go
conn := &Connection{
    SourceIP: "192.168.1.10",
    DestIP:   "10.0.0.1",
    DestPort: 8080,
    IsActive: true,
}

conn.RecordBytes(512, 128)
fmt.Println(conn.Summary())
conn.Close()
fmt.Println("Active:", conn.IsActive) // false
```

### Embedding and Composition

Go uses composition instead of inheritance. You embed one struct inside another to reuse its fields and methods:

```go
type NetAddr struct {
    IP   string
    Port uint16
}

func (a NetAddr) String() string {
    return fmt.Sprintf("%s:%d", a.IP, a.Port)
}

type TunnelConnection struct {
    Source    NetAddr
    Dest     NetAddr
    BytesSent int64
    BytesRecv int64
    IsActive  bool
}

func main() {
    tc := TunnelConnection{
        Source: NetAddr{IP: "192.168.1.10", Port: 49152},
        Dest:   NetAddr{IP: "10.0.0.1", Port: 8080},
        IsActive: true,
    }
    // Access nested fields
    fmt.Println(tc.Source.String()) // 192.168.1.10:49152
}
```

With anonymous embedding, the embedded type's fields and methods are promoted:

```go
type ConnectionStats struct {
    BytesSent int64
    BytesRecv int64
    PacketCount int
}

func (s *ConnectionStats) TotalBytes() int64 {
    return s.BytesSent + s.BytesRecv
}

type ManagedConnection struct {
    ConnectionStats // anonymous embed — fields are promoted
    Source   NetAddr
    Dest     NetAddr
    IsActive bool
}

func main() {
    mc := ManagedConnection{
        Source:   NetAddr{IP: "10.0.0.5", Port: 3000},
        Dest:     NetAddr{IP: "10.0.0.1", Port: 8080},
        IsActive: true,
    }
    mc.BytesSent = 2048  // promoted from ConnectionStats
    mc.PacketCount = 15
    fmt.Println(mc.TotalBytes()) // 2048 — method also promoted
}
```

### Struct Tags

Struct tags are string annotations attached to fields. They're used by packages like `encoding/json` and `encoding/binary` to control serialization:

```go
type PeerInfo struct {
    ID       string `json:"id"`
    Hostname string `json:"hostname"`
    Port     uint16 `json:"port"`
    Latency  int    `json:"latency_ms,omitempty"`
    Internal bool   `json:"-"` // excluded from JSON
}

func main() {
    peer := PeerInfo{
        ID:       "peer-001",
        Hostname: "tunnel.example.com",
        Port:     8443,
    }
    data, _ := json.Marshal(peer)
    fmt.Println(string(data))
    // {"id":"peer-001","hostname":"tunnel.example.com","port":8443}
    // Note: latency_ms omitted (zero value + omitempty), Internal excluded
}
```

Tags are accessed at runtime via the `reflect` package. Common tags include `json`, `xml`, `db`, `yaml`, and `validate`.

### Constructors and Factory Functions

Go doesn't have constructors, but the convention is to use `New` functions:

```go
func NewConnection(srcIP string, srcPort uint16, dstIP string, dstPort uint16) *Connection {
    return &Connection{
        SourceIP:   srcIP,
        SourcePort: srcPort,
        DestIP:     dstIP,
        DestPort:   dstPort,
        IsActive:   true,
        OpenedAt:   time.Now(),
    }
}
```

Returning a pointer is idiomatic when the struct will be modified or is large.

## Why It Matters

Every systems program revolves around state — connection tables, routing entries, buffer pools, protocol messages. Structs let you model this state precisely, with methods that enforce invariants. Pointer receivers ensure mutations happen in place without copying megabytes of connection metadata. Embedding lets you compose behaviors cleanly — a connection that embeds stats automatically gets stats methods. Struct tags bridge the gap between your in-memory representation and wire formats like JSON or binary protocols.

## Questions

Q: When should you use a pointer receiver instead of a value receiver?
A) When the method name starts with a capital letter
B) When the method needs to modify the struct's fields
C) When the struct has fewer than 3 fields
D) When the method returns an error
Correct: B

Q: What happens to an embedded struct's methods?
A) They are hidden and must be accessed through the embedded field name
B) They are promoted and can be called directly on the outer struct
C) They are copied and become new methods on the outer struct
D) They cause a compilation error
Correct: B

Q: What does the struct tag `json:"-"` do?
A) Sets the JSON field name to a hyphen
B) Makes the field required in JSON
C) Excludes the field from JSON encoding/decoding
D) Makes the field read-only
Correct: C

## Challenge

Create a `TCPConnection` struct with source/destination addresses, bytes transferred, and active status. Add a method `Transfer` (pointer receiver) that adds bytes and a method `Status` (value receiver) that returns a formatted string. Create two connections and transfer data on each.

## Starter Code

```go
package main

import "fmt"

// Define your TCPConnection struct here

// Add Transfer method (pointer receiver)

// Add Status method (value receiver)

func main() {
    conn1 := NewTCPConnection("192.168.1.10", 8080)
    conn2 := NewTCPConnection("10.0.0.5", 3000)

    conn1.Transfer(1024)
    conn1.Transfer(2048)
    conn2.Transfer(512)

    fmt.Println(conn1.Status())
    fmt.Println(conn2.Status())
}
```

## Expected Output

```
192.168.1.10:8080 - 3072 bytes transferred [active]
10.0.0.5:3000 - 512 bytes transferred [active]
```

## Hint

Define the struct with `DestIP string`, `DestPort uint16`, `BytesTransferred int64`, and `IsActive bool`. The `Transfer` method uses a pointer receiver to modify `BytesTransferred`. Use `fmt.Sprintf` in `Status` to format the string.

## Solution

```go
package main

import "fmt"

type TCPConnection struct {
    DestIP           string
    DestPort         uint16
    BytesTransferred int64
    IsActive         bool
}

func NewTCPConnection(ip string, port uint16) *TCPConnection {
    return &TCPConnection{
        DestIP:   ip,
        DestPort: port,
        IsActive: true,
    }
}

func (c *TCPConnection) Transfer(bytes int64) {
    c.BytesTransferred += bytes
}

func (c TCPConnection) Status() string {
    status := "active"
    if !c.IsActive {
        status = "closed"
    }
    return fmt.Sprintf("%s:%d - %d bytes transferred [%s]",
        c.DestIP, c.DestPort, c.BytesTransferred, status)
}

func main() {
    conn1 := NewTCPConnection("192.168.1.10", 8080)
    conn2 := NewTCPConnection("10.0.0.5", 3000)

    conn1.Transfer(1024)
    conn1.Transfer(2048)
    conn2.Transfer(512)

    fmt.Println(conn1.Status())
    fmt.Println(conn2.Status())
}
```
