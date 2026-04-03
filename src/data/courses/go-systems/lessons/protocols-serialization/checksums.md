---
id: "go-checksums"
courseId: "go-systems"
moduleId: "protocols-serialization"
title: "Checksums & Data Integrity"
description: "Add CRC32 checksums to your wire protocol to detect data corruption before it causes damage."
order: 4
---

## Scenario

Your tunnel is forwarding HTTP traffic between a local development server and the public internet. Everything works great until a user reports that a file download is silently corrupted — the tunnel forwarded the bytes, but somewhere along the way, a few bits flipped. Maybe it was a faulty network card, a misbehaving proxy, or a cosmic ray. TCP has its own checksum, but it's only 16 bits and it's computed over the TCP segment, not your application data. Studies have shown that TCP checksums miss roughly 1 in 10 billion corrupted packets.

Checksums solve this at the application layer. Before sending a message, you compute a short hash of the payload and attach it. The receiver computes the same hash and compares. If they don't match, the data was corrupted in transit and you reject it immediately rather than passing garbage to the application.

## Content

## Checksums & Data Integrity

### What Is a Checksum?

A checksum is a small fixed-size value computed from a block of data. If the data changes (even a single bit), the checksum changes. By comparing checksums, you can detect whether data was corrupted without comparing the entire payload byte-by-byte.

```go
package main

import (
    "fmt"
    "hash/crc32"
)

func main() {
    data := []byte("tunnel control message")

    // Compute CRC32 checksum
    checksum := crc32.ChecksumIEEE(data)
    fmt.Printf("Data:     %q\n", data)
    fmt.Printf("CRC32:    0x%08X\n", checksum)

    // Flip one bit in the data
    corrupted := make([]byte, len(data))
    copy(corrupted, data)
    corrupted[0] ^= 0x01 // flip the lowest bit of the first byte

    corruptedChecksum := crc32.ChecksumIEEE(corrupted)
    fmt.Printf("\nCorrupted: %q\n", corrupted)
    fmt.Printf("CRC32:     0x%08X\n", corruptedChecksum)
    fmt.Printf("Match:     %v\n", checksum == corruptedChecksum)
}
```

CRC32 produces a 4-byte (32-bit) checksum. It's fast to compute, widely used in networking (Ethernet, gzip, PNG), and detects all single-bit errors, all double-bit errors, and most multi-bit burst errors.

### The hash/crc32 Package

Go's `hash/crc32` package provides two ways to compute CRC32: a one-shot function and a streaming interface that implements `hash.Hash32`.

```go
package main

import (
    "fmt"
    "hash/crc32"
)

func main() {
    // Method 1: One-shot with ChecksumIEEE (uses IEEE polynomial)
    data := []byte("hello checksum")
    sum1 := crc32.ChecksumIEEE(data)
    fmt.Printf("One-shot:  0x%08X\n", sum1)

    // Method 2: Streaming with New (useful when data comes in chunks)
    table := crc32.MakeTable(crc32.IEEE)
    hasher := crc32.New(table)
    hasher.Write([]byte("hello "))
    hasher.Write([]byte("checksum"))
    sum2 := hasher.Sum32()
    fmt.Printf("Streaming: 0x%08X\n", sum2)

    fmt.Printf("Equal:     %v\n", sum1 == sum2)

    // The Castagnoli polynomial is faster on modern CPUs (hardware acceleration)
    tableCast := crc32.MakeTable(crc32.Castagnoli)
    hasherCast := crc32.New(tableCast)
    hasherCast.Write(data)
    sum3 := hasherCast.Sum32()
    fmt.Printf("Castagnoli: 0x%08X\n", sum3)
}
```

The `Castagnoli` polynomial is worth noting: on CPUs with SSE 4.2 (most modern x86 processors), Go uses hardware-accelerated CRC32C, which is significantly faster than the IEEE polynomial. This is what many storage systems (like Btrfs and RocksDB) use.

### Adding Checksums to Your Wire Protocol

Integrate the checksum into your message format. A common approach: compute the CRC32 over the payload and store it in the header, right after the length field.

