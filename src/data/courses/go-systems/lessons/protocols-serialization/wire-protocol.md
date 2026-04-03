---
id: "go-wire-protocol"
courseId: "go-systems"
moduleId: "protocols-serialization"
title: "Wire Protocol Design"
description: "Design a custom wire protocol with message types, version headers, and request/response patterns."
order: 2
---

## Scenario

Your tunnel service needs a clear contract between client and server. When bytes arrive on a TCP connection, both sides need to agree: what do these bytes mean? A wire protocol is that contract. It defines every message type, how each is structured, and how the two sides interact — who speaks first, how requests map to responses, and what happens when something goes wrong.

Real systems live and die by their wire protocol design. Redis uses RESP, PostgreSQL has its own frontend/backend protocol, HTTP/2 has a binary framing layer. Each was designed with specific tradeoffs in mind. In this lesson, you'll design a protocol from scratch — the kind of thinking that separates systems engineers from application developers.

## Content

## Wire Protocol Design

### What Is a Wire Protocol?

A wire protocol defines the exact byte-level format of messages exchanged between two programs over a network connection. It specifies message types, field layouts, byte ordering, and interaction patterns. Unlike an API schema (which describes *what* data is exchanged), a wire protocol describes *how* that data is physically represented as bytes.

```go
package main

import "fmt"

// Protocol constants define the contract between client and server.
const (
    ProtoVersion = 1
    MaxMsgSize   = 1 << 20 // 1 MB

    // Message types
    MsgHandshake    uint8 = 0x01
    MsgHandshakeAck uint8 = 0x02
    MsgTunnelOpen   uint8 = 0x03
    MsgTunnelAck    uint8 = 0x04
    MsgData         uint8 = 0x05
    MsgHeartbeat    uint8 = 0x06
    MsgHeartbeatAck uint8 = 0x07
    MsgClose        uint8 = 0x08
)

func msgName(t uint8) string {
    names := map[uint8]string{
        MsgHandshake:    "HANDSHAKE",
        MsgHandshakeAck: "HANDSHAKE_ACK",
        MsgTunnelOpen:   "TUNNEL_OPEN",
        MsgTunnelAck:    "TUNNEL_ACK",
        MsgData:         "DATA",
        MsgHeartbeat:    "HEARTBEAT",
        MsgHeartbeatAck: "HEARTBEAT_ACK",
        MsgClose:        "CLOSE",
    }
    if name, ok := names[t]; ok {
        return name
    }
    return fmt.Sprintf("UNKNOWN(0x%02X)", t)
}

func main() {
    fmt.Println("Protocol v" + fmt.Sprint(ProtoVersion))
    for _, t := range []uint8{0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08} {
        fmt.Printf("  0x%02X = %s\n", t, msgName(t))
    }
}
```

### Message Type Fields and Header Layout

Every message starts with a fixed-size header. The header tells the receiver what kind of message it is, how large it is, and which protocol version it uses. This is the first thing parsed from every message.

```go
package main

import (
    "encoding/binary"
    "fmt"
)

// Header is 8 bytes, present at the start of every message.
//
// Layout:
//   [0]     version  (uint8)  - protocol version
//   [1]     type     (uint8)  - message type
//   [2:4]   flags    (uint16) - bitfield for options
//   [4:8]   length   (uint32) - payload length (bytes after header)
type Header struct {
    Version uint8
    Type    uint8
    Flags   uint16
    Length  uint32
}

const HeaderSize = 8

func (h *Header) Marshal() []byte {
    buf := make([]byte, HeaderSize)
    buf[0] = h.Version
    buf[1] = h.Type
    binary.BigEndian.PutUint16(buf[2:4], h.Flags)
    binary.BigEndian.PutUint32(buf[4:8], h.Length)
    return buf
}

func ParseHeader(buf []byte) (Header, error) {
    if len(buf) < HeaderSize {
        return Header{}, fmt.Errorf("need %d bytes, got %d", HeaderSize, len(buf))
    }
    return Header{
        Version: buf[0],
        Type:    buf[1],
        Flags:   binary.BigEndian.Uint16(buf[2:4]),
        Length:  binary.BigEndian.Uint32(buf[4:8]),
    }, nil
}

func main() {
    h := Header{Version: 1, Type: 0x05, Flags: 0x0001, Length: 1024}
    data := h.Marshal()
    fmt.Printf("Header bytes: %v\n", data)

    parsed, err := ParseHeader(data)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Parsed: version=%d type=0x%02X flags=0x%04X length=%d\n",
        parsed.Version, parsed.Type, parsed.Flags, parsed.Length)
}
```

### Version Headers and Protocol Evolution

