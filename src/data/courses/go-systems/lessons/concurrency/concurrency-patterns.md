---
id: "go-concurrency-patterns"
courseId: "go-systems"
moduleId: "concurrency"
title: "Concurrency Patterns"
description: "Build production-grade concurrent systems with fan-out/fan-in, worker pools, pipelines, and context cancellation."
order: 5
---

## Scenario

You're building a concurrent port scanner that checks thousands of ports on a target host. Scanning ports one at a time would take minutes — each connection attempt blocks for up to 2 seconds on timeout. You need to fan out across many goroutines, limit concurrency to avoid flooding the network, collect results from all workers, and cancel everything gracefully if the user hits Ctrl+C.

These recurring patterns — fan-out/fan-in, worker pools, pipelines, and context-based cancellation — are the building blocks of every serious Go program.

## Content

## Concurrency Patterns

These patterns compose goroutines and channels into reliable, scalable architectures.

### Fan-Out / Fan-In

**Fan-out** distributes work across multiple goroutines. **Fan-in** collects results from multiple goroutines into a single channel:

```go
// Fan-in: merge multiple channels into one
func merge(channels ...<-chan ScanResult) <-chan ScanResult {
    var wg sync.WaitGroup
    merged := make(chan ScanResult)

    output := func(ch <-chan ScanResult) {
        defer wg.Done()
        for result := range ch {
            merged <- result
        }
    }

    wg.Add(len(channels))
    for _, ch := range channels {
        go output(ch)
    }

    go func() {
        wg.Wait()
        close(merged)
    }()

    return merged
}

type ScanResult struct {
    Port   int
    Open   bool
    Banner string
}

// Fan-out: launch multiple scanners
func scanRange(host string, startPort, endPort int) <-chan ScanResult {
    out := make(chan ScanResult)
    go func() {
        defer close(out)
        for port := startPort; port <= endPort; port++ {
            addr := fmt.Sprintf("%s:%d", host, port)
            conn, err := net.DialTimeout("tcp", addr, 1*time.Second)
            if err != nil {
                out <- ScanResult{Port: port, Open: false}
                continue
            }
            conn.Close()
            out <- ScanResult{Port: port, Open: true}
        }
    }()
    return out
}

func main() {
    // Fan-out: split port range across 4 scanners
    ch1 := scanRange("localhost", 1, 250)
    ch2 := scanRange("localhost", 251, 500)
    ch3 := scanRange("localhost", 501, 750)
    ch4 := scanRange("localhost", 751, 1000)

    // Fan-in: merge all results
    for result := range merge(ch1, ch2, ch3, ch4) {
        if result.Open {
            fmt.Printf("port %d is open\n", result.Port)
        }
    }
}
```

### Worker Pool

A worker pool limits concurrency to a fixed number of goroutines. Jobs go in through a channel, results come out through another:

```go
type PortJob struct {
    Host string
    Port int
}

func worker(id int, jobs <-chan PortJob, results chan<- ScanResult) {
    for job := range jobs {
        addr := fmt.Sprintf("%s:%d", job.Host, job.Port)
        conn, err := net.DialTimeout("tcp", addr, 1*time.Second)
        open := err == nil
        if open {
            conn.Close()
        }
        results <- ScanResult{Port: job.Port, Open: open}
    }
}

func scanWithPool(host string, ports []int, numWorkers int) []ScanResult {
    jobs := make(chan PortJob, len(ports))
    results := make(chan ScanResult, len(ports))

    // Start workers
    for w := 0; w < numWorkers; w++ {
        go worker(w, jobs, results)
    }

    // Send jobs
    for _, port := range ports {
        jobs <- PortJob{Host: host, Port: port}
    }
    close(jobs)

    // Collect results
    var scanResults []ScanResult
    for i := 0; i < len(ports); i++ {
        scanResults = append(scanResults, <-results)
    }
    return scanResults
}

func main() {
    ports := make([]int, 1000)
    for i := range ports {
        ports[i] = i + 1
    }
    results := scanWithPool("localhost", ports, 50) // 50 concurrent workers

    for _, r := range results {
        if r.Open {
            fmt.Printf("port %d open\n", r.Port)
        }
    }
}
```

