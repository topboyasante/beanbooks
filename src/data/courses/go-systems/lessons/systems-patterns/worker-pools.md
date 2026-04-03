---
id: "go-worker-pools"
courseId: "go-systems"
moduleId: "systems-patterns"
title: "Worker Pools"
description: "Process concurrent work with a fixed number of goroutines using channel-based job queues and result collection."
order: 4
---

## Scenario

Your tunnel server generates thousands of log entries per second. Each entry needs to be parsed, enriched with metadata, and written to a storage backend. The naive approach — `go processLog(entry)` for each entry — spawns an unbounded number of goroutines. Under heavy load, you end up with 100,000+ goroutines competing for CPU time, thrashing memory, and overwhelming the storage backend with concurrent writes.

A worker pool fixes this: you spawn a fixed number of worker goroutines (say, 16) and feed them work through a channel. The channel acts as a queue. If work arrives faster than workers can process it, the channel fills up and creates natural backpressure — the sender slows down instead of the system falling over. This is how production systems handle concurrent workloads without losing control.

## Content

## Worker Pools

### The Basic Pattern: Workers + Job Channel

A worker pool has three components: a job channel (the queue), a set of worker goroutines (the processors), and a results channel (the output). Workers read from the job channel in a loop and exit when the channel is closed.

```go
package main

import (
    "fmt"
    "sync"
)

func worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        result := job * job // simulate work
        fmt.Printf("Worker %d: processed job %d -> %d\n", id, job, result)
        results <- result
    }
}

func main() {
    const numWorkers = 3
    const numJobs = 9

    jobs := make(chan int, numJobs)
    results := make(chan int, numJobs)

    // Start workers
    var wg sync.WaitGroup
    for w := 1; w <= numWorkers; w++ {
        wg.Add(1)
        go worker(w, jobs, results, &wg)
    }

    // Send jobs
    for j := 1; j <= numJobs; j++ {
        jobs <- j
    }
    close(jobs)

    // Wait for workers to finish, then close results
    go func() {
        wg.Wait()
        close(results)
    }()

    // Collect results
    var total int
    for r := range results {
        total += r
    }
    fmt.Printf("Total: %d\n", total)
}
```

### Job Queue with Channels

The job channel's buffer size controls backpressure. An unbuffered channel (`make(chan Job)`) blocks the sender until a worker picks up the job — maximum backpressure. A buffered channel (`make(chan Job, 100)`) allows up to 100 jobs to queue before the sender blocks.

```go
package main

import (
    "fmt"
    "time"
)

type LogEntry struct {
    Line      string
    Timestamp time.Time
}

type ProcessedLog struct {
    Line     string
    WordCount int
    Duration time.Duration
}

func processLog(entry LogEntry) ProcessedLog {
    start := time.Now()
    words := 0
    inWord := false
    for _, c := range entry.Line {
        if c == ' ' || c == '\t' || c == '\n' {
            inWord = false
        } else if !inWord {
            words++
            inWord = true
        }
    }
    return ProcessedLog{
        Line:      entry.Line,
        WordCount: words,
        Duration:  time.Since(start),
    }
}

func main() {
    // Buffered channel provides a queue of 10
    jobs := make(chan LogEntry, 10)

    // 4 workers processing log entries
    results := make(chan ProcessedLog, 10)
    for w := 0; w < 4; w++ {
        go func(id int) {
            for entry := range jobs {
                result := processLog(entry)
                results <- result
            }
        }(w)
    }

    // Send log entries
    entries := []string{
        "GET /api/status 200 12ms",
        "POST /api/connect 201 45ms",
        "GET /api/tunnels 200 8ms",
        "DELETE /api/tunnel/42 204 15ms",
        "GET /api/health 200 1ms",
    }

    go func() {
        for _, line := range entries {
            jobs <- LogEntry{Line: line, Timestamp: time.Now()}
        }
        close(jobs)
    }()

    for i := 0; i < len(entries); i++ {
        r := <-results
        fmt.Printf("Processed: %q (%d words)\n", r.Line, r.WordCount)
    }
}
```

### Result Collection

There are several patterns for collecting results from workers: counting (when you know how many results to expect), closing the results channel (when workers are done), or using a done channel for early termination.

```go
package main

import (
    "fmt"
    "sync"
)

type Result struct {
    Input  int
    Output int
    Worker int
}

func main() {
    jobs := make(chan int, 20)
    results := make(chan Result, 20)

    var wg sync.WaitGroup
    for w := 1; w <= 4; w++ {
        wg.Add(1)
        go func(workerID int) {
            defer wg.Done()
            for n := range jobs {
                // Simulate work: sum of 1..n
                sum := n * (n + 1) / 2
                results <- Result{Input: n, Output: sum, Worker: workerID}
            }
        }(w)
    }

    // Send 10 jobs
    for i := 1; i <= 10; i++ {
        jobs <- i
    }
    close(jobs)

    // Close results when all workers are done
    go func() {
        wg.Wait()
        close(results)
    }()

    // Collect all results
    collected := make([]Result, 0)
    for r := range results {
        collected = append(collected, r)
    }

    // Print results sorted by input
    for _, r := range collected {
        fmt.Printf("sum(1..%d) = %d (worker %d)\n", r.Input, r.Output, r.Worker)
    }
    fmt.Printf("Total results: %d\n", len(collected))
}
```

### Backpressure

Backpressure is the mechanism that prevents the system from being overwhelmed. When the job channel is full, the sender blocks. This naturally slows down the producer to match the speed of the consumers. Without backpressure, a fast producer and slow consumer leads to unbounded memory growth.

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