Protocols evolve. Version 1 has five message types; version 2 adds compression; version 3 adds multiplexing. The version field in the header lets both sides negotiate which features they support.

```go
package main

import "fmt"

const (
    FlagCompressed uint16 = 1 << 0 // v2+
    FlagEncrypted  uint16 = 1 << 1 // v2+
    FlagMultiplex  uint16 = 1 << 2 // v3+
)

type Capabilities struct {
    Version     uint8
    Compression bool
    Encryption  bool
    Multiplex   bool
}

func negotiate(clientVer, serverVer uint8) Capabilities {
    // Use the minimum version both sides support
    ver := clientVer
    if serverVer < ver {
        ver = serverVer
    }

    caps := Capabilities{Version: ver}
    if ver >= 2 {
        caps.Compression = true
        caps.Encryption = true
    }
    if ver >= 3 {
        caps.Multiplex = true
    }
    return caps
}

func main() {
    // Client is v3, server is v2 — agree on v2 features
    caps := negotiate(3, 2)
    fmt.Printf("Negotiated: v%d\n", caps.Version)
    fmt.Printf("  Compression: %v\n", caps.Compression)
    fmt.Printf("  Encryption:  %v\n", caps.Encryption)
    fmt.Printf("  Multiplex:   %v\n", caps.Multiplex)
}
```

The key rule: never remove or reorder fields in existing message types. Add new message types or new flags for new behavior. Old clients should be able to ignore fields they don't understand.

### Request/Response Patterns

Most wire protocols use one of three interaction patterns. Your tunnel protocol likely uses all three in different contexts.

```go
package main

import "fmt"

// Pattern 1: Request/Response
// Client sends a request with an ID, server responds with the same ID.
type Request struct {
    RequestID uint32
    Type      uint8
    Payload   []byte
}

type Response struct {
    RequestID uint32 // matches the request
    Status    uint8  // 0 = success, 1+ = error codes
    Payload   []byte
}

// Pattern 2: Fire-and-forget (no response expected)
// Used for heartbeats, metrics, keepalives.
type Heartbeat struct {
    Timestamp uint64
}

// Pattern 3: Streaming
// One side sends a stream of DATA messages, terminated by a message with FlagFin set.
const FlagFin uint16 = 1 << 15

func main() {
    // Matching responses to requests by ID
    req := Request{RequestID: 42, Type: 0x03}
    resp := Response{RequestID: 42, Status: 0}
    fmt.Printf("Request  #%d -> type 0x%02X\n", req.RequestID, req.Type)
    fmt.Printf("Response #%d -> status %d\n", resp.RequestID, resp.Status)

    // Streaming with FIN flag
    for i := 0; i < 3; i++ {
        flags := uint16(0)
        if i == 2 {
            flags = FlagFin
        }
        fmt.Printf("DATA chunk %d, FIN=%v\n", i, flags&FlagFin != 0)
    }
}
```

### Putting It Together: A Complete Message

Here's how a full message encode/decode cycle looks with header + typed payload:

```go
package main

import (
    "encoding/binary"
    "fmt"
)

const (
    HeaderSize     = 8
    MsgTunnelOpen  = 0x03
    ProtoVersion   = 1
)

type Header struct {
    Version uint8
    Type    uint8
    Flags   uint16
    Length  uint32
}

type TunnelOpenPayload struct {
    Port     uint16
    Hostname string
}

func encodeMessage(msgType uint8, payload []byte) []byte {
    h := Header{
        Version: ProtoVersion,
        Type:    msgType,
        Length:  uint32(len(payload)),
    }
    msg := make([]byte, HeaderSize+len(payload))
    msg[0] = h.Version
    msg[1] = h.Type
    binary.BigEndian.PutUint16(msg[2:4], h.Flags)
    binary.BigEndian.PutUint32(msg[4:8], h.Length)
    copy(msg[HeaderSize:], payload)
    return msg
}

func encodeTunnelOpen(port uint16, hostname string) []byte {
    payload := make([]byte, 2+2+len(hostname))
    binary.BigEndian.PutUint16(payload[0:2], port)
    binary.BigEndian.PutUint16(payload[2:4], uint16(len(hostname)))
    copy(payload[4:], hostname)
    return encodeMessage(MsgTunnelOpen, payload)
}

func main() {
    msg := encodeTunnelOpen(8080, "myapp.tunnel.dev")
    fmt.Printf("Full message: %d bytes\n", len(msg))
    fmt.Printf("Header:  %v\n", msg[:HeaderSize])
    fmt.Printf("Payload: %v\n", msg[HeaderSize:])

    // Decode
    version := msg[0]
    msgType := msg[1]
    length := binary.BigEndian.Uint32(msg[4:8])
    payload := msg[HeaderSize : HeaderSize+length]
    port := binary.BigEndian.Uint16(payload[0:2])
    hostLen := binary.BigEndian.Uint16(payload[2:4])
    hostname := string(payload[4 : 4+hostLen])

    fmt.Printf("\nDecoded: v%d type=0x%02X port=%d hostname=%s\n",
        version, msgType, port, hostname)
}
```

