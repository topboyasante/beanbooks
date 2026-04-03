---
id: "go-benchmarks"
courseId: "go-systems"
moduleId: "testing-systems"
title: "Benchmarks"
description: "Measure and compare the performance of Go code using the testing.B benchmark framework and pprof."
order: 2
---

## Scenario

Your storage engine encodes log entries into binary format before writing them to disk. Users report that writes are slower than expected. Is the bottleneck the binary encoding, the disk I/O, or memory allocation? Without benchmarks, you're guessing. "I think the encoding is slow" is not a debugging strategy.

Go's benchmark framework gives you precise, repeatable measurements: nanoseconds per operation, bytes allocated, allocations per operation. You can benchmark two implementations side-by-side and know — with numbers — which is faster and why. This is how you make performance decisions based on evidence, not intuition.

## Content

## Benchmarks

### Writing a Benchmark with testing.B

Benchmark functions start with `Benchmark`, take a `*testing.B` parameter, and run the code under test `b.N` times. The framework automatically adjusts `b.N` to get a statistically reliable measurement.

```go
package encoding

import (
    "encoding/binary"
    "testing"
)

func EncodeUint64(buf []byte, val uint64) {
    binary.BigEndian.PutUint64(buf, val)
}

func BenchmarkEncodeUint64(b *testing.B) {
    buf := make([]byte, 8)
    for i := 0; i < b.N; i++ {
        EncodeUint64(buf, uint64(i))
    }
}

// Run with: go test -bench=BenchmarkEncodeUint64 -benchmem
// Output:
// BenchmarkEncodeUint64-8    1000000000    0.29 ns/op    0 B/op    0 allocs/op
```

The output tells you: the function runs at 0.29 nanoseconds per operation, allocates zero bytes, and makes zero heap allocations. The `-8` suffix is `GOMAXPROCS`.

### Understanding b.N

`b.N` is not a fixed number. The framework starts with `b.N = 1`, runs the benchmark, then increases `b.N` (to 100, 10000, 1000000, etc.) until the total time is long enough for a reliable measurement (typically ~1 second).

```go
package encoding

import (
    "encoding/json"
    "testing"
)

type Message struct {
    Type    string `json:"type"`
    Payload string `json:"payload"`
    Seq     int    `json:"seq"`
}

func BenchmarkJSONMarshal(b *testing.B) {
    msg := Message{Type: "data", Payload: "hello world", Seq: 42}
    for i := 0; i < b.N; i++ {
        json.Marshal(msg)
    }
}

func BenchmarkJSONUnmarshal(b *testing.B) {
    data := []byte(`{"type":"data","payload":"hello world","seq":42}`)
    var msg Message
    for i := 0; i < b.N; i++ {
        json.Unmarshal(data, &msg)
    }
}
```

