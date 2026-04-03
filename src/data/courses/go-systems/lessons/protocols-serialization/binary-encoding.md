---
id: "go-binary-encoding"
courseId: "go-systems"
moduleId: "protocols-serialization"
title: "Binary Encoding"
description: "Encode and decode structured data into compact binary formats using Go's encoding/binary package."
order: 1
---

## Scenario

You're building a tunnel service that forwards traffic between a local development server and the public internet. The tunnel client and server need to exchange control messages — heartbeats, connection requests, metadata updates. Your first instinct is JSON, but each control message is only 20-30 bytes of actual data. JSON bloats that to 200+ bytes with field names, quotes, and braces. Over thousands of messages per second, that overhead adds up fast.

Binary encoding solves this. Instead of `{"type":1,"connId":4982,"port":8080}`, you write exactly 9 bytes: 1 byte for type, 4 bytes for connection ID, 2 bytes for port, and 2 bytes for flags. Every byte has a purpose, every bit is accounted for. This is how real network protocols — TCP headers, DNS packets, TLS records — encode their data.

## Content

## Binary Encoding

### The encoding/binary Package

Go's `encoding/binary` package provides two core capabilities: byte order specification and struct-to-bytes conversion. The package defines two byte orders — `binary.BigEndian` and `binary.LittleEndian` — which determine how multi-byte values are laid out in memory.

```go
package main

import (
    "encoding/binary"
    "fmt"
)

func main() {
    buf := make([]byte, 4)

    // Write the number 1024 in big-endian (network byte order)
    binary.BigEndian.PutUint32(buf, 1024)
    fmt.Printf("Big-endian:    %v\n", buf) // [0 0 4 0]

    // Write the same number in little-endian
    binary.LittleEndian.PutUint32(buf, 1024)
    fmt.Printf("Little-endian: %v\n", buf) // [0 4 0 0]

    // Read it back
    val := binary.LittleEndian.Uint32(buf)
    fmt.Printf("Decoded: %d\n", val) // 1024
}
```

Big-endian (most significant byte first) is the standard for network protocols and is often called "network byte order." Little-endian (least significant byte first) is what x86 and ARM processors use natively. When designing a wire protocol, pick one and stick with it. Network protocols almost universally use big-endian.

### Encoding Structs to Bytes

The `binary.Write` and `binary.Read` functions can serialize entire structs, but only if all fields are fixed-size types. This means `int` won't work (its size varies by platform), but `int32`, `uint16`, `uint8`, and fixed-size arrays will.

```go
package main

import (
    "bytes"
    "encoding/binary"
    "fmt"
)

// TunnelHeader represents a control message header.
// All fields are fixed-size — this struct is exactly 9 bytes on the wire.
type TunnelHeader struct {
    Version  uint8
    Type     uint8
    ConnID   uint32
    Port     uint16
    Flags    uint8
}

func main() {
    header := TunnelHeader{
        Version: 1,
        Type:    2, // connection request
        ConnID:  4982,
        Port:    8080,
        Flags:   0x01, // compressed
    }

    // Encode to bytes
    buf := new(bytes.Buffer)
    err := binary.Write(buf, binary.BigEndian, header)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Encoded (%d bytes): %v\n", buf.Len(), buf.Bytes())

    // Decode from bytes
    var decoded TunnelHeader
    err = binary.Read(bytes.NewReader(buf.Bytes()), binary.BigEndian, &decoded)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Decoded: %+v\n", decoded)
}
```

### Big-Endian vs Little-Endian

The difference matters when two machines with different native byte orders communicate. Consider the 16-bit number `0x1F90` (8080 in decimal):

```go
package main

import (
    "encoding/binary"
    "fmt"
)

func main() {
    port := uint16(8080) // 0x1F90

    big := make([]byte, 2)
    little := make([]byte, 2)

    binary.BigEndian.PutUint16(big, port)
    binary.LittleEndian.PutUint16(little, port)

    fmt.Printf("Port %d (0x%04X)\n", port, port)
    fmt.Printf("Big-endian:    [0x%02X, 0x%02X]  (MSB first)\n", big[0], big[1])
    fmt.Printf("Little-endian: [0x%02X, 0x%02X]  (LSB first)\n", little[0], little[1])

    // If you read big-endian bytes as little-endian, you get garbage
    wrong := binary.LittleEndian.Uint16(big)
    fmt.Printf("Mismatched read: %d (wrong!)\n", wrong) // 37151, not 8080
}
```

If the sender writes big-endian and the receiver reads little-endian, you get corrupted data. This class of bug is subtle because small values (under 256) look correct — the high byte is zero either way.

### Manual Encoding for Performance

`binary.Write` uses reflection, which adds overhead. In hot paths, you can encode manually for better performance:

```go
package main

import (
    "encoding/binary"
    "fmt"
)

type TunnelHeader struct {
    Version uint8
    Type    uint8
    ConnID  uint32
    Port    uint16
    Flags   uint8
}

// MarshalBinary encodes the header into exactly 9 bytes.
func (h *TunnelHeader) MarshalBinary() []byte {
    buf := make([]byte, 9)
    buf[0] = h.Version
    buf[1] = h.Type
    binary.BigEndian.PutUint32(buf[2:6], h.ConnID)
    binary.BigEndian.PutUint16(buf[6:8], h.Port)
    buf[8] = h.Flags
    return buf
}

// UnmarshalBinary decodes 9 bytes into the header.
func (h *TunnelHeader) UnmarshalBinary(buf []byte) error {
    if len(buf) < 9 {
        return fmt.Errorf("buffer too short: need 9 bytes, got %d", len(buf))
    }
    h.Version = buf[0]
    h.Type = buf[1]
    h.ConnID = binary.BigEndian.Uint32(buf[2:6])
    h.Port = binary.BigEndian.Uint16(buf[6:8])
    h.Flags = buf[8]
    return nil
}

func main() {
    original := TunnelHeader{
        Version: 1,
        Type:    3,
        ConnID:  99001,
        Port:    443,
        Flags:   0x03,
    }

    data := original.MarshalBinary()
    fmt.Printf("Encoded %d bytes: %v\n", len(data), data)

    var decoded TunnelHeader
    if err := decoded.UnmarshalBinary(data); err != nil {
        panic(err)
    }
    fmt.Printf("Decoded: %+v\n", decoded)
}
```