func main() {
    // Small buffer = strong backpressure
    jobs := make(chan int, 2)

    var wg sync.WaitGroup
    wg.Add(1)
    go func() {
        defer wg.Done()
        for job := range jobs {
            // Slow worker
            time.Sleep(100 * time.Millisecond)
            fmt.Printf("  Processed job %d\n", job)
        }
    }()

    // Fast producer — will be slowed by backpressure
    for i := 1; i <= 6; i++ {
        start := time.Now()
        jobs <- i
        elapsed := time.Since(start)
        if elapsed > time.Millisecond {
            fmt.Printf("Sent job %d (blocked for %v — backpressure)\n", i, elapsed.Round(time.Millisecond))
        } else {
            fmt.Printf("Sent job %d (immediate)\n", i)
        }
    }
    close(jobs)
    wg.Wait()
}
```

### Dynamic Scaling and Pool Management

In some systems, you want the pool to grow under load and shrink when idle. This is more complex but allows better resource utilization.

```go
package main

import (
    "fmt"
    "sync"
    "sync/atomic"
    "time"
)

type DynamicPool struct {
    jobs       chan int
    minWorkers int
    maxWorkers int
    active     atomic.Int32
    wg         sync.WaitGroup
}

func NewDynamicPool(min, max int) *DynamicPool {
    dp := &DynamicPool{
        jobs:       make(chan int, max*2),
        minWorkers: min,
        maxWorkers: max,
    }

    // Start minimum workers
    for i := 0; i < min; i++ {
        dp.startWorker(i + 1)
    }

    return dp
}

func (dp *DynamicPool) startWorker(id int) {
    dp.wg.Add(1)
    dp.active.Add(1)
    go func() {
        defer dp.wg.Done()
        defer dp.active.Add(-1)
        for job := range dp.jobs {
            time.Sleep(10 * time.Millisecond) // simulate work
            fmt.Printf("Worker %d: job %d (active workers: %d)\n",
                id, job, dp.active.Load())
        }
    }()
}

func (dp *DynamicPool) ScaleUp() {
    current := int(dp.active.Load())
    if current < dp.maxWorkers {
        dp.startWorker(current + 1)
        fmt.Printf("Scaled up to %d workers\n", dp.active.Load())
    }
}

func (dp *DynamicPool) Submit(job int) {
    // If queue is getting full and we can scale, do it
    if len(dp.jobs) > cap(dp.jobs)/2 {
        dp.ScaleUp()
    }
    dp.jobs <- job
}

func (dp *DynamicPool) Shutdown() {
    close(dp.jobs)
    dp.wg.Wait()
}

func main() {
    pool := NewDynamicPool(2, 5)

    for i := 1; i <= 20; i++ {
        pool.Submit(i)
    }

    pool.Shutdown()
    fmt.Println("All jobs completed.")
}
```

## Why It Matters

Worker pools are the standard pattern for bounded concurrency in Go. The Go runtime can handle millions of goroutines, but the resources those goroutines access — database connections, file handles, network bandwidth — cannot. Worker pools give you explicit control over concurrency levels and memory usage. This pattern appears everywhere: HTTP servers limit concurrent handlers, database drivers limit concurrent queries, image processing pipelines limit concurrent encode/decode operations. Understanding worker pools means understanding how to build systems that stay stable under load.

## Questions

Q: What problem does a worker pool solve compared to spawning a goroutine per task?
A) Worker pools are faster per task
B) Worker pools bound the number of concurrent goroutines, preventing resource exhaustion
C) Worker pools use less memory per goroutine
D) Worker pools automatically retry failed tasks
Correct: B

Q: How does backpressure work in a channel-based worker pool?
A) Workers send a signal to slow down the producer
B) The buffered job channel blocks the sender when full, naturally slowing the producer
C) The runtime limits the number of goroutines
D) A timer periodically pauses the producer
Correct: B

Q: Why should you close the jobs channel after submitting all work?
A) To free the channel's memory
B) So workers' `range` loops exit and the workers can shut down
C) To prevent new workers from starting
D) Go requires channels to be closed
Correct: B

## Challenge

Create a worker pool with 3 workers that processes a slice of strings by converting each to uppercase. Collect all results and print them. Use a `sync.WaitGroup` to know when workers are done.

## Starter Code

```go
package main

import (
    "fmt"
    "strings"
    "sync"
)

func main() {
    words := []string{"alpha", "bravo", "charlie", "delta", "echo", "foxtrot"}

    jobs := make(chan string, len(words))
    results := make(chan string, len(words))

    // TODO: start 3 workers that read from jobs, uppercase, send to results

    // TODO: send all words to jobs and close the channel

    // TODO: wait for workers, close results, collect and print

    _ = strings.ToUpper // hint: use this
    _ = sync.WaitGroup{}
    _ = jobs
    _ = results
    fmt.Println("done")
}
```

## Expected Output

```
ALPHA
BRAVO
CHARLIE
DELTA
ECHO
FOXTROT
done
```

## Hint

Start 3 goroutines that `range` over `jobs`, call `strings.ToUpper`, and send to `results`. After sending all words and closing `jobs`, use a goroutine with `wg.Wait()` and `close(results)`, then range over results to print them. Note that results may not print in the original order.

## Solution

```go
package main

import (
    "fmt"
    "strings"
    "sync"
)

func main() {
    words := []string{"alpha", "bravo", "charlie", "delta", "echo", "foxtrot"}

    jobs := make(chan string, len(words))
    results := make(chan string, len(words))

    var wg sync.WaitGroup
    for w := 0; w < 3; w++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for word := range jobs {
                results <- strings.ToUpper(word)
            }
        }()
    }

    for _, word := range words {
        jobs <- word
    }
    close(jobs)

    go func() {
        wg.Wait()
        close(results)
    }()

    for r := range results {
        fmt.Println(r)
    }
    fmt.Println("done")
}
```
