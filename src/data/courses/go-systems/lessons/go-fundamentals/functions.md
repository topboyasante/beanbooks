---
id: "go-functions"
courseId: "go-systems"
moduleId: "go-fundamentals"
title: "Functions"
description: "Master Go functions by building a network packet parser with multiple returns and composable operations."
order: 2
---

## Scenario

You're building a packet parser for your TCP tunnel. Raw bytes arrive on the wire, and you need to extract headers, validate checksums, and transform the payload before forwarding it. Each of these operations is a function — some return multiple values (the parsed result plus an error), some accept variable numbers of arguments (merging multiple packet fragments), and some get passed around as arguments (pluggable transformation steps).

Getting function design right determines whether your parser is a tangled mess or a clean pipeline of composable operations. Go's support for multiple return values, first-class functions, and variadic parameters gives you all the tools you need.

## Content

## Functions

Functions are the primary building blocks of Go programs. Unlike languages where methods dominate, Go encourages small, focused functions that do one thing well.

### Function Declarations

A basic function declaration includes the `func` keyword, a name, parameters, and an optional return type:

```go
// No return value
func logPacket(source string, size int) {
    fmt.Printf("[%s] received %d bytes\n", source, size)
}

// Single return value
func checksumValid(data []byte, expected uint32) bool {
    var sum uint32
    for _, b := range data {
        sum += uint32(b)
    }
    return sum == expected
}
```

Parameters of the same type can share a type declaration:

```go
func copyBytes(src, dst string, offset, length int) {
    // src and dst are both string, offset and length are both int
}
```

### Multiple Return Values

Go functions can return multiple values. This is fundamental to Go — it's how you return results alongside errors without exceptions:

```go
func parseHeader(raw []byte) (string, uint16, error) {
    if len(raw) < 6 {
        return "", 0, fmt.Errorf("header too short: %d bytes", len(raw))
    }
    host := string(raw[:4])
    port := binary.BigEndian.Uint16(raw[4:6])
    return host, port, nil
}

func main() {
    data := []byte{0x31, 0x30, 0x2e, 0x30, 0x1f, 0x90}
    host, port, err := parseHeader(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Parsed: %s:%d\n", host, port)
}
```

If you don't need one of the return values, use the blank identifier `_`:

```go
_, port, err := parseHeader(data)
```

### Named Return Values

Named return values act as pre-declared variables at the top of the function. A bare `return` statement returns their current values:

```go
func splitPacket(raw []byte) (header []byte, payload []byte, err error) {
    if len(raw) < 4 {
        err = fmt.Errorf("packet too small: %d bytes", len(raw))
        return // returns zero header, zero payload, and the error
    }
    header = raw[:4]
    payload = raw[4:]
    return // returns header, payload, nil
}
```

Named returns are most useful when the function has multiple exit points and you want to make it clear what's being returned. Avoid them in short functions where they add noise without clarity.

### Variadic Functions

Variadic functions accept a variable number of arguments of the same type. The parameter is received as a slice:

```go
func mergeFragments(fragments ...[]byte) []byte {
    totalLen := 0
    for _, f := range fragments {
        totalLen += len(f)
    }
    result := make([]byte, 0, totalLen)
    for _, f := range fragments {
        result = append(result, f...)
    }
    return result
}

func main() {
    frag1 := []byte{0x01, 0x02}
    frag2 := []byte{0x03, 0x04}
    frag3 := []byte{0x05}
    merged := mergeFragments(frag1, frag2, frag3)
    fmt.Printf("Merged %d bytes\n", len(merged)) // Merged 5 bytes
}
```

You can expand a slice into variadic arguments using `...`:

```go
allFrags := [][]byte{frag1, frag2, frag3}
merged := mergeFragments(allFrags...)
```

### First-Class Functions

Functions in Go are first-class values — you can assign them to variables, pass them as arguments, and return them from other functions:

```go
// A transform function type
type PacketTransform func([]byte) []byte

func applyTransforms(data []byte, transforms ...PacketTransform) []byte {
    result := data
    for _, t := range transforms {
        result = t(result)
    }
    return result
}

func compress(data []byte) []byte {
    // simplified — just trim trailing zeros
    i := len(data)
    for i > 0 && data[i-1] == 0 {
        i--
    }
    return data[:i]
}

func encrypt(data []byte) []byte {
    // simplified — XOR with key byte
    out := make([]byte, len(data))
    for i, b := range data {
        out[i] = b ^ 0xAA
    }
    return out
}

func main() {
    raw := []byte{0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x00}
    processed := applyTransforms(raw, compress, encrypt)
    fmt.Printf("Processed %d bytes\n", len(processed))
}
```

Anonymous functions (closures) capture variables from their enclosing scope:

```go
func makeCounter() func() int {
    count := 0
    return func() int {
        count++
        return count
    }
}

counter := makeCounter()
fmt.Println(counter()) // 1
fmt.Println(counter()) // 2
```

## Why It Matters

Functions are how you decompose a complex system into manageable pieces. In a packet parser, each function handles one concern — extracting headers, validating integrity, transforming payloads. Multiple return values let you propagate errors without exceptions, keeping the control flow explicit. First-class functions let you build composable pipelines where transforms can be swapped at runtime — critical when your tunnel needs different processing for different protocols.

## Questions

Q: What does Go use instead of exceptions for error handling in functions?
A) try/catch blocks
B) Multiple return values (result + error)
C) Global error variables
D) Panic for all errors
Correct: B

Q: What is the type of a variadic parameter `args ...int` inside the function?
A) int
B) *int
C) []int
D) [...]int
Correct: C

Q: What does the blank identifier `_` do when receiving return values?
A) Stores the value in a temporary variable
B) Discards the value, telling the compiler you intentionally ignore it
C) Sets the value to zero
D) Causes a compile error
Correct: B

## Challenge

Write a function `analyzePacket` that takes a byte slice and returns three values: the length (int), a checksum (uint32, sum of all bytes), and an error (if the slice is empty). Then write a `transformAll` function that applies a list of transform functions to a byte slice.

## Starter Code

```go
package main

import "fmt"

func analyzePacket(data []byte) (int, uint32, error) {
    // Return length, checksum (sum of all bytes), and error if empty
}

type Transform func([]byte) []byte

func transformAll(data []byte, transforms ...Transform) []byte {
    // Apply each transform in sequence
}

func main() {
    packet := []byte{0x48, 0x45, 0x4c, 0x4c, 0x4f}

    length, checksum, err := analyzePacket(packet)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Printf("Length: %d, Checksum: %d\n", length, checksum)

    upper := func(data []byte) []byte {
        out := make([]byte, len(data))
        for i, b := range data {
            if b >= 'a' && b <= 'z' {
                out[i] = b - 32
            } else {
                out[i] = b
            }
        }
        return out
    }

    result := transformAll(packet, upper)
    fmt.Printf("Transformed: %s\n", string(result))
}
```

## Expected Output

```
Length: 5, Checksum: 580
Transformed: HELLO
```

## Hint

For `analyzePacket`, check if `len(data) == 0` and return an error with `fmt.Errorf`. Loop through the bytes to compute the checksum. For `transformAll`, iterate over the transforms slice and apply each one to the result of the previous.

## Solution

```go
package main

import "fmt"

func analyzePacket(data []byte) (int, uint32, error) {
    if len(data) == 0 {
        return 0, 0, fmt.Errorf("empty packet")
    }
    var checksum uint32
    for _, b := range data {
        checksum += uint32(b)
    }
    return len(data), checksum, nil
}

type Transform func([]byte) []byte

func transformAll(data []byte, transforms ...Transform) []byte {
    result := data
    for _, t := range transforms {
        result = t(result)
    }
    return result
}

func main() {
    packet := []byte{0x48, 0x45, 0x4c, 0x4c, 0x4f}

    length, checksum, err := analyzePacket(packet)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Printf("Length: %d, Checksum: %d\n", length, checksum)

    upper := func(data []byte) []byte {
        out := make([]byte, len(data))
        for i, b := range data {
            if b >= 'a' && b <= 'z' {
                out[i] = b - 32
            } else {
                out[i] = b
            }
        }
        return out
    }

    result := transformAll(packet, upper)
    fmt.Printf("Transformed: %s\n", string(result))
}
```