The worker pool pattern gives you bounded concurrency — you won't open 65,535 simultaneous connections and overwhelm the target or exhaust file descriptors.

### Pipeline Pattern

Pipelines chain processing stages. Each stage is a goroutine that reads from an input channel and writes to an output channel:

```go
func generatePorts(start, end int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for i := start; i <= end; i++ {
            out <- i
        }
    }()
    return out
}

func scanPorts(host string, ports <-chan int) <-chan ScanResult {
    out := make(chan ScanResult)
    go func() {
        defer close(out)
        for port := range ports {
            addr := fmt.Sprintf("%s:%d", host, port)
            conn, err := net.DialTimeout("tcp", addr, 1*time.Second)
            open := err == nil
            if open {
                conn.Close()
            }
            out <- ScanResult{Port: port, Open: open}
        }
    }()
    return out
}

func filterOpen(results <-chan ScanResult) <-chan ScanResult {
    out := make(chan ScanResult)
    go func() {
        defer close(out)
        for r := range results {
            if r.Open {
                out <- r
            }
        }
    }()
    return out
}

func main() {
    // Pipeline: generate -> scan -> filter
    ports := generatePorts(1, 100)
    scanned := scanPorts("localhost", ports)
    openPorts := filterOpen(scanned)

    for result := range openPorts {
        fmt.Printf("open: %d\n", result.Port)
    }
}
```

### Context for Cancellation

The `context` package provides structured cancellation that propagates through function call chains. Use it instead of bare done channels:

```go
func scanWithContext(ctx context.Context, host string, port int) ScanResult {
    dialer := net.Dialer{Timeout: 1 * time.Second}
    conn, err := dialer.DialContext(ctx, "tcp", fmt.Sprintf("%s:%d", host, port))
    if err != nil {
        return ScanResult{Port: port, Open: false}
    }
    conn.Close()
    return ScanResult{Port: port, Open: true}
}

func main() {
    // Cancel all scans after 10 seconds
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    results := make(chan ScanResult, 100)
    var wg sync.WaitGroup

    for port := 1; port <= 100; port++ {
        wg.Add(1)
        go func(p int) {
            defer wg.Done()
            select {
            case <-ctx.Done():
                return
            case results <- scanWithContext(ctx, "localhost", p):
            }
        }(port)
    }

    go func() {
        wg.Wait()
        close(results)
    }()

    for r := range results {
        if r.Open {
            fmt.Printf("port %d open\n", r.Port)
        }
    }
}
```

Context values:
- `context.WithCancel` — manually cancel with `cancel()`
- `context.WithTimeout` — auto-cancel after a duration
- `context.WithDeadline` — auto-cancel at a specific time
- `ctx.Done()` — channel that closes when context is cancelled
- `ctx.Err()` — returns `context.Canceled` or `context.DeadlineExceeded`

### errgroup for Concurrent Error Handling

The `golang.org/x/sync/errgroup` package combines WaitGroup with error propagation and context cancellation:

```go
import "golang.org/x/sync/errgroup"

func scanCriticalPorts(host string, ports []int) error {
    g, ctx := errgroup.WithContext(context.Background())

    results := make(chan ScanResult, len(ports))

    for _, port := range ports {
        port := port // capture loop variable
        g.Go(func() error {
            select {
            case <-ctx.Done():
                return ctx.Err()
            default:
            }
            addr := fmt.Sprintf("%s:%d", host, port)
            conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
            if err != nil {
                return fmt.Errorf("critical port %d unreachable: %w", port, err)
            }
            conn.Close()
            results <- ScanResult{Port: port, Open: true}
            return nil
        })
    }

    // Wait returns the first error (and cancels the context)
    if err := g.Wait(); err != nil {
        close(results)
        return err
    }
    close(results)

    for r := range results {
        fmt.Printf("port %d verified\n", r.Port)
    }
    return nil
}
```