## Why It Matters

Every production system that communicates over a network uses a wire protocol — whether it's a well-known one like HTTP/2 or a custom one for internal services. Designing a good wire protocol means thinking about forward compatibility (versioning), efficiency (compact encoding), debuggability (clear message types), and correctness (unambiguous parsing). These skills transfer directly to understanding database drivers, RPC frameworks, message queues, and any networked system you build or debug.

## Questions

Q: Why does every message start with a fixed-size header?
A) To make messages human-readable
B) So the receiver can determine the message type and payload length before reading the rest
C) To compress the message
D) Because Go requires it
Correct: B

Q: What is the safest way to evolve a wire protocol without breaking old clients?
A) Change the meaning of existing fields
B) Remove unused message types
C) Add new message types or flags, never remove or reorder existing ones
D) Increment the version and require all clients to upgrade simultaneously
Correct: C

Q: In a request/response protocol, how does the client match a response to its original request?
A) By the order responses arrive
B) By the message type field
C) By a shared request ID present in both request and response
D) By the TCP sequence number
Correct: C

## Challenge

Build a simple message encoder/decoder that supports two message types: `PING` (type 0x01, no payload) and `ECHO` (type 0x02, payload is a UTF-8 string). Each message has an 8-byte header (version, type, flags, length) followed by the payload. Encode one of each, then decode them.

## Starter Code

```go
package main

import (
    "encoding/binary"
    "fmt"
)

const HeaderSize = 8

const (
    MsgPing uint8 = 0x01
    MsgEcho uint8 = 0x02
)

func encodeMessage(msgType uint8, payload []byte) []byte {
    // TODO: build header + payload
    return nil
}

func decodeMessage(data []byte) (msgType uint8, payload []byte) {
    // TODO: parse header, extract payload
    return 0, nil
}

func main() {
    // Encode a PING (no payload)
    ping := encodeMessage(MsgPing, nil)
    fmt.Printf("PING: %d bytes\n", len(ping))

    // Encode an ECHO with a message
    echo := encodeMessage(MsgEcho, []byte("hello protocol"))
    fmt.Printf("ECHO: %d bytes\n", len(echo))

    // Decode both
    t1, p1 := decodeMessage(ping)
    fmt.Printf("Decoded: type=0x%02X payload=%q\n", t1, string(p1))

    t2, p2 := decodeMessage(echo)
    fmt.Printf("Decoded: type=0x%02X payload=%q\n", t2, string(p2))
}
```

## Expected Output

```
PING: 8 bytes
ECHO: 22 bytes
Decoded: type=0x01 payload=""
Decoded: type=0x02 payload="hello protocol"
```

## Hint

The header is: version (1 byte, use 1), type (1 byte), flags (2 bytes, use 0), length (4 bytes). Use `binary.BigEndian.PutUint16` for flags and `binary.BigEndian.PutUint32` for length. Payload follows immediately after the header.

## Solution

```go
package main

import (
    "encoding/binary"
    "fmt"
)

const HeaderSize = 8

const (
    MsgPing uint8 = 0x01
    MsgEcho uint8 = 0x02
)

func encodeMessage(msgType uint8, payload []byte) []byte {
    msg := make([]byte, HeaderSize+len(payload))
    msg[0] = 1 // version
    msg[1] = msgType
    binary.BigEndian.PutUint16(msg[2:4], 0) // flags
    binary.BigEndian.PutUint32(msg[4:8], uint32(len(payload)))
    copy(msg[HeaderSize:], payload)
    return msg
}

func decodeMessage(data []byte) (msgType uint8, payload []byte) {
    msgType = data[1]
    length := binary.BigEndian.Uint32(data[4:8])
    if length > 0 {
        payload = data[HeaderSize : HeaderSize+length]
    }
    return msgType, payload
}

func main() {
    ping := encodeMessage(MsgPing, nil)
    fmt.Printf("PING: %d bytes\n", len(ping))

    echo := encodeMessage(MsgEcho, []byte("hello protocol"))
    fmt.Printf("ECHO: %d bytes\n", len(echo))

    t1, p1 := decodeMessage(ping)
    fmt.Printf("Decoded: type=0x%02X payload=%q\n", t1, string(p1))

    t2, p2 := decodeMessage(echo)
    fmt.Printf("Decoded: type=0x%02X payload=%q\n", t2, string(p2))
}
```
