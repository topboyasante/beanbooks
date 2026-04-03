---
id: "go-dns-resolver"
courseId: "go-systems"
moduleId: "networking"
title: "DNS Resolver"
description: "Build a DNS resolver that constructs queries, parses responses, and resolves domain names from scratch."
order: 5
---

## Scenario

Your TCP tunnel accepts connections by IP address, but users want to connect using domain names like `tunnel.example.com`. You could call `net.LookupHost` and be done — but then you can't control which DNS servers you query, you can't cache responses, and you can't debug DNS resolution failures. Building a DNS resolver from scratch teaches you the packet format that underpins every domain name lookup on the internet.

DNS is one of the most critical pieces of internet infrastructure. When DNS breaks, nothing works. Understanding the wire format means you can debug resolution failures, build custom DNS servers, and implement DNS-based service discovery.

## Content

## DNS Resolver

DNS (Domain Name System) translates domain names to IP addresses. It uses a binary packet format over UDP on port 53. Every DNS query and response follows the same structure: a header, a question section, and (for responses) answer records.

### DNS Packet Structure

A DNS packet has a fixed 12-byte header followed by variable-length sections:

```
+---------------------+
|        Header       |  12 bytes
+---------------------+
|       Question      |  variable
+---------------------+
|        Answer       |  variable (response only)
+---------------------+
|      Authority      |  variable (response only)
+---------------------+
|      Additional     |  variable (response only)
+---------------------+
```

The header fields in Go:

```go
type DNSHeader struct {
    ID      uint16 // Transaction ID — matches query to response
    Flags   uint16 // QR, Opcode, AA, TC, RD, RA, RCODE
    QDCount uint16 // Number of questions
    ANCount uint16 // Number of answers
    NSCount uint16 // Number of authority records
    ARCount uint16 // Number of additional records
}
```

### Encoding Domain Names

DNS encodes domain names as a sequence of labels. Each label is prefixed by its length byte, and the name ends with a zero byte:

```go
// encodeDomainName converts "example.com" to DNS wire format
func encodeDomainName(domain string) []byte {
    var buf []byte
    parts := strings.Split(domain, ".")
    for _, part := range parts {
        buf = append(buf, byte(len(part)))    // Length prefix
        buf = append(buf, []byte(part)...)    // Label bytes
    }
    buf = append(buf, 0) // Terminating zero byte
    return buf
}

// "example.com" becomes: [7]example[3]com[0]
// In bytes: 0x07 0x65 0x78 0x61 0x6d 0x70 0x6c 0x65 0x03 0x63 0x6f 0x6d 0x00
```

### Building a DNS Query

A query packet needs a header and a question. Here's how to build one for an A record (IPv4 address) lookup:

```go
package main

import (
    "encoding/binary"
    "math/rand"
    "strings"
)

const (
    TypeA    uint16 = 1  // IPv4 address
    TypeAAAA uint16 = 28 // IPv6 address
    ClassIN  uint16 = 1  // Internet class
)

func buildDNSQuery(domain string, qtype uint16) []byte {
    // Header
    header := make([]byte, 12)
    id := uint16(rand.Intn(65535))
    binary.BigEndian.PutUint16(header[0:2], id)      // Transaction ID
    binary.BigEndian.PutUint16(header[2:4], 0x0100)   // Flags: RD=1 (recursion desired)
    binary.BigEndian.PutUint16(header[4:6], 1)         // 1 question
    binary.BigEndian.PutUint16(header[6:8], 0)         // 0 answers
    binary.BigEndian.PutUint16(header[8:10], 0)        // 0 authority
    binary.BigEndian.PutUint16(header[10:12], 0)       // 0 additional

    // Question section
    question := encodeDomainName(domain)
    question = append(question, 0, 0) // Placeholder for type and class
    binary.BigEndian.PutUint16(question[len(question)-4:len(question)-2], qtype)
    binary.BigEndian.PutUint16(question[len(question)-2:], ClassIN)

    return append(header, question...)
}
```

All multi-byte integers in DNS are **big-endian** (network byte order). Go's `encoding/binary.BigEndian` handles this.

### Sending the Query Over UDP

