---
id: "go-buffers"
courseId: "go-systems"
moduleId: "io-filesystems"
title: "Buffers"
description: "Use buffered I/O to dramatically improve throughput in network and file operations."
order: 2
---

## Scenario

Your TCP tunnel is working, but performance is terrible under load. Profiling shows the bottleneck: you're calling `conn.Read` and `conn.Write` for every tiny chunk of data. Each call is a system call — a round trip from user space to the kernel and back. When you're forwarding thousands of small HTTP headers, each one triggers a separate syscall. That overhead adds up fast.

Buffered I/O fixes this by batching many small reads into one large read, and many small writes into one large write. Instead of 1000 syscalls for 1000 bytes, you make 1 syscall for 1000 bytes. The difference in throughput can be 10x or more.

## Content

## Buffers

Buffered I/O sits between your code and the underlying Reader/Writer, accumulating data before performing the actual I/O operation. Go provides two main buffering tools: `bytes.Buffer` for in-memory byte storage and `bufio.Reader/Writer` for wrapping I/O sources.

### bytes.Buffer — In-Memory Byte Storage

`bytes.Buffer` is a growable byte slice that implements both `io.Reader` and `io.Writer`:

```go
var buf bytes.Buffer

// Write to the buffer
buf.WriteString("HTTP/1.1 200 OK\r\n")
buf.WriteString("Content-Type: text/plain\r\n")
buf.WriteString("\r\n")
buf.WriteString("hello world")

// Read the entire contents as a string
fmt.Println(buf.String())

// Or use it as an io.Reader
io.Copy(conn, &buf)
```

`bytes.Buffer` is perfect for building up data before sending it. Instead of multiple `conn.Write` calls (each a syscall), you build the entire response in a buffer and send it in one shot.

### bufio.Reader — Buffered Reading

`bufio.NewReader` wraps any `io.Reader` with an internal buffer (default 4096 bytes):

```go
// Without buffering: each Read hits the network
n, _ := conn.Read(buf) // syscall

// With buffering: reads are served from an internal buffer
reader := bufio.NewReader(conn)
n, _ := reader.Read(buf) // may not need a syscall
```

When you call `reader.Read`, it first checks its internal buffer. If there's data, it returns that without touching the network. If the buffer is empty, it reads a large chunk from the underlying connection into the buffer, then serves your request from that.

### bufio.Scanner — Line-by-Line Reading

`bufio.Scanner` is built on top of `bufio.Reader` and is perfect for text protocols:

```go
scanner := bufio.NewScanner(conn)
for scanner.Scan() {
    line := scanner.Text()
    fmt.Printf("received: %s\n", line)

    if line == "QUIT" {
        break
    }
}
if err := scanner.Err(); err != nil {
    log.Printf("scan error: %v", err)
}
```

By default, `Scanner` splits on newlines. You can customize this with `scanner.Split()` using built-in split functions like `bufio.ScanWords` or `bufio.ScanBytes`, or write your own.

Setting a larger buffer for scanner when lines might be long:

```go
scanner := bufio.NewScanner(conn)
scanner.Buffer(make([]byte, 64*1024), 1024*1024) // 64KB initial, 1MB max
```

### bufio.Writer — Buffered Writing

`bufio.NewWriter` batches multiple small writes into larger ones:

```go
writer := bufio.NewWriter(conn)

// These don't hit the network yet — they go into the buffer
writer.WriteString("HTTP/1.1 200 OK\r\n")
writer.WriteString("Content-Length: 5\r\n")
writer.WriteString("\r\n")
writer.WriteString("hello")

// NOW send everything in one syscall
err := writer.Flush()
if err != nil {
    log.Printf("flush error: %v", err)
}
```

Critical: **you must call `Flush()`** to send buffered data. If you forget, data stays in the buffer and never reaches the destination. This is the most common buffered I/O bug.

### Flush Semantics

`Flush` writes any buffered data to the underlying writer. You should flush:
- After writing a complete message/response
- Before reading (if doing request-response on the same connection)
- Before closing the connection

```go
writer := bufio.NewWriter(conn)
defer writer.Flush() // Always flush before the function returns

writer.WriteString("response data")
// Flush happens automatically when the function returns
```

### Choosing Buffer Sizes

The default buffer size is 4096 bytes. For high-throughput scenarios, larger buffers reduce syscall overhead:

```go
// Default: 4096 bytes
reader := bufio.NewReader(conn)

// Custom size: 32KB for high-throughput tunnel
reader = bufio.NewReaderSize(conn, 32*1024)

// Custom writer buffer
writer := bufio.NewWriterSize(conn, 32*1024)
```

Bigger isn't always better. A 1MB buffer wastes memory if you're handling thousands of connections that each send small messages. Match the buffer size to your workload.

## Why It Matters

The difference between buffered and unbuffered I/O is the difference between a tunnel that handles 100 connections and one that handles 10,000. Every syscall has overhead — context switching, kernel scheduling, cache invalidation. Buffering amortizes that cost across many operations. This is why every production-grade server uses buffered I/O, and why forgetting to `Flush()` is one of the most common bugs in network programming. Understanding buffers also explains why your program seems to "lose" data — it's sitting in an unflushed buffer.

## Questions

Q: What happens if you forget to call Flush() on a bufio.Writer?
A) The data is automatically flushed when the buffer is full
B) The data stays in the buffer and may never reach the destination
C) The program panics
D) The data is written unbuffered directly
Correct: B

Q: Why does buffered I/O improve performance?
A) It compresses data before sending
B) It encrypts data for faster transmission
C) It batches many small reads/writes into fewer syscalls, reducing overhead
D) It uses UDP instead of TCP internally
Correct: C

Q: What is the default buffer size for bufio.NewReader?
A) 1024 bytes
B) 4096 bytes
C) 32768 bytes
D) 65536 bytes
Correct: B

## Challenge

Build a program that writes 5 lines to a `bytes.Buffer`, then copies the buffer contents to stdout. Print the total buffer size before copying.

## Starter Code

```go
package main

import (
    "bytes"
    "fmt"
    "io"
    "os"
)

func main() {
    var buf bytes.Buffer

    // Write 5 log-style lines to the buffer

    // Print the buffer size

    // Copy buffer contents to stdout
}
```

## Expected Output

```
buffer size: 130 bytes
[2026-04-02] connection from 192.168.1.1
[2026-04-02] connection from 192.168.1.2
[2026-04-02] connection from 10.0.0.1
[2026-04-02] connection from 172.16.0.5
[2026-04-02] connection from 192.168.1.100
```

## Hint

Use `buf.WriteString()` to add each line. Check the size with `buf.Len()`. Then use `io.Copy(os.Stdout, &buf)` to print the buffer contents. Remember that `bytes.Buffer` implements `io.Reader`.

## Solution

```go
package main

import (
    "bytes"
    "fmt"
    "io"
    "os"
)

func main() {
    var buf bytes.Buffer

    buf.WriteString("[2026-04-02] connection from 192.168.1.1\n")
    buf.WriteString("[2026-04-02] connection from 192.168.1.2\n")
    buf.WriteString("[2026-04-02] connection from 10.0.0.1\n")
    buf.WriteString("[2026-04-02] connection from 172.16.0.5\n")
    buf.WriteString("[2026-04-02] connection from 192.168.1.100\n")

    fmt.Printf("buffer size: %d bytes\n", buf.Len())

    io.Copy(os.Stdout, &buf)
}
```
