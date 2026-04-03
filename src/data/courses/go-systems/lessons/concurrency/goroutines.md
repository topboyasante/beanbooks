---
id: "go-goroutines"
courseId: "go-systems"
moduleId: "concurrency"
title: "Goroutines"
description: "Handle thousands of simultaneous connections with goroutines — Go's lightweight concurrency primitive."
order: 1
---

## Scenario

Your TCP tunnel is working, but it handles one connection at a time. While it's forwarding data for Client A, Client B has to wait. That's unacceptable for a production tunnel — you need to handle hundreds or thousands of simultaneous connections, each forwarding data independently.

In Go, you don't spawn heavyweight OS threads. You launch goroutines — lightweight functions that run concurrently, managed by Go's runtime scheduler. A single Go process can handle millions of goroutines because each one starts with only a few kilobytes of stack space that grows as needed.

## Content

## Goroutines

A goroutine is a function executing concurrently with other goroutines in the same address space. They're multiplexed onto OS threads by the Go runtime, so you get concurrency without the overhead of one thread per task.

### Launching Goroutines

Add the `go` keyword before any function call to run it as a goroutine:

```go
func handleConnection(conn net.Conn) {
    defer conn.Close()
    buf := make([]byte, 4096)
    for {
        n, err := conn.Read(buf)
        if err != nil {
            return
        }
        conn.Write(buf[:n]) // echo back
    }
}

func main() {
    listener, err := net.Listen("tcp", ":8080")
    if err != nil {
        log.Fatal(err)
    }
    for {
        conn, err := listener.Accept()
        if err != nil {
            log.Println(err)
            continue
        }
        go handleConnection(conn) // each connection gets its own goroutine
    }
}
```

You can also launch anonymous functions as goroutines:

```go
go func() {
    fmt.Println("running in background")
}()

go func(addr string) {
    fmt.Printf("connecting to %s\n", addr)
}("10.0.0.1:8080")
```

Always pass variables as arguments to anonymous goroutines rather than capturing them from the loop — otherwise you hit a classic closure bug:

```go
// BUG: all goroutines see the same (final) value of addr
for _, addr := range addrs {
    go func() {
        connect(addr) // captures loop variable
    }()
}

// CORRECT: pass addr as parameter
for _, addr := range addrs {
    go func(a string) {
        connect(a)
    }(addr)
}
```

### WaitGroup for Synchronization

When `main` exits, all goroutines are killed immediately. Use `sync.WaitGroup` to wait for goroutines to finish:

```go
func checkPort(host string, port int, wg *sync.WaitGroup) {
    defer wg.Done()
    addr := fmt.Sprintf("%s:%d", host, port)
    conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
    if err != nil {
        return
    }
    conn.Close()
    fmt.Printf("port %d is open\n", port)
}

func main() {
    var wg sync.WaitGroup
    host := "scanme.nmap.org"
    ports := []int{22, 80, 443, 8080, 8443}

    for _, port := range ports {
        wg.Add(1)
        go checkPort(host, port, &wg)
    }

    wg.Wait() // blocks until all goroutines call Done()
    fmt.Println("scan complete")
}
```

The three WaitGroup methods:
- `Add(n)` — increment the counter by n (call before launching the goroutine)
- `Done()` — decrement the counter by 1 (call inside the goroutine, typically with defer)
- `Wait()` — block until the counter reaches 0

### Goroutine Lifecycle

Goroutines run until their function returns. There's no way to forcefully kill a goroutine from the outside — you must design them to exit cleanly. Common exit strategies:

```go
// 1. Return when work is done
go func() {
    result := compute()
    fmt.Println(result)
    // goroutine exits when function returns
}()

// 2. Return on error
go func(conn net.Conn) {
    _, err := io.Copy(os.Stdout, conn)
    if err != nil {
        log.Println("connection error:", err)
    }
    // goroutine exits
}(conn)

// 3. Return on signal (done channel — covered in channels lesson)
go func(done <-chan struct{}) {
    for {
        select {
        case <-done:
            return
        default:
            doWork()
        }
    }
}(done)
```

A goroutine that never returns is a **goroutine leak**. It consumes memory and CPU forever. Always ensure your goroutines have a way to exit.

### Stack Growth