Never set `b.N` manually. Never use `b.N` as test data (e.g., don't encode `b.N` itself). The framework controls `b.N`.

### b.ResetTimer and b.ReportAllocs

Use `b.ResetTimer()` when your benchmark has expensive setup that shouldn't be measured. Use `b.ReportAllocs()` to include allocation statistics in the output.

```go
package encoding

import (
    "encoding/binary"
    "testing"
)

type Header struct {
    Version uint8
    Type    uint8
    Flags   uint16
    Length  uint32
}

func (h *Header) MarshalBinary() []byte {
    buf := make([]byte, 8)
    buf[0] = h.Version
    buf[1] = h.Type
    binary.BigEndian.PutUint16(buf[2:4], h.Flags)
    binary.BigEndian.PutUint32(buf[4:8], h.Length)
    return buf
}

func (h *Header) MarshalInto(buf []byte) {
    buf[0] = h.Version
    buf[1] = h.Type
    binary.BigEndian.PutUint16(buf[2:4], h.Flags)
    binary.BigEndian.PutUint32(buf[4:8], h.Length)
}

func BenchmarkMarshalAlloc(b *testing.B) {
    b.ReportAllocs()
    h := Header{Version: 1, Type: 2, Flags: 0x01, Length: 1024}

    // Expensive setup that shouldn't be timed
    _ = make([]byte, 1<<20) // 1 MB allocation

    b.ResetTimer() // start timing from here

    for i := 0; i < b.N; i++ {
        h.MarshalBinary() // allocates a new slice each time
    }
}

func BenchmarkMarshalNoAlloc(b *testing.B) {
    b.ReportAllocs()
    h := Header{Version: 1, Type: 2, Flags: 0x01, Length: 1024}
    buf := make([]byte, 8)

    b.ResetTimer()

    for i := 0; i < b.N; i++ {
        h.MarshalInto(buf) // reuses the buffer
    }
}

// BenchmarkMarshalAlloc-8      50000000    24.5 ns/op    8 B/op    1 allocs/op
// BenchmarkMarshalNoAlloc-8   500000000     2.1 ns/op    0 B/op    0 allocs/op
```

The difference is dramatic: pre-allocating the buffer makes the operation 10x faster by eliminating heap allocations.

### Comparing Implementations

The standard pattern for comparing implementations is to use sub-benchmarks. This makes the output easy to read and compare.

```go
package encoding

import (
    "bytes"
    "encoding/binary"
    "testing"
)

type Packet struct {
    Version uint8
    Type    uint8
    ConnID  uint32
    Port    uint16
}

func encodeReflection(p Packet) []byte {
    buf := new(bytes.Buffer)
    binary.Write(buf, binary.BigEndian, p)
    return buf.Bytes()
}

func encodeManual(p Packet) []byte {
    buf := make([]byte, 8)
    buf[0] = p.Version
    buf[1] = p.Type
    binary.BigEndian.PutUint32(buf[2:6], p.ConnID)
    binary.BigEndian.PutUint16(buf[6:8], p.Port)
    return buf
}

func BenchmarkEncode(b *testing.B) {
    p := Packet{Version: 1, Type: 5, ConnID: 12345, Port: 8080}

    b.Run("reflection", func(b *testing.B) {
        b.ReportAllocs()
        for i := 0; i < b.N; i++ {
            encodeReflection(p)
        }
    })

    b.Run("manual", func(b *testing.B) {
        b.ReportAllocs()
        for i := 0; i < b.N; i++ {
            encodeManual(p)
        }
    })
}

// BenchmarkEncode/reflection-8    3000000    450 ns/op   120 B/op    5 allocs/op
// BenchmarkEncode/manual-8       50000000     25 ns/op     8 B/op    1 allocs/op
```

### Profiling with pprof

When benchmarks show something is slow, `pprof` tells you exactly which line is responsible. Generate a CPU profile from a benchmark, then analyze it.

```go
package encoding

// To profile a benchmark:
//
// 1. Generate a CPU profile:
//    go test -bench=BenchmarkEncode/reflection -cpuprofile=cpu.prof
//
// 2. Analyze interactively:
//    go tool pprof cpu.prof
//    (pprof) top10           # shows top CPU consumers
//    (pprof) list encodeReflection  # shows line-by-line CPU usage
//
// 3. Generate a memory profile:
//    go test -bench=BenchmarkEncode -memprofile=mem.prof
//
// 4. Web visualization (if graphviz is installed):
//    go tool pprof -http=:8080 cpu.prof

import "testing"

// Example pprof output:
//
// (pprof) top5
//       flat  flat%   sum%        cum   cum%
//     300ms 42.86% 42.86%      300ms 42.86%  encoding/binary.(*encoder).value
//     150ms 21.43% 64.29%      150ms 21.43%  reflect.Value.Field
//     100ms 14.29% 78.57%      100ms 14.29%  runtime.mallocgc
//      50ms  7.14% 85.71%       50ms  7.14%  bytes.(*Buffer).Write
//      50ms  7.14% 92.86%      700ms 100.0%  encoding.encodeReflection

func TestPprofExample(t *testing.T) {
    t.Log("Run: go test -bench=. -cpuprofile=cpu.prof")
    t.Log("Then: go tool pprof cpu.prof")
}
```

## Why It Matters

Performance intuition is unreliable. Code that looks slow might be fast (the compiler optimized it). Code that looks fast might be slow (hidden allocations). Go's benchmark framework gives you reproducible measurements that remove guesswork from performance work. When someone asks "should we use JSON or binary encoding?" you don't argue — you benchmark. When a PR claims "this optimization makes parsing 3x faster," benchmarks prove or disprove it. This is how engineering decisions are made at companies like Google, Cloudflare, and CockroachDB.

## Questions

Q: What does `b.N` represent in a Go benchmark?
A) A fixed number you set to control benchmark duration
B) The number of iterations the framework automatically adjusts for reliable timing
C) The number of CPU cores used
D) The maximum number of allocations allowed
Correct: B

Q: What does `b.ResetTimer()` do?
A) Resets b.N to zero
B) Stops timing, discarding the time elapsed so far (useful for excluding setup time)
C) Restarts the benchmark from scratch
D) Resets the allocation counter
Correct: B

Q: In benchmark output `24.5 ns/op  8 B/op  1 allocs/op`, what does `1 allocs/op` mean?
A) The benchmark ran 1 iteration
B) Each operation made 1 heap memory allocation
C) The total memory used was 1 byte
D) 1 goroutine was created per operation
Correct: B

## Challenge

Write a benchmark comparing two ways to build a string from parts: using `+` concatenation in a loop vs using `strings.Builder`. Run both and observe the difference in allocations.

## Starter Code

```go
package main

import (
    "strings"
    "testing"
)

func buildConcat(parts []string) string {
    result := ""
    for _, p := range parts {
        result += p
    }
    return result
}

func buildBuilder(parts []string) string {
    // TODO: use strings.Builder
    return ""
}

func BenchmarkConcat(b *testing.B) {
    parts := []string{"GET", " ", "/api/status", " ", "HTTP/1.1"}
    // TODO
}

func BenchmarkBuilder(b *testing.B) {
    parts := []string{"GET", " ", "/api/status", " ", "HTTP/1.1"}
    // TODO
}
```

## Expected Output

```
BenchmarkConcat-8      5000000    250 ns/op    80 B/op    4 allocs/op
BenchmarkBuilder-8    20000000     85 ns/op    48 B/op    2 allocs/op
```

## Hint

For `buildBuilder`, create a `strings.Builder`, call `WriteString` for each part, and return `sb.String()`. In each benchmark, call `b.ReportAllocs()` and loop `b.N` times calling the function.

## Solution

```go
package main

import (
    "strings"
    "testing"
)

func buildConcat(parts []string) string {
    result := ""
    for _, p := range parts {
        result += p
    }
    return result
}

func buildBuilder(parts []string) string {
    var sb strings.Builder
    for _, p := range parts {
        sb.WriteString(p)
    }
    return sb.String()
}

func BenchmarkConcat(b *testing.B) {
    b.ReportAllocs()
    parts := []string{"GET", " ", "/api/status", " ", "HTTP/1.1"}
    for i := 0; i < b.N; i++ {
        buildConcat(parts)
    }
}

func BenchmarkBuilder(b *testing.B) {
    b.ReportAllocs()
    parts := []string{"GET", " ", "/api/status", " ", "HTTP/1.1"}
    for i := 0; i < b.N; i++ {
        buildBuilder(parts)
    }
}
```
