---
id: "go-streaming"
courseId: "go-systems"
moduleId: "io-filesystems"
title: "Streaming"
description: "Stream large data through pipelines without loading it all into memory."
order: 4
---

## Scenario

A user is uploading a 2GB file through your TCP tunnel. The naive approach — read the entire file into memory, then forward it — would consume 2GB of RAM per upload. With 10 concurrent uploads, that's 20GB. Your tunnel server has 512MB.

Streaming solves this. Instead of loading the file into memory, you read a small chunk, forward it, read the next chunk, forward it. At any point, you're holding maybe 32KB in memory regardless of the file's total size. This is how production proxies, CDNs, and file transfer tools handle arbitrarily large data.

## Content

## Streaming

Streaming means processing data as it flows through without accumulating it. Go's `io` package provides primitives that make this natural: `io.Pipe` for in-process streaming, `io.LimitReader` for bounding reads, and `io.Copy` for efficient forwarding.

### io.Pipe — Synchronous In-Process Streams

`io.Pipe` creates a connected Reader and Writer. Writing to the Writer makes data available on the Reader, with no internal buffering:

```go
pr, pw := io.Pipe()

// Writer goroutine — produces data
go func() {
    defer pw.Close()
    for i := 0; i < 5; i++ {
        fmt.Fprintf(pw, "chunk %d\n", i)
        time.Sleep(500 * time.Millisecond) // Simulate slow production
    }
}()

// Reader — consumes data as it arrives
scanner := bufio.NewScanner(pr)
for scanner.Scan() {
    fmt.Printf("received: %s\n", scanner.Text())
}
```

Key detail: `io.Pipe` is **synchronous**. `pw.Write` blocks until `pr.Read` consumes the data. This makes it safe for coordinating producer-consumer patterns without external synchronization. Closing the writer sends `io.EOF` to the reader.

### Streaming Large Files

Instead of `io.ReadAll`, stream file contents through a pipeline:

```go
func streamFile(src string, dst io.Writer) error {
    file, err := os.Open(src)
    if err != nil {
        return err
    }
    defer file.Close()

    // io.Copy uses a 32KB buffer internally
    // Only 32KB is in memory at any time, regardless of file size
    written, err := io.Copy(dst, file)
    if err != nil {
        return fmt.Errorf("copy failed: %w", err)
    }

    fmt.Printf("streamed %d bytes\n", written)
    return nil
}

// Forward a file through a tunnel connection
func forwardFile(filename string, tunnelConn net.Conn) error {
    return streamFile(filename, tunnelConn)
}
```

`io.Copy` never loads the entire file. It reads a chunk, writes it, reads the next chunk, writes it. Memory usage stays constant.

### io.LimitReader — Bounding Input

`io.LimitReader` wraps a Reader and stops after N bytes. Essential for preventing memory exhaustion from malicious or oversized input:

```go
// Only read up to 1MB from the connection
limited := io.LimitReader(conn, 1024*1024)
data, err := io.ReadAll(limited)
if err != nil {
    log.Printf("read error: %v", err)
}
fmt.Printf("read %d bytes (max 1MB)\n", len(data))
```

Without `LimitReader`, a client could send infinite data and crash your server. Always limit untrusted input:

```go
// HTTP request body limit
const maxBodySize = 10 * 1024 * 1024 // 10MB
body := io.LimitReader(req.Body, maxBodySize)
```

### Progress Tracking

Wrap a Reader to track how much data has been transferred:

```go
type ProgressReader struct {
    reader    io.Reader
    total     int64
    read      int64
    onProgress func(read, total int64)
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
    n, err := pr.reader.Read(p)
    pr.read += int64(n)
    if pr.onProgress != nil {
        pr.onProgress(pr.read, pr.total)
    }
    return n, err
}

// Usage
func uploadWithProgress(file *os.File, conn net.Conn) error {
    info, _ := file.Stat()
    progress := &ProgressReader{
        reader: file,
        total:  info.Size(),
        onProgress: func(read, total int64) {
            pct := float64(read) / float64(total) * 100
            fmt.Printf("\ruploading: %.1f%% (%d/%d bytes)", pct, read, total)
        },
    }

    _, err := io.Copy(conn, progress)
    fmt.Println() // Newline after progress
    return err
}
```