Each goroutine starts with a tiny stack (a few KB). The Go runtime automatically grows the stack when needed — up to a configurable maximum (default 1GB). This is why you can have millions of goroutines: they only use memory they actually need.

```go
func deepRecursion(depth int) {
    if depth == 0 {
        return
    }
    var buf [1024]byte // allocate 1KB on each stack frame
    _ = buf
    deepRecursion(depth - 1)
}

func main() {
    // This works fine — the stack grows automatically
    go deepRecursion(10000)
}
```

Compare this to OS threads, which typically allocate 1-8MB of stack upfront. With goroutines, you pay only for what you use.

### Goroutines vs Threads

| Feature | Goroutine | OS Thread |
|---|---|---|
| Stack size | ~2-8 KB (grows) | 1-8 MB (fixed) |
| Creation cost | ~1 microsecond | ~10-100 microseconds |
| Scheduling | Go runtime (M:N) | OS kernel |
| Context switch | ~200 ns | ~1-10 microseconds |
| Practical limit | Millions | Thousands |

## Why It Matters

Systems programs like tunnels, proxies, and servers must handle many things at once — thousands of connections, each with their own read/write loops. Goroutines make this possible without the complexity of thread pools or async/await. Because they're so cheap, you can use one goroutine per connection, per request, or per task without worrying about resource limits. The WaitGroup pattern ensures you don't lose work when the program exits. Understanding goroutine lifecycle prevents leaks that slowly degrade your server over hours of operation.

## Questions

Q: What happens to running goroutines when the main function exits?
A) They continue running in the background
B) They are immediately terminated
C) They are paused and resumed later
D) They cause a panic
Correct: B

Q: How much stack space does a new goroutine start with?
A) 1 MB, same as an OS thread
B) A few kilobytes, growing automatically as needed
C) 64 KB fixed allocation
D) No stack — it shares the main goroutine's stack
Correct: B

Q: What is the correct way to ensure a goroutine finishes before the program exits?
A) Call runtime.Goexit()
B) Use time.Sleep() with a long duration
C) Use sync.WaitGroup with Add, Done, and Wait
D) Set runtime.GOMAXPROCS to 1
Correct: C

## Challenge

Write a program that checks whether 5 different hosts are reachable by attempting TCP connections concurrently. Use goroutines and a WaitGroup to run all checks in parallel, then print results after all checks complete.

## Starter Code

```go
package main

import (
    "fmt"
    "net"
    "sync"
    "time"
)

func checkHost(host string, port int, wg *sync.WaitGroup) {
    defer wg.Done()
    // Try to connect with a 1-second timeout
    // Print whether the host is reachable or not
}

func main() {
    hosts := []struct {
        name string
        port int
    }{
        {"localhost", 80},
        {"localhost", 443},
        {"localhost", 22},
        {"localhost", 8080},
        {"localhost", 3000},
    }

    var wg sync.WaitGroup
    // Launch a goroutine for each host check

    wg.Wait()
    fmt.Println("All checks complete")
}
```

## Expected Output

```
localhost:22 is unreachable
localhost:80 is unreachable
localhost:443 is unreachable
localhost:3000 is unreachable
localhost:8080 is unreachable
All checks complete
```

## Hint

Use `net.DialTimeout("tcp", addr, timeout)` to attempt a connection. If `err != nil`, the host is unreachable. Don't forget to close the connection if it succeeds. Call `wg.Add(1)` before each `go` statement. The order of output may vary since goroutines run concurrently.

## Solution

```go
package main

import (
    "fmt"
    "net"
    "sync"
    "time"
)

func checkHost(host string, port int, wg *sync.WaitGroup) {
    defer wg.Done()
    addr := fmt.Sprintf("%s:%d", host, port)
    conn, err := net.DialTimeout("tcp", addr, 1*time.Second)
    if err != nil {
        fmt.Printf("%s is unreachable\n", addr)
        return
    }
    conn.Close()
    fmt.Printf("%s is reachable\n", addr)
}

func main() {
    hosts := []struct {
        name string
        port int
    }{
        {"localhost", 80},
        {"localhost", 443},
        {"localhost", 22},
        {"localhost", 8080},
        {"localhost", 3000},
    }

    var wg sync.WaitGroup
    for _, h := range hosts {
        wg.Add(1)
        go checkHost(h.name, h.port, &wg)
    }

    wg.Wait()
    fmt.Println("All checks complete")
}
```
