---
id: "go-framing"
courseId: "go-systems"
moduleId: "protocols-serialization"
title: "Message Framing"
description: "Implement length-prefixed and delimiter-based framing to extract discrete messages from a TCP byte stream."
order: 3
---

## Scenario

You've built a wire protocol with headers and payloads. You send a 50-byte message followed by a 120-byte message over a TCP connection. On the receiving end, you call `conn.Read(buf)` and get... 83 bytes. Not 50, not 120, not 170. TCP is a byte stream, not a message stream. The operating system's network stack can split your messages, merge them, or deliver them in arbitrary chunks. One `Read` might return half of message one. The next might return the other half plus all of message two.

This is the framing problem. It's one of the most common sources of bugs in networked systems code, and it's entirely invisible in local testing (where messages usually arrive intact). Framing gives you message boundaries on top of a raw byte stream — it's the difference between "I got some bytes" and "I got a complete message."

## Content

## Message Framing

### The TCP Byte Stream Problem

TCP guarantees that bytes arrive in order and without corruption, but it makes no guarantees about how they're grouped. A single `Write` of 100 bytes might be received as one `Read` of 100 bytes, two reads of 50 bytes, or even 100 reads of 1 byte each. Conversely, two writes of 50 bytes might arrive as a single read of 100 bytes.

```go
package main

import (
    "fmt"
    "io"
    "net"
)

func main() {
    // Simulate the problem with a pipe (behaves like TCP)
    server, client := net.Pipe()

    // Writer sends two distinct messages
    go func() {
        client.Write([]byte("HELLO"))
        client.Write([]byte("WORLD"))
        client.Close()
    }()

    // Reader might get "HELLO" and "WORLD" separately,
    // or "HELLOWORLD" as one chunk, or "HEL" then "LOWORLD"
    buf := make([]byte, 1024)
    for {
        n, err := server.Read(buf)
        if err == io.EOF {
            break
        }
        if err != nil {
            panic(err)
        }
        fmt.Printf("Read %d bytes: %q\n", n, string(buf[:n]))
    }
}
```

There is no way to predict how `Read` will chunk the data. Your code must handle every possible split.

### Length-Prefixed Framing

The most common framing strategy: prepend every message with its length. The receiver reads the length first, then reads exactly that many bytes. This is what HTTP/2, gRPC, PostgreSQL's wire protocol, and most binary protocols use.

```go
package main

import (
    "encoding/binary"
    "fmt"
    "io"
    "net"
)

// WriteFrame sends a length-prefixed frame.
func WriteFrame(w io.Writer, data []byte) error {
    // Write 4-byte length header
    header := make([]byte, 4)
    binary.BigEndian.PutUint32(header, uint32(len(data)))
    if _, err := w.Write(header); err != nil {
        return err
    }
    // Write the payload
    _, err := w.Write(data)
    return err
}

// ReadFrame reads a length-prefixed frame.
func ReadFrame(r io.Reader) ([]byte, error) {
    // Read the 4-byte length header
    header := make([]byte, 4)
    if _, err := io.ReadFull(r, header); err != nil {
        return nil, err
    }
    length := binary.BigEndian.Uint32(header)

    // Read exactly 'length' bytes of payload
    payload := make([]byte, length)
    if _, err := io.ReadFull(r, payload); err != nil {
        return nil, err
    }
    return payload, nil
}

func main() {
    server, client := net.Pipe()

    go func() {
        WriteFrame(client, []byte("first message"))
        WriteFrame(client, []byte("second message"))
        WriteFrame(client, []byte("third"))
        client.Close()
    }()

    for i := 0; ; i++ {
        frame, err := ReadFrame(server)
        if err == io.EOF {
            break
        }
        if err != nil {
            panic(err)
        }
        fmt.Printf("Frame %d: %q\n", i, string(frame))
    }
}
```

### Reading Exact N Bytes with io.ReadFull