When any goroutine in the group returns an error, the context is cancelled, signaling all other goroutines to stop.

## Why It Matters

These patterns are the vocabulary of concurrent Go. Worker pools prevent resource exhaustion — you control exactly how many goroutines are active. Fan-out/fan-in lets you parallelize independent work and aggregate results efficiently. Pipelines decompose complex processing into reusable stages. Context cancellation ensures that when a user cancels a request or a timeout fires, all spawned goroutines clean up promptly instead of leaking. errgroup ties it all together with proper error propagation. A port scanner that takes 30 minutes sequentially finishes in seconds with a 100-worker pool — and shuts down cleanly when you hit Ctrl+C.

## Questions

Q: What problem does a worker pool solve that unbounded goroutines don't?
A) Worker pools are faster per goroutine
B) Worker pools limit concurrency to prevent resource exhaustion
C) Worker pools provide better error handling
D) Worker pools eliminate the need for channels
Correct: B

Q: What happens when one goroutine in an errgroup returns an error?
A) All goroutines are immediately killed
B) The error is silently ignored
C) The context is cancelled, signaling other goroutines to stop
D) The program panics
Correct: C

Q: In the pipeline pattern, how does a downstream stage know the upstream is done?
A) The upstream sends a special "done" value
B) The upstream closes its output channel
C) The downstream checks a shared boolean flag
D) The downstream times out
Correct: B

## Challenge

Build a worker pool that processes 10 jobs. Create 3 worker goroutines that read from a jobs channel, "process" each job (just format a string), and send results to a results channel. Collect and print all results.

## Starter Code

```go
package main

import (
    "fmt"
    "sync"
)

type Job struct {
    ID   int
    Data string
}

type Result struct {
    JobID  int
    Output string
}

func worker(id int, jobs <-chan Job, results chan<- Result, wg *sync.WaitGroup) {
    defer wg.Done()
    // Process each job from the jobs channel
}

func main() {
    jobs := make(chan Job, 10)
    results := make(chan Result, 10)

    // Start 3 workers

    // Send 10 jobs

    // Close jobs channel and wait for workers

    // Print all results
}
```

## Expected Output

```
Result: job-1 processed: data-1
Result: job-2 processed: data-2
Result: job-3 processed: data-3
Result: job-4 processed: data-4
Result: job-5 processed: data-5
Result: job-6 processed: data-6
Result: job-7 processed: data-7
Result: job-8 processed: data-8
Result: job-9 processed: data-9
Result: job-10 processed: data-10
```

## Hint

Launch 3 workers with `go worker(...)`, each reading from the shared `jobs` channel. Send 10 jobs, then close the `jobs` channel. Use a WaitGroup to know when all workers finish, then close the `results` channel. Collect results into a slice, sort by JobID, and print.

## Solution

```go
package main

import (
    "fmt"
    "sort"
    "sync"
)

type Job struct {
    ID   int
    Data string
}

type Result struct {
    JobID  int
    Output string
}

func worker(id int, jobs <-chan Job, results chan<- Result, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        results <- Result{
            JobID:  job.ID,
            Output: fmt.Sprintf("job-%d processed: %s", job.ID, job.Data),
        }
    }
}

func main() {
    jobs := make(chan Job, 10)
    results := make(chan Result, 10)

    var wg sync.WaitGroup
    for w := 0; w < 3; w++ {
        wg.Add(1)
        go worker(w, jobs, results, &wg)
    }

    for i := 1; i <= 10; i++ {
        jobs <- Job{ID: i, Data: fmt.Sprintf("data-%d", i)}
    }
    close(jobs)

    go func() {
        wg.Wait()
        close(results)
    }()

    var collected []Result
    for r := range results {
        collected = append(collected, r)
    }

    sort.Slice(collected, func(i, j int) bool {
        return collected[i].JobID < collected[j].JobID
    })

    for _, r := range collected {
        fmt.Printf("Result: %s\n", r.Output)
    }
}
```