DNS uses UDP port 53. Send the query and read the response:

```go
func queryDNS(server, domain string, qtype uint16) ([]byte, error) {
    query := buildDNSQuery(domain, qtype)

    conn, err := net.DialTimeout("udp", server+":53", 5*time.Second)
    if err != nil {
        return nil, fmt.Errorf("dial failed: %w", err)
    }
    defer conn.Close()

    conn.SetDeadline(time.Now().Add(5 * time.Second))

    _, err = conn.Write(query)
    if err != nil {
        return nil, fmt.Errorf("write failed: %w", err)
    }

    response := make([]byte, 512) // Standard DNS UDP max size
    n, err := conn.Read(response)
    if err != nil {
        return nil, fmt.Errorf("read failed: %w", err)
    }

    return response[:n], nil
}
```

### Parsing DNS Responses

The response contains the same header, followed by answers. Each answer record has a name, type, class, TTL, and the record data:

```go
func parseDNSResponse(response []byte) ([]string, error) {
    if len(response) < 12 {
        return nil, fmt.Errorf("response too short")
    }

    // Parse header
    answerCount := binary.BigEndian.Uint16(response[6:8])
    rcode := response[3] & 0x0F
    if rcode != 0 {
        return nil, fmt.Errorf("DNS error, rcode: %d", rcode)
    }

    // Skip the question section
    offset := 12
    // Skip the encoded domain name
    for offset < len(response) && response[offset] != 0 {
        labelLen := int(response[offset])
        offset += labelLen + 1
    }
    offset += 5 // Skip null byte + QTYPE (2) + QCLASS (2)

    // Parse answer records
    var results []string
    for i := 0; i < int(answerCount) && offset < len(response); i++ {
        // Handle name (might be a pointer)
        if response[offset]&0xC0 == 0xC0 {
            offset += 2 // Compressed name pointer — 2 bytes
        } else {
            for offset < len(response) && response[offset] != 0 {
                offset += int(response[offset]) + 1
            }
            offset++ // Skip null terminator
        }

        if offset+10 > len(response) {
            break
        }

        rtype := binary.BigEndian.Uint16(response[offset : offset+2])
        offset += 2 // Type
        offset += 2 // Class
        offset += 4 // TTL
        dataLen := binary.BigEndian.Uint16(response[offset : offset+2])
        offset += 2

        if rtype == TypeA && dataLen == 4 && offset+4 <= len(response) {
            ip := fmt.Sprintf("%d.%d.%d.%d",
                response[offset], response[offset+1],
                response[offset+2], response[offset+3])
            results = append(results, ip)
        }

        offset += int(dataLen)
    }

    return results, nil
}
```

The `0xC0` check handles DNS **name compression** — a pointer to a name that appeared earlier in the packet. This saves space when the same domain name appears in both the question and answer sections.

### Putting It Together

```go
func main() {
    server := "8.8.8.8" // Google's public DNS
    domain := "example.com"

    response, err := queryDNS(server, domain, TypeA)
    if err != nil {
        log.Fatalf("query failed: %v", err)
    }

    ips, err := parseDNSResponse(response)
    if err != nil {
        log.Fatalf("parse failed: %v", err)
    }

    fmt.Printf("DNS results for %s:\n", domain)
    for _, ip := range ips {
        fmt.Printf("  A: %s\n", ip)
    }
}
```

## Why It Matters

DNS is the foundation of the internet's naming system. Every HTTP request, every database connection, every API call starts with a DNS lookup. When you build a DNS resolver from scratch, you understand what happens before `net.Dial` even starts. This knowledge is essential for building custom DNS servers (for service discovery), implementing DNS-based load balancing, debugging resolution failures, and understanding why `nslookup` works but your application doesn't — which is almost always a DNS caching or search domain issue.

## Questions

Q: How are domain names encoded in DNS wire format?
A) As null-terminated ASCII strings
B) As a sequence of length-prefixed labels ending with a zero byte
C) As Base64-encoded strings
D) As comma-separated values
Correct: B

Q: What does the 0xC0 prefix in a DNS name field indicate?
A) The name is encrypted
B) The name is a compressed pointer to a name elsewhere in the packet
C) The name is in Unicode format
D) The record type is CNAME
Correct: B

