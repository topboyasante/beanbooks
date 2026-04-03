---
id: "go-table-driven-tests"
courseId: "go-systems"
moduleId: "testing-systems"
title: "Table-Driven Tests"
description: "Write comprehensive test suites using Go's table-driven test pattern with subtests and test helpers."
order: 1
---

## Scenario

You've built a wire protocol parser that reads binary messages off a TCP stream. It needs to handle valid messages, truncated headers, zero-length payloads, maximum-size payloads, unknown message types, and corrupted checksums. That's at least a dozen test cases for a single function. Writing each as a separate `Test` function creates massive duplication — the same setup, assertion, and teardown code repeated over and over.

Table-driven tests are Go's answer to this problem. You define a slice of test cases — each with a name, input, and expected output — and loop over them. Adding a new edge case is one line in the table. The pattern is so fundamental to Go that the standard library, Kubernetes, Docker, and virtually every major Go project uses it.

## Content

## Table-Driven Tests

### Testing Package Basics

Go's `testing` package is built into the language. Test files end in `_test.go` and test functions start with `Test`. The `*testing.T` parameter provides methods for reporting failures.

```go
package protocol

import "testing"

// ParseMessageType extracts the message type from a header byte.
func ParseMessageType(header byte) string {
    switch header {
    case 0x01:
        return "HANDSHAKE"
    case 0x02:
        return "DATA"
    case 0x03:
        return "CLOSE"
    default:
        return "UNKNOWN"
    }
}

func TestParseMessageType(t *testing.T) {
    result := ParseMessageType(0x01)
    if result != "HANDSHAKE" {
        t.Errorf("ParseMessageType(0x01) = %q, want %q", result, "HANDSHAKE")
    }
}
```

Key methods on `*testing.T`:
- `t.Errorf()` — reports a failure but continues the test
- `t.Fatalf()` — reports a failure and stops the test immediately
- `t.Logf()` — prints output only when the test fails or `-v` is used
- `t.Skip()` — skips the test (useful for platform-specific tests)

### The Table-Driven Pattern

Instead of writing separate test functions, define a slice of test cases and iterate:

```go
package protocol

import "testing"

func ParseMessageType(header byte) string {
    switch header {
    case 0x01:
        return "HANDSHAKE"
    case 0x02:
        return "DATA"
    case 0x03:
        return "CLOSE"
    default:
        return "UNKNOWN"
    }
}

func TestParseMessageType(t *testing.T) {
    tests := []struct {
        name   string
        input  byte
        want   string
    }{
        {"handshake", 0x01, "HANDSHAKE"},
        {"data", 0x02, "DATA"},
        {"close", 0x03, "CLOSE"},
        {"unknown zero", 0x00, "UNKNOWN"},
        {"unknown high", 0xFF, "UNKNOWN"},
        {"unknown mid", 0x50, "UNKNOWN"},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := ParseMessageType(tt.input)
            if got != tt.want {
                t.Errorf("ParseMessageType(0x%02X) = %q, want %q",
                    tt.input, got, tt.want)
            }
        })
    }
}
```

Each test case runs as a subtest with its own name. When a test fails, the output shows exactly which case failed: `TestParseMessageType/unknown_zero`. You can run a single subtest with `go test -run TestParseMessageType/handshake`.

### Subtests with t.Run

`t.Run` creates subtests that can be filtered, run in parallel, and have independent failure states. This is essential for organizing complex test suites.

```go
package framing

import (
    "encoding/binary"
    "testing"
)

func DecodeHeader(data []byte) (msgType uint8, length uint32, err error) {
    if len(data) < 8 {
        return 0, 0, &HeaderError{"header too short"}
    }
    return data[1], binary.BigEndian.Uint32(data[4:8]), nil
}

type HeaderError struct {
    msg string
}

func (e *HeaderError) Error() string { return e.msg }

func TestDecodeHeader(t *testing.T) {
    t.Run("valid headers", func(t *testing.T) {
        tests := []struct {
            name     string
            data     []byte
            wantType uint8
            wantLen  uint32
        }{
            {
                name:     "data message",
                data:     []byte{1, 0x02, 0, 0, 0, 0, 0, 100},
                wantType: 0x02,
                wantLen:  100,
            },
            {
                name:     "close message",
                data:     []byte{1, 0x03, 0, 0, 0, 0, 0, 0},
                wantType: 0x03,
                wantLen:  0,
            },
        }

        for _, tt := range tests {
            t.Run(tt.name, func(t *testing.T) {
                msgType, length, err := DecodeHeader(tt.data)
                if err != nil {
                    t.Fatalf("unexpected error: %v", err)
                }
                if msgType != tt.wantType {
                    t.Errorf("type = 0x%02X, want 0x%02X", msgType, tt.wantType)
                }
                if length != tt.wantLen {
                    t.Errorf("length = %d, want %d", length, tt.wantLen)
                }
            })
        }
    })

    t.Run("error cases", func(t *testing.T) {
        tests := []struct {
            name string
            data []byte
        }{
            {"empty", []byte{}},
            {"too short", []byte{1, 2, 3}},
            {"seven bytes", []byte{1, 2, 3, 4, 5, 6, 7}},
        }

        for _, tt := range tests {
            t.Run(tt.name, func(t *testing.T) {
                _, _, err := DecodeHeader(tt.data)
                if err == nil {
                    t.Error("expected error, got nil")
                }
            })
        }
    })
}
```

### Test Helpers

Helper functions reduce duplication in tests. Call `t.Helper()` so that when the helper reports a failure, the error points to the caller's line number, not the helper's.