```go
package main

import (
    "encoding/binary"
    "fmt"
    "hash/crc32"
)

// Header layout (12 bytes):
//   [0]     version  (uint8)
//   [1]     type     (uint8)
//   [2:4]   flags    (uint16)
//   [4:8]   length   (uint32)
//   [8:12]  checksum (uint32) - CRC32 of payload

const HeaderSize = 12

func encodeMessage(msgType uint8, payload []byte) []byte {
    msg := make([]byte, HeaderSize+len(payload))
    msg[0] = 1 // version
    msg[1] = msgType
    binary.BigEndian.PutUint16(msg[2:4], 0) // flags
    binary.BigEndian.PutUint32(msg[4:8], uint32(len(payload)))
    binary.BigEndian.PutUint32(msg[8:12], crc32.ChecksumIEEE(payload))
    copy(msg[HeaderSize:], payload)
    return msg
}

func decodeAndVerify(data []byte) (uint8, []byte, error) {
    if len(data) < HeaderSize {
        return 0, nil, fmt.Errorf("message too short")
    }

    msgType := data[1]
    length := binary.BigEndian.Uint32(data[4:8])
    expectedCRC := binary.BigEndian.Uint32(data[8:12])

    payload := data[HeaderSize : HeaderSize+length]
    actualCRC := crc32.ChecksumIEEE(payload)

    if actualCRC != expectedCRC {
        return 0, nil, fmt.Errorf(
            "checksum mismatch: expected 0x%08X, got 0x%08X",
            expectedCRC, actualCRC,
        )
    }

    return msgType, payload, nil
}

func main() {
    // Encode a message
    msg := encodeMessage(0x05, []byte("important data"))
    fmt.Printf("Message: %d bytes\n", len(msg))

    // Verify — should pass
    msgType, payload, err := decodeAndVerify(msg)
    if err != nil {
        fmt.Printf("FAILED: %v\n", err)
    } else {
        fmt.Printf("OK: type=0x%02X payload=%q\n", msgType, payload)
    }

    // Corrupt the payload and verify again
    msg[HeaderSize+3] ^= 0xFF
    _, _, err = decodeAndVerify(msg)
    if err != nil {
        fmt.Printf("Corruption detected: %v\n", err)
    }
}
```

### Verifying Data Integrity

When a checksum mismatch occurs, you have several options depending on your protocol's design: request retransmission, drop the connection, or log the error and skip the message. The right choice depends on whether your protocol is stateful or stateless.

```go
package main

import (
    "fmt"
    "hash/crc32"
)

type VerifyResult int

const (
    VerifyOK VerifyResult = iota
    VerifyCorrupted
    VerifyTruncated
)

func verify(payload []byte, expectedCRC uint32, expectedLen uint32) VerifyResult {
    if uint32(len(payload)) != expectedLen {
        return VerifyTruncated
    }
    if crc32.ChecksumIEEE(payload) != expectedCRC {
        return VerifyCorrupted
    }
    return VerifyOK
}

func main() {
    original := []byte("payload data here")
    crc := crc32.ChecksumIEEE(original)
    length := uint32(len(original))

    // Case 1: intact
    result := verify(original, crc, length)
    fmt.Printf("Intact:    %v\n", result == VerifyOK) // true

    // Case 2: corrupted
    corrupted := make([]byte, len(original))
    copy(corrupted, original)
    corrupted[5] = 0x00
    result = verify(corrupted, crc, length)
    fmt.Printf("Corrupted: %v\n", result == VerifyCorrupted) // true

    // Case 3: truncated
    truncated := original[:10]
    result = verify(truncated, crc, length)
    fmt.Printf("Truncated: %v\n", result == VerifyTruncated) // true
}
```

### Checksums vs Hashes vs MACs

It's important to understand what CRC32 does NOT do. CRC32 detects accidental corruption. It does not detect intentional tampering — an attacker can easily compute a new CRC32 for modified data. For security, you need cryptographic hashes (SHA-256) or message authentication codes (HMAC).

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "fmt"
    "hash/crc32"
)