The critical function in framing is `io.ReadFull`. A normal `Read` can return fewer bytes than requested. `io.ReadFull` keeps reading until the buffer is completely filled or an error occurs.

```go
package main

import (
    "fmt"
    "io"
    "strings"
)

func main() {
    // A reader that delivers data in small chunks
    r := strings.NewReader("ABCDEFGHIJ")

    // Regular Read might return fewer bytes than requested
    buf := make([]byte, 10)
    n, err := r.Read(buf)
    fmt.Printf("Read: got %d bytes, err=%v, data=%q\n", n, err, string(buf[:n]))

    // Reset and use ReadFull — guarantees all 10 bytes or error
    r = strings.NewReader("ABCDEFGHIJ")
    buf = make([]byte, 10)
    n, err = io.ReadFull(r, buf)
    fmt.Printf("ReadFull: got %d bytes, err=%v, data=%q\n", n, err, string(buf[:n]))

    // ReadFull with insufficient data returns ErrUnexpectedEOF
    r = strings.NewReader("ABC")
    buf = make([]byte, 10)
    n, err = io.ReadFull(r, buf)
    fmt.Printf("ReadFull (short): got %d bytes, err=%v\n", n, err)
}
```

Never use plain `Read` when you need an exact number of bytes. This is the single most common TCP framing bug.

### Delimiter-Based Framing

An alternative to length-prefixing: use a special byte sequence to mark the end of each message. This is how HTTP/1.1 headers work (delimited by `\r\n\r\n`), how Redis RESP works, and how line-based protocols like SMTP work.

```go
package main

import (
    "bufio"
    "fmt"
    "io"
    "net"
)

func main() {
    server, client := net.Pipe()

    // Writer sends newline-delimited messages
    go func() {
        fmt.Fprintln(client, "GET /status")
        fmt.Fprintln(client, "SET counter 42")
        fmt.Fprintln(client, "QUIT")
        client.Close()
    }()

    // Reader uses bufio.Scanner to split on newlines
    scanner := bufio.NewScanner(server)
    for scanner.Scan() {
        line := scanner.Text()
        fmt.Printf("Command: %q\n", line)
    }
    if err := scanner.Err(); err != nil && err != io.EOF {
        panic(err)
    }
}
```

Delimiter-based framing is simpler to implement and debug (messages are often human-readable), but has downsides: the payload cannot contain the delimiter unless you add escaping, and the receiver must scan every byte looking for the delimiter instead of jumping directly to the message boundary.

### Handling Partial Reads and Max Message Size

Production framing code needs to handle two edge cases: partial reads (connection drops mid-message) and oversized messages (malicious or buggy clients sending huge frames).

```go
package main

import (
    "encoding/binary"
    "fmt"
    "io"
)

const MaxFrameSize = 1 << 20 // 1 MB

type FrameReader struct {
    r         io.Reader
    headerBuf [4]byte
}

func NewFrameReader(r io.Reader) *FrameReader {
    return &FrameReader{r: r}
}

func (fr *FrameReader) ReadFrame() ([]byte, error) {
    // Read the length header
    _, err := io.ReadFull(fr.r, fr.headerBuf[:])
    if err != nil {
        return nil, fmt.Errorf("reading frame header: %w", err)
    }

    length := binary.BigEndian.Uint32(fr.headerBuf[:])

    // Guard against oversized frames
    if length > MaxFrameSize {
        return nil, fmt.Errorf("frame too large: %d bytes (max %d)", length, MaxFrameSize)
    }

    // Guard against zero-length frames
    if length == 0 {
        return []byte{}, nil
    }

    // Read the payload
    payload := make([]byte, length)
    _, err = io.ReadFull(fr.r, payload)
    if err != nil {
        return nil, fmt.Errorf("reading frame payload (%d bytes): %w", length, err)
    }

    return payload, nil
}

func main() {
    fmt.Printf("MaxFrameSize: %d bytes (%d MB)\n", MaxFrameSize, MaxFrameSize/(1<<20))
    fmt.Println("FrameReader enforces max size and handles partial reads.")
}
```

