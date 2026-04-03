---
id: "go-variables-and-types"
courseId: "go-systems"
moduleId: "go-fundamentals"
title: "Variables & Types"
description: "Learn Go's type system by modeling network packet headers and connection states."
order: 1
---

## Scenario

### The Scenario

You're building a TCP tunnel — similar to ngrok — that forwards traffic from a public endpoint to a local server. The first thing your tunnel needs is a way to represent connection metadata: the source IP, destination port, number of bytes transferred, and whether the connection is still alive.

Getting the types right matters. Using a `string` where you need a `uint16` for a port number means you'll waste memory across thousands of concurrent connections. Using a signed integer where you need unsigned means you'll hit negative values in your byte counters.

## Content

## Variables & Types

Go is a statically typed language. Every variable has a fixed type determined at compile time. Unlike dynamically typed languages, you can't assign a string to an integer variable — the compiler will reject it.

### Declaring Variables

There are several ways to declare variables in Go:

```go
// Explicit type declaration
var host string = "localhost"
var port uint16 = 8080
var isActive bool = true

// Type inference with var
var bytesTransferred int64 = 0

// Short declaration (most common inside functions)
connections := 0
maxRetries := 3
```

### Basic Types for Systems Programming

The types you'll use most when building low-level tools:

- `int`, `int8`, `int16`, `int32`, `int64` — signed integers
- `uint`, `uint8`, `uint16`, `uint32`, `uint64` — unsigned integers (byte counts, ports)
- `float64` — decimal numbers (latency measurements, rates)
- `bool` — true/false (connection state, flags)
- `string` — text (hostnames, log messages)
- `byte` — alias for `uint8` (raw data, buffers)

### Zero Values

In Go, variables declared without an explicit value get a **zero value**:

```go
var count int      // 0
var name string    // "" (empty string)
var active bool    // false
var rate float64   // 0.0
```

This is important in systems code — you don't get undefined behavior or null pointer exceptions from uninitialized variables.

### Constants

For values that never change, use `const`:

```go
const maxConnections = 1024
const defaultPort uint16 = 8080
const version = "1.0.0"
```

Constants are evaluated at compile time and cannot be changed.

## Why It Matters

In systems programming, type choices directly impact performance and correctness. Using `uint16` for port numbers (0-65535) instead of `int` saves memory when you're tracking thousands of connections. Using `byte` slices for network data lets you work directly with raw packets. Go's zero values eliminate an entire class of bugs — every variable is always initialized to a safe default, which matters when your tunnel is handling production traffic.

## Questions

Q: What is the zero value of a bool in Go?
A) true
B) null
C) false
D) undefined
Correct: C

Q: Which type is most appropriate for storing a network port number?
A) int
B) string
C) uint16
D) float64
Correct: C

Q: What does := do in Go?
A) Assigns a value to an existing variable
B) Declares and initializes a new variable with type inference
C) Creates a constant
D) Declares a variable without initializing it
Correct: B

## Challenge

Declare variables to represent a TCP connection: source IP (string), destination port (uint16), bytes sent (int64), and whether the connection is alive (bool). Print them all.

## Starter Code

```go
package main

import "fmt"

func main() {
	// Declare your variables here


	fmt.Printf("Connection: %s:%d | Bytes: %d | Active: %t\n", sourceIP, destPort, bytesSent, isAlive)
}
```

## Expected Output

```
Connection: 192.168.1.10:8080 | Bytes: 0 | Active: true
```

## Hint

Use short declaration `:=` for each variable. The source IP is a string like "192.168.1.10", the port is 8080, bytes start at 0, and the connection starts as alive (true).

## Solution

```go
package main

import "fmt"

func main() {
	sourceIP := "192.168.1.10"
	var destPort uint16 = 8080
	var bytesSent int64 = 0
	isAlive := true

	fmt.Printf("Connection: %s:%d | Bytes: %d | Active: %t\n", sourceIP, destPort, bytesSent, isAlive)
}
```
