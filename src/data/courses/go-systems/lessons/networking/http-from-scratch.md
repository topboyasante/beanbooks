---
id: "go-http-from-scratch"
courseId: "go-systems"
moduleId: "networking"
title: "HTTP From Scratch"
description: "Build a minimal HTTP server on raw TCP sockets to understand what net/http does under the hood."
order: 4
---

## Scenario

You've been using `net/http` and it feels like magic — you register a handler and responses just work. But when your tunnel needs to inspect HTTP traffic flowing through it, you realize you don't actually understand the wire format. What does an HTTP request look like as raw bytes? How does the server know where headers end and the body begins? What exactly is a `Content-Length` header for?

Building an HTTP server on raw TCP — without importing `net/http` — forces you to understand the protocol. This is the same knowledge you need to build proxies, load balancers, or debug why your API is returning garbled responses.

## Content

## HTTP From Scratch

HTTP is a text-based protocol layered on top of TCP. A client sends a request as plain text, the server parses it, and sends back a response as plain text. That's it. Everything `net/http` does — routing, header parsing, chunked encoding — is built on this simple foundation.

### HTTP Request Format

Every HTTP request follows this structure:

```
GET /index.html HTTP/1.1\r\n
Host: localhost:8080\r\n
User-Agent: curl/7.88.1\r\n
Accept: */*\r\n
\r\n
```

The first line is the **request line**: method, path, and HTTP version. Then come headers as `Key: Value` pairs. An empty line (`\r\n\r\n`) marks the end of headers. If there's a body (POST/PUT), it follows after that blank line.

### Parsing the Request Line

Here's how to parse an HTTP request from a raw TCP connection:

```go
func parseRequest(conn net.Conn) (method, path, version string, headers map[string]string, err error) {
    reader := bufio.NewReader(conn)

    // Read the request line: "GET /path HTTP/1.1"
    requestLine, err := reader.ReadString('\n')
    if err != nil {
        return "", "", "", nil, fmt.Errorf("failed to read request line: %w", err)
    }
    requestLine = strings.TrimSpace(requestLine)

    parts := strings.SplitN(requestLine, " ", 3)
    if len(parts) != 3 {
        return "", "", "", nil, fmt.Errorf("malformed request line: %s", requestLine)
    }
    method = parts[0]   // GET, POST, etc.
    path = parts[1]     // /index.html
    version = parts[2]  // HTTP/1.1

    // Parse headers
    headers = make(map[string]string)
    for {
        line, err := reader.ReadString('\n')
        if err != nil {
            return "", "", "", nil, fmt.Errorf("failed to read header: %w", err)
        }
        line = strings.TrimSpace(line)
        if line == "" {
            break // Empty line = end of headers
        }
        colonIndex := strings.Index(line, ":")
        if colonIndex == -1 {
            continue
        }
        key := strings.TrimSpace(line[:colonIndex])
        value := strings.TrimSpace(line[colonIndex+1:])
        headers[key] = value
    }

    return method, path, version, headers, nil
}
```

The `\r\n` (carriage return + line feed) line endings are part of the HTTP spec. `strings.TrimSpace` handles both `\r\n` and `\n` so your server works even with non-compliant clients.

### Building HTTP Responses

An HTTP response has the same structure: status line, headers, blank line, body:

```go
func writeResponse(conn net.Conn, statusCode int, statusText string, body string) error {
    // Status line
    response := fmt.Sprintf("HTTP/1.1 %d %s\r\n", statusCode, statusText)

    // Headers
    response += fmt.Sprintf("Content-Length: %d\r\n", len(body))
    response += "Content-Type: text/plain\r\n"
    response += "Connection: close\r\n"

    // Blank line separating headers from body
    response += "\r\n"

    // Body
    response += body

    _, err := conn.Write([]byte(response))
    return err
}
```

`Content-Length` tells the client exactly how many bytes the body is. Without it, the client doesn't know when to stop reading. `Connection: close` tells the client we'll close the connection after this response (no keep-alive).

### Status Codes

Common status codes you'll implement:

```go
var statusTexts = map[int]string{
    200: "OK",
    201: "Created",
    400: "Bad Request",
    404: "Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
}
```

The status code is a 3-digit number. The text after it is purely for human readability — clients use the number, not the text.

### A Complete HTTP Server on Raw TCP

Putting it all together — a minimal HTTP server with routing, no `net/http`:

```go
package main

import (
    "bufio"
    "fmt"
    "log"
    "net"
    "strings"
    "time"
)

func writeResponse(conn net.Conn, statusCode int, statusText, contentType, body string) {
    response := fmt.Sprintf("HTTP/1.1 %d %s\r\n", statusCode, statusText)
    response += fmt.Sprintf("Content-Length: %d\r\n", len(body))
    response += fmt.Sprintf("Content-Type: %s\r\n", contentType)
    response += fmt.Sprintf("Date: %s\r\n", time.Now().UTC().Format(time.RFC1123))
    response += "Connection: close\r\n"
    response += "\r\n"
    response += body
    conn.Write([]byte(response))
}

func handleHTTP(conn net.Conn) {
    defer conn.Close()

    reader := bufio.NewReader(conn)
    requestLine, err := reader.ReadString('\n')
    if err != nil {
        return
    }

    parts := strings.SplitN(strings.TrimSpace(requestLine), " ", 3)
    if len(parts) != 3 {
        writeResponse(conn, 400, "Bad Request", "text/plain", "malformed request")
        return
    }

    method, path := parts[0], parts[1]
    fmt.Printf("%s %s\n", method, path)

    // Simple routing
    switch {
    case method == "GET" && path == "/":
        writeResponse(conn, 200, "OK", "text/plain", "welcome to the server")
    case method == "GET" && path == "/health":
        writeResponse(conn, 200, "OK", "text/plain", "ok")
    default:
        writeResponse(conn, 404, "Not Found", "text/plain", "not found")
    }
}

func main() {
    listener, err := net.Listen("tcp", ":8080")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }
    defer listener.Close()
    fmt.Println("HTTP server listening on :8080")

    for {
        conn, err := listener.Accept()
        if err != nil {
            log.Printf("accept error: %v", err)
            continue
        }
        go handleHTTP(conn)
    }
}
```

### Content-Length and Why It Matters

Without `Content-Length`, the client has two options: read until the connection closes (slow, can't reuse the connection) or guess when the body ends (unreliable). This is why `Content-Length` is critical:

```go
// Wrong: client doesn't know body size
response := "HTTP/1.1 200 OK\r\n\r\nHello"

// Right: client knows exactly 5 bytes to read
response := "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nHello"
```

If `Content-Length` doesn't match the actual body length, you get truncated responses or hanging connections.

## Why It Matters

Every web framework, reverse proxy, and load balancer speaks HTTP. When you understand the raw wire format, you can debug problems that are invisible at the `net/http` level: why a proxy is mangling headers, why a response is being truncated, why keep-alive connections are timing out. Building HTTP from scratch also demystifies what frameworks do for you — and shows you it's just text over TCP.

## Questions

Q: What marks the end of HTTP headers in a request?
A) A null byte
B) The Content-Length header
C) An empty line (double CRLF: \r\n\r\n)
D) The EOF of the TCP stream
Correct: C

Q: What happens if Content-Length is set to 10 but the actual body is 15 bytes?
A) The client reads all 15 bytes correctly
B) The client only reads 10 bytes, missing the last 5
C) The server automatically corrects it
D) The connection is encrypted
Correct: B

Q: What are the three parts of an HTTP request line?
A) Host, Port, Path
B) Method, Path, HTTP Version
C) Header, Body, Footer
D) Protocol, Address, Payload
Correct: B

## Challenge

Build a minimal HTTP server on raw TCP (no `net/http`) that listens on port 8080 and responds to GET requests to `/time` with the current time. Any other path should return 404.

## Starter Code

```go
package main

import (
    "bufio"
    "fmt"
    "log"
    "net"
    "strings"
    "time"
)

func handleConn(conn net.Conn) {
    defer conn.Close()

    // Parse the request line

    // Route: /time returns current time, everything else returns 404

    // Write the HTTP response
}

func main() {
    // Listen and accept connections
}
```

## Expected Output

```
HTTP server listening on :8080
GET /time
GET /unknown
```

When curled:
```
$ curl http://localhost:8080/time
2026-04-02 15:04:05

$ curl http://localhost:8080/unknown
not found
```

## Hint

Use `bufio.NewReader(conn)` to read the request line, then split it on spaces to get the method and path. Build the response string manually with the status line, `Content-Length` header, blank line, and body. Use `time.Now().Format("2006-01-02 15:04:05")` for the time.

## Solution

```go
package main

import (
    "bufio"
    "fmt"
    "log"
    "net"
    "strings"
    "time"
)

func writeResp(conn net.Conn, status int, statusText, body string) {
    resp := fmt.Sprintf("HTTP/1.1 %d %s\r\n", status, statusText)
    resp += fmt.Sprintf("Content-Length: %d\r\n", len(body))
    resp += "Content-Type: text/plain\r\n"
    resp += "Connection: close\r\n"
    resp += "\r\n"
    resp += body
    conn.Write([]byte(resp))
}

func handleConn(conn net.Conn) {
    defer conn.Close()

    reader := bufio.NewReader(conn)
    requestLine, err := reader.ReadString('\n')
    if err != nil {
        return
    }

    parts := strings.SplitN(strings.TrimSpace(requestLine), " ", 3)
    if len(parts) < 2 {
        writeResp(conn, 400, "Bad Request", "bad request")
        return
    }

    method, path := parts[0], parts[1]
    fmt.Printf("%s %s\n", method, path)

    if method == "GET" && path == "/time" {
        now := time.Now().Format("2006-01-02 15:04:05")
        writeResp(conn, 200, "OK", now)
    } else {
        writeResp(conn, 404, "Not Found", "not found")
    }
}

func main() {
    listener, err := net.Listen("tcp", ":8080")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }
    defer listener.Close()
    fmt.Println("HTTP server listening on :8080")

    for {
        conn, err := listener.Accept()
        if err != nil {
            log.Printf("accept error: %v", err)
            continue
        }
        go handleConn(conn)
    }
}
```