The max frame size check prevents a malicious client from sending a length header of 2 billion and making your server allocate 2 GB of memory. Always validate the length before allocating.

## Why It Matters

Framing is the invisible layer that makes TCP usable for message-based communication. Every database driver, every RPC framework, every message queue has a framing layer. When framing bugs slip through, they cause the most maddening issues in production: messages that occasionally get concatenated, payloads that silently lose their last few bytes, connections that work fine under low load but corrupt data under high throughput. Understanding framing means understanding why these bugs happen and how to prevent them.

## Questions

Q: Why is `io.ReadFull` essential for TCP framing, instead of plain `Read`?
A) ReadFull is faster than Read
B) Read may return fewer bytes than requested even when more are available, so you might process an incomplete message
C) Read doesn't work with TCP connections
D) ReadFull compresses the data automatically
Correct: B

Q: What is the main disadvantage of delimiter-based framing compared to length-prefixed framing?
A) Delimiters use more bytes
B) The payload cannot contain the delimiter byte without escaping, and the receiver must scan every byte
C) Delimiters only work with text protocols
D) Delimiters require big-endian byte order
Correct: B

Q: Why should a framing implementation check the message length before allocating a buffer?
A) To improve compression ratio
B) To prevent a malicious or buggy sender from causing the receiver to allocate excessive memory
C) To ensure big-endian byte order
D) To count the total bytes received
Correct: B

## Challenge

Implement a `FrameWriter` and `FrameReader` that use 2-byte (uint16) length-prefixed framing. Write three messages through a `net.Pipe()` and read them back, printing each one.

## Starter Code

```go
package main

import (
    "encoding/binary"
    "fmt"
    "io"
    "net"
)

func writeFrame(w io.Writer, data []byte) error {
    // TODO: write 2-byte length prefix, then data
    return nil
}

func readFrame(r io.Reader) ([]byte, error) {
    // TODO: read 2-byte length prefix, then read that many bytes
    return nil, nil
}

func main() {
    server, client := net.Pipe()

    go func() {
        writeFrame(client, []byte("alpha"))
        writeFrame(client, []byte("beta"))
        writeFrame(client, []byte("gamma"))
        client.Close()
    }()

    for {
        frame, err := readFrame(server)
        if err != nil {
            break
        }
        fmt.Printf("Received: %s\n", frame)
    }
}
```

## Expected Output

```
Received: alpha
Received: beta
Received: gamma
```

## Hint

Use `binary.BigEndian.PutUint16` to write the length and `binary.BigEndian.Uint16` to read it. Remember to use `io.ReadFull` for both the 2-byte header and the payload.

## Solution

```go
package main

import (
    "encoding/binary"
    "fmt"
    "io"
    "net"
)

func writeFrame(w io.Writer, data []byte) error {
    header := make([]byte, 2)
    binary.BigEndian.PutUint16(header, uint16(len(data)))
    if _, err := w.Write(header); err != nil {
        return err
    }
    _, err := w.Write(data)
    return err
}

func readFrame(r io.Reader) ([]byte, error) {
    header := make([]byte, 2)
    if _, err := io.ReadFull(r, header); err != nil {
        return nil, err
    }
    length := binary.BigEndian.Uint16(header)
    payload := make([]byte, length)
    if _, err := io.ReadFull(r, payload); err != nil {
        return nil, err
    }
    return payload, nil
}

func main() {
    server, client := net.Pipe()

    go func() {
        writeFrame(client, []byte("alpha"))
        writeFrame(client, []byte("beta"))
        writeFrame(client, []byte("gamma"))
        client.Close()
    }()

    for {
        frame, err := readFrame(server)
        if err != nil {
            break
        }
        fmt.Printf("Received: %s\n", frame)
    }
}
```