Q: Why does DNS primarily use UDP instead of TCP?
A) UDP supports larger packets
B) UDP is more secure
C) DNS queries are small, and UDP avoids TCP's connection setup overhead
D) TCP doesn't support port 53
Correct: C

## Challenge

Build a program that sends a DNS query for the A record of "example.com" to Google's DNS server (8.8.8.8) and prints the resolved IP addresses.

## Starter Code

```go
package main

import (
    "encoding/binary"
    "fmt"
    "log"
    "net"
    "strings"
    "time"
)

func encodeDomainName(domain string) []byte {
    var buf []byte
    parts := strings.Split(domain, ".")
    for _, part := range parts {
        buf = append(buf, byte(len(part)))
        buf = append(buf, []byte(part)...)
    }
    buf = append(buf, 0)
    return buf
}

func main() {
    domain := "example.com"

    // Build the DNS query packet

    // Send to 8.8.8.8:53 over UDP

    // Parse the response and print IP addresses

}
```

## Expected Output

```
querying 8.8.8.8 for example.com...
A: 93.184.216.34
```

## Hint

Build a 12-byte header with a random ID, flags `0x0100` (recursion desired), and QDCount of 1. Append the encoded domain name followed by type A (1) and class IN (1) as big-endian uint16s. Send over UDP to `8.8.8.8:53` and parse the answer section of the response.

## Solution

```go
package main

import (
    "encoding/binary"
    "fmt"
    "log"
    "math/rand"
    "net"
    "strings"
    "time"
)

func encodeDomainName(domain string) []byte {
    var buf []byte
    parts := strings.Split(domain, ".")
    for _, part := range parts {
        buf = append(buf, byte(len(part)))
        buf = append(buf, []byte(part)...)
    }
    buf = append(buf, 0)
    return buf
}

func main() {
    domain := "example.com"
    fmt.Printf("querying 8.8.8.8 for %s...\n", domain)

    // Build header
    header := make([]byte, 12)
    binary.BigEndian.PutUint16(header[0:2], uint16(rand.Intn(65535)))
    binary.BigEndian.PutUint16(header[2:4], 0x0100)
    binary.BigEndian.PutUint16(header[4:6], 1)

    // Build question
    name := encodeDomainName(domain)
    typClass := make([]byte, 4)
    binary.BigEndian.PutUint16(typClass[0:2], 1) // Type A
    binary.BigEndian.PutUint16(typClass[2:4], 1) // Class IN

    query := append(header, name...)
    query = append(query, typClass...)

    // Send query
    conn, err := net.DialTimeout("udp", "8.8.8.8:53", 5*time.Second)
    if err != nil {
        log.Fatalf("dial failed: %v", err)
    }
    defer conn.Close()
    conn.SetDeadline(time.Now().Add(5 * time.Second))

    _, err = conn.Write(query)
    if err != nil {
        log.Fatalf("write failed: %v", err)
    }

    resp := make([]byte, 512)
    n, err := conn.Read(resp)
    if err != nil {
        log.Fatalf("read failed: %v", err)
    }
    resp = resp[:n]

    // Parse response
    ansCount := binary.BigEndian.Uint16(resp[6:8])
    offset := 12
    for offset < len(resp) && resp[offset] != 0 {
        offset += int(resp[offset]) + 1
    }
    offset += 5

    for i := 0; i < int(ansCount) && offset < len(resp); i++ {
        if resp[offset]&0xC0 == 0xC0 {
            offset += 2
        } else {
            for offset < len(resp) && resp[offset] != 0 {
                offset += int(resp[offset]) + 1
            }
            offset++
        }
        rtype := binary.BigEndian.Uint16(resp[offset : offset+2])
        offset += 8 // type + class + TTL
        dataLen := binary.BigEndian.Uint16(resp[offset : offset+2])
        offset += 2

        if rtype == 1 && dataLen == 4 {
            fmt.Printf("A: %d.%d.%d.%d\n",
                resp[offset], resp[offset+1], resp[offset+2], resp[offset+3])
        }
        offset += int(dataLen)
    }
}
```