This works because `ProgressReader` implements `io.Reader` — it composes with `io.Copy` and everything else.

### Chunked Transfer

When you don't know the total size upfront, process data in explicit chunks:

```go
func forwardInChunks(src io.Reader, dst io.Writer, chunkSize int) (int64, error) {
    buf := make([]byte, chunkSize)
    var totalWritten int64

    for {
        n, readErr := src.Read(buf)
        if n > 0 {
            written, writeErr := dst.Write(buf[:n])
            totalWritten += int64(written)
            if writeErr != nil {
                return totalWritten, writeErr
            }
            if written != n {
                return totalWritten, io.ErrShortWrite
            }
        }
        if readErr != nil {
            if readErr == io.EOF {
                return totalWritten, nil
            }
            return totalWritten, readErr
        }
    }
}

// Forward tunnel traffic in 8KB chunks
total, err := forwardInChunks(clientConn, serverConn, 8192)
fmt.Printf("forwarded %d bytes\n", total)
```

This is essentially what `io.Copy` does internally, but exposing the loop lets you add custom logic per chunk — logging, rate limiting, compression.

## Why It Matters

Memory is finite, data is not. Every production system that handles file uploads, data pipelines, log aggregation, or network proxying must stream data rather than buffer it. A tunnel that loads entire transfers into memory is a crash waiting to happen. The streaming primitives in Go's `io` package — `Pipe`, `LimitReader`, `Copy` — compose into pipelines that can handle terabytes of data with kilobytes of memory. This is how `docker pull` streams layers, how `kubectl logs` tails containers, and how your tunnel will forward traffic without falling over.

## Questions

Q: What makes io.Pipe different from a bytes.Buffer?
A) io.Pipe is faster
B) io.Pipe has no internal buffer — writes block until the data is read, making it synchronous
C) io.Pipe can only transfer strings
D) bytes.Buffer supports concurrent access and io.Pipe does not
Correct: B

Q: Why should you use io.LimitReader on untrusted input?
A) It encrypts the data
B) It compresses the data to save memory
C) It prevents a malicious sender from exhausting memory by sending unlimited data
D) It makes reading faster
Correct: C

Q: How much memory does io.Copy use regardless of the data size?
A) It loads the entire source into memory
B) About 32KB for its internal buffer
C) 1MB fixed
D) It depends on the source file size
Correct: B

## Challenge

Build a program that uses `io.Pipe` to stream 5 numbered messages from a producer goroutine to a consumer that prints each one. Track and print the total bytes transferred.

## Starter Code

```go
package main

import (
    "bufio"
    "fmt"
    "io"
)

func main() {
    // Create an io.Pipe

    // Producer goroutine: write 5 messages to the pipe writer

    // Consumer: read from the pipe reader and print each message

    // Print total bytes transferred
}
```

## Expected Output

```
received: message 1: hello from the pipeline
received: message 2: hello from the pipeline
received: message 3: hello from the pipeline
received: message 4: hello from the pipeline
received: message 5: hello from the pipeline
total bytes transferred: 170
```

## Hint

Use `io.Pipe()` to get a paired reader and writer. In a goroutine, write 5 messages with `fmt.Fprintf(pw, ...)` and then close the writer. In the main goroutine, use `bufio.NewScanner(pr)` to read line by line. Track bytes by counting the length of each scanned line plus the newline character.

## Solution

```go
package main

import (
    "bufio"
    "fmt"
    "io"
)

func main() {
    pr, pw := io.Pipe()

    go func() {
        defer pw.Close()
        for i := 1; i <= 5; i++ {
            fmt.Fprintf(pw, "message %d: hello from the pipeline\n", i)
        }
    }()

    var totalBytes int64
    scanner := bufio.NewScanner(pr)
    for scanner.Scan() {
        line := scanner.Text()
        totalBytes += int64(len(line)) + 1 // +1 for newline
        fmt.Printf("received: %s\n", line)
    }

    fmt.Printf("total bytes transferred: %d\n", totalBytes)
}
```