func main() {
    data := []byte("sensitive message")

    // CRC32: fast, detects corruption, NOT secure
    crc := crc32.ChecksumIEEE(data)
    fmt.Printf("CRC32:  0x%08X  (4 bytes, fast, not secure)\n", crc)

    // SHA-256: slower, cryptographically secure hash
    hash := sha256.Sum256(data)
    fmt.Printf("SHA256: %x  (32 bytes, secure)\n", hash[:8])

    // HMAC-SHA256: proves both integrity AND authenticity
    key := []byte("shared-secret-key")
    mac := hmac.New(sha256.New, key)
    mac.Write(data)
    sig := mac.Sum(nil)
    fmt.Printf("HMAC:   %x  (32 bytes, authenticated)\n", sig[:8])

    // For wire protocols: use CRC32 for corruption detection,
    // add HMAC or TLS for security when needed.
}
```

## Why It Matters

Data corruption is rare but real. It happens in production systems at a higher rate than most engineers expect — studies at Google and Amazon have documented silent data corruption rates that matter at scale. Adding checksums to your wire protocol is cheap insurance: 4 extra bytes per message and a few nanoseconds of CPU time to compute. The alternative is silently forwarding corrupted data to your application, where it might cause a wrong calculation, a corrupted database entry, or a security vulnerability. Checksums are the last line of defense between your protocol and garbage data.

## Questions

Q: What does CRC32 detect?
A) Intentional data tampering by an attacker
B) Accidental data corruption such as bit flips during transmission
C) Network latency issues
D) Authentication failures
Correct: B

Q: Why is the Castagnoli CRC32 polynomial often preferred over IEEE in modern systems?
A) It produces a longer checksum
B) It is cryptographically secure
C) Modern CPUs have hardware instructions that accelerate it
D) It uses less memory
Correct: C

Q: Where should the checksum be placed in a wire protocol message?
A) Before the version field
B) In the header, computed over the payload
C) After the payload, computed over the header
D) In a separate TCP packet
Correct: B

## Challenge

Write a function that wraps a byte slice in a "verified envelope": 4-byte CRC32 prefix followed by the data. Then write a function that opens the envelope, verifying the checksum and returning the data or an error if corrupted. Test with both valid and corrupted data.

## Starter Code

```go
package main

import (
    "encoding/binary"
    "fmt"
    "hash/crc32"
)

func seal(data []byte) []byte {
    // TODO: prepend 4-byte CRC32, then data
    return nil
}

func open(envelope []byte) ([]byte, error) {
    // TODO: verify CRC32 prefix matches data, return data or error
    return nil, nil
}

func main() {
    original := []byte("critical system data")

    envelope := seal(original)
    fmt.Printf("Sealed: %d bytes\n", len(envelope))

    // Valid open
    data, err := open(envelope)
    if err != nil {
        fmt.Printf("ERROR: %v\n", err)
    } else {
        fmt.Printf("Opened: %s\n", data)
    }

    // Corrupt and try again
    envelope[10] ^= 0xFF
    _, err = open(envelope)
    if err != nil {
        fmt.Printf("Detected: %v\n", err)
    }
}
```

## Expected Output

```
Sealed: 24 bytes
Opened: critical system data
Detected: checksum mismatch
```

## Hint

In `seal`, compute `crc32.ChecksumIEEE(data)` and write it as the first 4 bytes using `binary.BigEndian.PutUint32`. In `open`, extract the stored checksum from the first 4 bytes, compute the checksum of the remaining bytes, and compare.

## Solution

```go
package main

import (
    "encoding/binary"
    "fmt"
    "hash/crc32"
)

func seal(data []byte) []byte {
    envelope := make([]byte, 4+len(data))
    binary.BigEndian.PutUint32(envelope[0:4], crc32.ChecksumIEEE(data))
    copy(envelope[4:], data)
    return envelope
}

func open(envelope []byte) ([]byte, error) {
    if len(envelope) < 4 {
        return nil, fmt.Errorf("envelope too short")
    }
    stored := binary.BigEndian.Uint32(envelope[0:4])
    data := envelope[4:]
    actual := crc32.ChecksumIEEE(data)
    if stored != actual {
        return nil, fmt.Errorf("checksum mismatch")
    }
    return data, nil
}

func main() {
    original := []byte("critical system data")

    envelope := seal(original)
    fmt.Printf("Sealed: %d bytes\n", len(envelope))

    data, err := open(envelope)
    if err != nil {
        fmt.Printf("ERROR: %v\n", err)
    } else {
        fmt.Printf("Opened: %s\n", data)
    }

    envelope[10] ^= 0xFF
    _, err = open(envelope)
    if err != nil {
        fmt.Printf("Detected: %v\n", err)
    }
}
```