### Fixed-Size vs Variable-Size Fields

Fixed-size fields (`uint32`, `[16]byte`) make encoding simple: you always know the byte offset of every field. Variable-size fields (strings, slices) require a length prefix so the decoder knows how many bytes to read.

```go
package main

import (
    "encoding/binary"
    "fmt"
)

// EncodeString writes a length-prefixed string: 2 bytes for length, then the string bytes.
func EncodeString(dst []byte, s string) int {
    binary.BigEndian.PutUint16(dst[0:2], uint16(len(s)))
    copy(dst[2:], s)
    return 2 + len(s)
}

// DecodeString reads a length-prefixed string.
func DecodeString(src []byte) (string, int) {
    length := binary.BigEndian.Uint16(src[0:2])
    return string(src[2 : 2+length]), 2 + int(length)
}

func main() {
    buf := make([]byte, 256)

    hostname := "api.example.com"
    n := EncodeString(buf, hostname)
    fmt.Printf("Encoded '%s' in %d bytes\n", hostname, n)

    decoded, consumed := DecodeString(buf)
    fmt.Printf("Decoded '%s', consumed %d bytes\n", decoded, consumed)
}
```

The tradeoff: fixed-size fields are faster and simpler to parse, but waste space when values vary widely. Variable-size fields are space-efficient but require careful bounds checking during decode.

## Why It Matters

Every network protocol you interact with daily — HTTP/2, TLS, DNS, gRPC — uses binary encoding under the hood. JSON and XML are fine for APIs where human readability matters, but systems code needs to be compact and fast. Understanding binary encoding is the foundation for implementing wire protocols, parsing network packets, reading file formats, and building any system where bytes-on-the-wire efficiency matters. When you write a tunnel, a database driver, or a metrics collector, you'll encode and decode binary data constantly.

## Questions

Q: What byte order is standard for network protocols?
A) Little-endian
B) Big-endian
C) Platform-native
D) UTF-8
Correct: B

Q: Why can't you use `int` as a field type with `binary.Write`?
A) int is not a numeric type
B) int is signed and binary only supports unsigned
C) int's size varies by platform, so the byte count is ambiguous
D) int is deprecated in Go
Correct: C

Q: What is the purpose of a length prefix on a variable-size field?
A) To specify the byte order
B) To tell the decoder how many bytes to read for that field
C) To compress the data
D) To add error checking
Correct: B

## Challenge

Create a `Message` struct with a fixed `Type` field (uint8), a fixed `Timestamp` field (uint64), and a variable-length `Payload` field (string). Write `Encode` and `Decode` functions that serialize it to bytes and back, using big-endian byte order and a uint16 length prefix for the payload.

## Starter Code

```go
package main

import (
    "encoding/binary"
    "fmt"
)

type Message struct {
    Type      uint8
    Timestamp uint64
    Payload   string
}

func Encode(m Message) []byte {
    // TODO: encode Type (1 byte) + Timestamp (8 bytes) + Payload length (2 bytes) + Payload
}

func Decode(data []byte) Message {
    // TODO: decode the message from bytes
}

func main() {
    msg := Message{
        Type:      1,
        Timestamp: 1672531200,
        Payload:   "hello tunnel",
    }
    data := Encode(msg)
    fmt.Printf("Encoded %d bytes\n", len(data))

    decoded := Decode(data)
    fmt.Printf("Type: %d, Timestamp: %d, Payload: %s\n",
        decoded.Type, decoded.Timestamp, decoded.Payload)
}
```

## Expected Output

```
Encoded 23 bytes
Type: 1, Timestamp: 1672531200, Payload: hello tunnel
```

## Hint

The total size is 1 (Type) + 8 (Timestamp) + 2 (Payload length prefix) + len(Payload). Use `binary.BigEndian.PutUint64` for the timestamp and `binary.BigEndian.PutUint16` for the payload length.

## Solution

```go
package main

import (
    "encoding/binary"
    "fmt"
)

type Message struct {
    Type      uint8
    Timestamp uint64
    Payload   string
}

func Encode(m Message) []byte {
    payloadLen := len(m.Payload)
    buf := make([]byte, 1+8+2+payloadLen)
    buf[0] = m.Type
    binary.BigEndian.PutUint64(buf[1:9], m.Timestamp)
    binary.BigEndian.PutUint16(buf[9:11], uint16(payloadLen))
    copy(buf[11:], m.Payload)
    return buf
}

func Decode(data []byte) Message {
    var m Message
    m.Type = data[0]
    m.Timestamp = binary.BigEndian.Uint64(data[1:9])
    payloadLen := binary.BigEndian.Uint16(data[9:11])
    m.Payload = string(data[11 : 11+payloadLen])
    return m
}

func main() {
    msg := Message{
        Type:      1,
        Timestamp: 1672531200,
        Payload:   "hello tunnel",
    }
    data := Encode(msg)
    fmt.Printf("Encoded %d bytes\n", len(data))

    decoded := Decode(data)
    fmt.Printf("Type: %d, Timestamp: %d, Payload: %s\n",
        decoded.Type, decoded.Timestamp, decoded.Payload)
}
```