```go
package protocol

import (
    "encoding/binary"
    "testing"
)

func buildTestMessage(t *testing.T, msgType uint8, payload string) []byte {
    t.Helper() // marks this as a helper — errors show caller's line
    data := make([]byte, 8+len(payload))
    data[0] = 1 // version
    data[1] = msgType
    binary.BigEndian.PutUint32(data[4:8], uint32(len(payload)))
    copy(data[8:], payload)
    return data
}

func assertNoError(t *testing.T, err error) {
    t.Helper()
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
}

func assertEqual(t *testing.T, got, want string) {
    t.Helper()
    if got != want {
        t.Errorf("got %q, want %q", got, want)
    }
}

func TestWithHelpers(t *testing.T) {
    msg := buildTestMessage(t, 0x02, "test payload")
    if len(msg) != 20 {
        t.Errorf("message length = %d, want 20", len(msg))
    }
}
```

### The testdata Directory

Go has a convention: test fixtures go in a `testdata` directory. The `go` tool ignores this directory during builds. Use it for sample protocol captures, golden files, or binary test data.

```go
package parser

import (
    "os"
    "path/filepath"
    "testing"
)

func TestParseFromFile(t *testing.T) {
    // testdata/valid_handshake.bin contains a captured handshake message
    data, err := os.ReadFile(filepath.Join("testdata", "valid_handshake.bin"))
    if err != nil {
        t.Fatalf("reading test fixture: %v", err)
    }

    if len(data) < 8 {
        t.Fatalf("fixture too short: %d bytes", len(data))
    }

    version := data[0]
    if version != 1 {
        t.Errorf("version = %d, want 1", version)
    }

    // Golden file testing: compare output against a known-good file
    // Update golden files with: go test -update
    // golden := filepath.Join("testdata", "expected_output.golden")
    // expected, _ := os.ReadFile(golden)
}
```

The `testdata` pattern keeps test fixtures organized and version-controlled alongside the code they test.

## Why It Matters

Table-driven tests are the backbone of testing in Go. The pattern scales from testing a single utility function to testing an entire wire protocol parser with hundreds of edge cases. When you add a new feature or fix a bug, the test is one new row in the table — not a new function with duplicated setup code. The Go standard library itself uses table-driven tests extensively, and code reviews in Go projects will expect this pattern. It makes tests readable, maintainable, and easy to extend.

## Questions

Q: What is the purpose of calling `t.Helper()` in a test helper function?
A) It makes the helper function run faster
B) It marks the function as a helper so that failure messages report the caller's line number, not the helper's
C) It skips the test if the helper fails
D) It runs the helper in parallel
Correct: B

Q: How do you run a single subtest from the command line?
A) go test -only TestName/subtestName
B) go test -run TestName/subtestName
C) go test -sub TestName/subtestName
D) go test -filter TestName/subtestName
Correct: B

Q: What is the `testdata` directory convention in Go?
A) A directory for temporary test output
B) A directory ignored by `go build` where test fixtures and sample data are stored
C) A directory for benchmark results
D) A required directory for all Go test packages
Correct: B

## Challenge

Write a table-driven test for a `Validate` function that checks if a port number is valid (1-65535). Test cases should include: valid port, zero, negative (if using int), and maximum value.

## Starter Code

```go
package main

import (
    "fmt"
    "testing"
)

func Validate(port int) error {
    if port < 1 || port > 65535 {
        return fmt.Errorf("invalid port: %d", port)
    }
    return nil
}

func TestValidate(t *testing.T) {
    tests := []struct {
        name    string
        port    int
        wantErr bool
    }{
        // TODO: add test cases
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // TODO: call Validate and check error
        })
    }
}
```

## Expected Output

```
=== RUN   TestValidate
=== RUN   TestValidate/valid_port_80
=== RUN   TestValidate/valid_port_8080
=== RUN   TestValidate/valid_max_65535
=== RUN   TestValidate/invalid_zero
=== RUN   TestValidate/invalid_negative
=== RUN   TestValidate/invalid_too_high
--- PASS: TestValidate (0.00s)
    --- PASS: TestValidate/valid_port_80 (0.00s)
    --- PASS: TestValidate/valid_port_8080 (0.00s)
    --- PASS: TestValidate/valid_max_65535 (0.00s)
    --- PASS: TestValidate/invalid_zero (0.00s)
    --- PASS: TestValidate/invalid_negative (0.00s)
    --- PASS: TestValidate/invalid_too_high (0.00s)
```

## Hint

Add entries like `{"valid port 80", 80, false}` and `{"invalid zero", 0, true}` to the test table. In the loop body, call `Validate(tt.port)` and check if the error matches `tt.wantErr`.

## Solution

```go
package main

import (
    "fmt"
    "testing"
)

func Validate(port int) error {
    if port < 1 || port > 65535 {
        return fmt.Errorf("invalid port: %d", port)
    }
    return nil
}

func TestValidate(t *testing.T) {
    tests := []struct {
        name    string
        port    int
        wantErr bool
    }{
        {"valid port 80", 80, false},
        {"valid port 8080", 8080, false},
        {"valid max 65535", 65535, false},
        {"invalid zero", 0, true},
        {"invalid negative", -1, true},
        {"invalid too high", 65536, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := Validate(tt.port)
            if (err != nil) != tt.wantErr {
                t.Errorf("Validate(%d) error = %v, wantErr = %v",
                    tt.port, err, tt.wantErr)
            }
        })
    }
}
```
