---
id: "go-readers-writers"
courseId: "go-systems"
moduleId: "io-filesystems"
title: "Readers & Writers"
description: "Master Go's io.Reader and io.Writer interfaces — the foundation of all I/O in Go."
order: 1
---

## Scenario

Your TCP tunnel forwards traffic between a public endpoint and a local server. But now you need to add logging — you want to capture every byte flowing through the tunnel for debugging without disrupting the traffic. You can't just save the data and forward it later; the traffic needs to flow in real-time while a copy goes to a log file.

This is exactly what Go's `io.Reader` and `io.Writer` interfaces are designed for. With `io.TeeReader`, you can read from a connection and simultaneously write the same bytes to a log file. With `io.MultiWriter`, you can write to the tunnel and a debug console at the same time.

## Content

## Readers & Writers

`io.Reader` and `io.Writer` are the two most important interfaces in Go. Almost everything that does I/O — files, network connections, HTTP bodies, compression streams, encryption — implements one or both. Understanding them means you can compose I/O operations like building blocks.

### The io.Reader Interface

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}
```

That's the entire interface. One method. You pass in a byte slice, and `Read` fills it with data and returns how many bytes were written. When there's no more data, it returns `io.EOF`.

Types that implement `io.Reader`: `os.File`, `net.Conn`, `http.Response.Body`, `bytes.Buffer`, `strings.Reader`, `gzip.Reader`, and hundreds more.

### The io.Writer Interface

```go
type Writer interface {
    Write(p []byte) (n int, err error)
}
```

Same simplicity. You give it bytes, it writes them somewhere. `os.File`, `net.Conn`, `http.ResponseWriter`, `bytes.Buffer`, `os.Stdout` — all writers.

### io.Copy — The Workhorse

`io.Copy` reads from a Reader and writes to a Writer until EOF:

```go
// Copy all data from a network connection to a file
file, _ := os.Create("traffic.log")
defer file.Close()

bytesWritten, err := io.Copy(file, conn) // dst, src
if err != nil {
    log.Printf("copy error: %v", err)
}
fmt.Printf("captured %d bytes\n", bytesWritten)
```

`io.Copy` handles the read loop, buffer management, and EOF detection for you. It uses a 32KB internal buffer. For a custom buffer size, use `io.CopyBuffer`.

### io.ReadAll — Read Everything

When you know the data fits in memory:

```go
data, err := io.ReadAll(conn)
if err != nil {
    log.Fatalf("read failed: %v", err)
}
fmt.Printf("received %d bytes: %s\n", len(data), data)
```

Warning: `io.ReadAll` loads the entire stream into memory. Never use this for large files or untrusted network streams — you'll run out of memory.

### Building a Custom Reader

Implementing `io.Reader` lets you create data sources that work with all of Go's I/O functions:

```go
// CountingReader wraps a reader and counts bytes read
type CountingReader struct {
    reader    io.Reader
    BytesRead int64
}

func NewCountingReader(r io.Reader) *CountingReader {
    return &CountingReader{reader: r}
}

func (cr *CountingReader) Read(p []byte) (int, error) {
    n, err := cr.reader.Read(p)
    cr.BytesRead += int64(n)
    return n, err
}

// Usage:
counter := NewCountingReader(conn)
io.Copy(os.Stdout, counter)
fmt.Printf("total bytes: %d\n", counter.BytesRead)
```

Because `CountingReader` implements `io.Reader`, it works with `io.Copy`, `bufio.NewScanner`, `json.NewDecoder`, and everything else that accepts a Reader.

### io.TeeReader — Read and Spy

`io.TeeReader` creates a Reader that writes to a Writer everything it reads. Perfect for logging traffic:

```go
// Log everything read from the connection to a file
logFile, _ := os.Create("tunnel-traffic.log")
defer logFile.Close()

tee := io.TeeReader(conn, logFile)

// Reading from tee reads from conn AND writes to logFile
buf := make([]byte, 1024)
n, err := tee.Read(buf)
// buf now has the data from conn
// logFile also has the same data
```

### io.MultiWriter — Write to Multiple Destinations

`io.MultiWriter` creates a Writer that duplicates writes to multiple writers:

```go
// Write to both the tunnel connection and stdout for debugging
multi := io.MultiWriter(tunnelConn, os.Stdout)

// This single Write goes to both destinations
multi.Write([]byte("forwarding traffic...\n"))

// Works with io.Copy too — forward traffic while printing it
io.Copy(multi, localConn)
```

## Why It Matters

Go's I/O interfaces are the glue between every part of the standard library. A function that accepts an `io.Reader` works with files, network connections, HTTP bodies, compressed streams, encrypted channels, and in-memory buffers — without knowing or caring which one it's dealing with. This composability is what makes Go excellent for systems programming. You can build a logging proxy by chaining a TeeReader, add compression by wrapping a Writer in gzip.NewWriter, or add encryption by wrapping in tls.Conn — all without changing the code that does the actual reading and writing.

## Questions

Q: What method does the io.Reader interface require?
A) ReadAll(p []byte) (int, error)
B) Read(p []byte) (n int, err error)
C) Read() ([]byte, error)
D) ReadBytes(delim byte) ([]byte, error)
Correct: B

Q: What does io.TeeReader do?
A) Reads from two readers simultaneously
B) Creates a reader that also writes everything it reads to a given writer
C) Splits a reader into two separate streams
D) Compresses data as it reads
Correct: B

Q: Why should you avoid io.ReadAll on untrusted network streams?
A) It doesn't support TCP connections
B) It reads everything into memory, which could exhaust RAM on large or malicious streams
C) It doesn't handle io.EOF correctly
D) It only works with files
Correct: B

## Challenge

Build a program that reads from a string source, counts the bytes read using a custom CountingReader, and writes the data to stdout. Print the total bytes counted after the copy completes.

## Starter Code

```go
package main

import (
    "fmt"
    "io"
    "os"
    "strings"
)

type CountingReader struct {
    reader    io.Reader
    BytesRead int64
}

// Implement the Read method

func main() {
    source := strings.NewReader("Hello from the TCP tunnel! This data is being counted.")

    // Wrap source in CountingReader

    // Copy to stdout

    // Print total bytes
}
```

## Expected Output

```
Hello from the TCP tunnel! This data is being counted.
Total bytes read: 54
```

## Hint

Implement `Read(p []byte) (int, error)` on `CountingReader` by delegating to `cr.reader.Read(p)` and adding `n` to `cr.BytesRead`. Then use `io.Copy(os.Stdout, counter)` to drive the copy.

## Solution

```go
package main

import (
    "fmt"
    "io"
    "os"
    "strings"
)

type CountingReader struct {
    reader    io.Reader
    BytesRead int64
}

func (cr *CountingReader) Read(p []byte) (int, error) {
    n, err := cr.reader.Read(p)
    cr.BytesRead += int64(n)
    return n, err
}

func main() {
    source := strings.NewReader("Hello from the TCP tunnel! This data is being counted.")

    counter := &CountingReader{reader: source}

    io.Copy(os.Stdout, counter)

    fmt.Printf("\nTotal bytes read: %d\n", counter.BytesRead)
}
```
