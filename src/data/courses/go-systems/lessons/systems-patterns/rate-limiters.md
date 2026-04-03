---
id: "go-rate-limiters"
courseId: "go-systems"
moduleId: "systems-patterns"
title: "Rate Limiters"
description: "Implement token bucket and sliding window rate limiters to protect services from abuse and overload."
order: 2
---

## Scenario

Your tunnel server is live. A single client starts opening 10,000 connections per second — maybe a bug, maybe intentional abuse. Without rate limiting, this client exhausts your server's file descriptors, starves other clients of resources, and eventually crashes the process. Rate limiting is the bouncer at the door: it decides how many requests each client can make per unit of time and rejects the rest.

Rate limiting isn't just about security. It's about fairness and stability. Your server has finite resources — CPU, memory, file descriptors, bandwidth. Rate limiters ensure that no single client can consume a disproportionate share, and that the system degrades gracefully under load instead of falling over.

## Content

## Rate Limiters

### The Token Bucket Algorithm

The token bucket is the most widely used rate limiting algorithm. Imagine a bucket that holds tokens. Tokens are added at a fixed rate (e.g., 10 per second). Each request consumes one token. If the bucket is empty, the request is rejected. The bucket has a maximum capacity, which allows short bursts.

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type TokenBucket struct {
    mu         sync.Mutex
    tokens     float64
    maxTokens  float64
    refillRate float64 // tokens per second
    lastRefill time.Time
}

func NewTokenBucket(rate float64, burst float64) *TokenBucket {
    return &TokenBucket{
        tokens:     burst,
        maxTokens:  burst,
        refillRate: rate,
        lastRefill: time.Now(),
    }
}

func (tb *TokenBucket) Allow() bool {
    tb.mu.Lock()
    defer tb.mu.Unlock()

    // Refill tokens based on elapsed time
    now := time.Now()
    elapsed := now.Sub(tb.lastRefill).Seconds()
    tb.tokens += elapsed * tb.refillRate
    if tb.tokens > tb.maxTokens {
        tb.tokens = tb.maxTokens
    }
    tb.lastRefill = now

    // Try to consume a token
    if tb.tokens >= 1 {
        tb.tokens--
        return true
    }
    return false
}

func main() {
    // 5 requests per second, burst of 3
    limiter := NewTokenBucket(5, 3)

    // Burst: first 3 should succeed immediately
    for i := 0; i < 5; i++ {
        allowed := limiter.Allow()
        fmt.Printf("Request %d: allowed=%v\n", i+1, allowed)
    }

    // Wait for tokens to refill
    time.Sleep(400 * time.Millisecond) // ~2 tokens refilled
    fmt.Println("--- after 400ms ---")
    for i := 0; i < 3; i++ {
        allowed := limiter.Allow()
        fmt.Printf("Request %d: allowed=%v\n", i+1, allowed)
    }
}
```

### Sliding Window Rate Limiting

The sliding window algorithm tracks requests within a rolling time window. It's more precise than fixed windows (which can allow 2x the rate at window boundaries) but uses more memory.

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type SlidingWindow struct {
    mu        sync.Mutex
    requests  []time.Time
    window    time.Duration
    maxReqs   int
}

func NewSlidingWindow(maxReqs int, window time.Duration) *SlidingWindow {
    return &SlidingWindow{
        requests: make([]time.Time, 0),
        window:   window,
        maxReqs:  maxReqs,
    }
}

func (sw *SlidingWindow) Allow() bool {
    sw.mu.Lock()
    defer sw.mu.Unlock()

    now := time.Now()
    cutoff := now.Add(-sw.window)

    // Remove expired entries
    valid := sw.requests[:0]
    for _, t := range sw.requests {
        if t.After(cutoff) {
            valid = append(valid, t)
        }
    }
    sw.requests = valid

    // Check limit
    if len(sw.requests) >= sw.maxReqs {
        return false
    }

    sw.requests = append(sw.requests, now)
    return true
}

func main() {
    // 3 requests per 100ms window
    limiter := NewSlidingWindow(3, 100*time.Millisecond)

    for i := 0; i < 5; i++ {
        fmt.Printf("Request %d: allowed=%v\n", i+1, limiter.Allow())
    }

    time.Sleep(150 * time.Millisecond)
    fmt.Println("--- after 150ms ---")
    for i := 0; i < 2; i++ {
        fmt.Printf("Request %d: allowed=%v\n", i+1, limiter.Allow())
    }
}
```

### Using golang.org/x/time/rate

Go's extended library provides a production-quality rate limiter based on the token bucket algorithm. It's used internally by many Go services at Google.

```go
package main

import (
    "context"
    "fmt"
    "time"

    "golang.org/x/time/rate"
)

func main() {
    // 10 events per second, burst of 3
    limiter := rate.NewLimiter(10, 3)

    // Allow() — non-blocking, returns true/false
    for i := 0; i < 5; i++ {
        fmt.Printf("Allow(): %v\n", limiter.Allow())
    }

    // Wait() — blocking, waits until a token is available
    ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
    defer cancel()

    fmt.Println("--- waiting for tokens ---")
    for i := 0; i < 3; i++ {
        err := limiter.Wait(ctx)
        if err != nil {
            fmt.Printf("Wait failed: %v\n", err)
            break
        }
        fmt.Printf("Wait() succeeded at %v\n", time.Now().Format("15:04:05.000"))
    }

    // Reserve() — returns a Reservation with delay info
    r := limiter.Reserve()
    fmt.Printf("Reserve delay: %v\n", r.Delay())
}
```

### Per-Client Rate Limiting

A global rate limiter protects the server, but you need per-client limiters to prevent one client from starving others. Use a map of limiters keyed by client identifier.

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type TokenBucket struct {
    tokens     float64
    maxTokens  float64
    refillRate float64
    lastRefill time.Time
}

func (tb *TokenBucket) allow() bool {
    now := time.Now()
    elapsed := now.Sub(tb.lastRefill).Seconds()
    tb.tokens += elapsed * tb.refillRate
    if tb.tokens > tb.maxTokens {
        tb.tokens = tb.maxTokens
    }
    tb.lastRefill = now
    if tb.tokens >= 1 {
        tb.tokens--
        return true
    }
    return false
}

type PerClientLimiter struct {
    mu       sync.Mutex
    clients  map[string]*TokenBucket
    rate     float64
    burst    float64
}

func NewPerClientLimiter(ratePerSec, burst float64) *PerClientLimiter {
    return &PerClientLimiter{
        clients: make(map[string]*TokenBucket),
        rate:    ratePerSec,
        burst:   burst,
    }
}

func (pcl *PerClientLimiter) Allow(clientID string) bool {
    pcl.mu.Lock()
    defer pcl.mu.Unlock()

    bucket, exists := pcl.clients[clientID]
    if !exists {
        bucket = &TokenBucket{
            tokens:     pcl.burst,
            maxTokens:  pcl.burst,
            refillRate: pcl.rate,
            lastRefill: time.Now(),
        }
        pcl.clients[clientID] = bucket
    }

    return bucket.allow()
}

func main() {
    limiter := NewPerClientLimiter(2, 2) // 2 req/s, burst of 2

    clients := []string{"client-A", "client-B", "client-A", "client-A", "client-B"}
    for _, c := range clients {
        allowed := limiter.Allow(c)
        fmt.Printf("%s: allowed=%v\n", c, allowed)
    }
}
```

### Rate Limit Headers

When rejecting requests, inform the client about the limits so they can back off gracefully. This is standard practice in HTTP APIs.

```go
package main

import "fmt"

type RateLimitInfo struct {
    Limit     int   // max requests per window
    Remaining int   // requests left in current window
    ResetAt   int64 // unix timestamp when window resets
    RetryAfter int  // seconds until next request allowed (only on rejection)
}

func (r RateLimitInfo) Headers() map[string]string {
    headers := map[string]string{
        "X-RateLimit-Limit":     fmt.Sprint(r.Limit),
        "X-RateLimit-Remaining": fmt.Sprint(r.Remaining),
        "X-RateLimit-Reset":     fmt.Sprint(r.ResetAt),
    }
    if r.RetryAfter > 0 {
        headers["Retry-After"] = fmt.Sprint(r.RetryAfter)
    }
    return headers
}

func main() {
    // Allowed request
    info := RateLimitInfo{Limit: 100, Remaining: 42, ResetAt: 1700000000}
    fmt.Println("Allowed:")
    for k, v := range info.Headers() {
        fmt.Printf("  %s: %s\n", k, v)
    }

    // Rejected request
    rejected := RateLimitInfo{Limit: 100, Remaining: 0, ResetAt: 1700000000, RetryAfter: 30}
    fmt.Println("Rejected:")
    for k, v := range rejected.Headers() {
        fmt.Printf("  %s: %s\n", k, v)
    }
}
```

## Why It Matters

Rate limiting is a non-negotiable requirement for any system that accepts external traffic. Without it, a single misbehaving client — or a DDoS attack — can take down your entire service. The token bucket algorithm powers rate limiting in Nginx, AWS API Gateway, Cloudflare, and most production load balancers. Understanding how to implement and configure rate limiters means you can protect your services, set fair usage policies, and debug "429 Too Many Requests" errors when they happen to your own clients.

## Questions

Q: In a token bucket rate limiter, what does the "burst" parameter control?
A) The rate at which tokens are added
B) The maximum number of requests that can be made in a short burst before throttling kicks in
C) The total number of requests ever allowed
D) The timeout for rejected requests
Correct: B

Q: What is the advantage of per-client rate limiting over a global rate limiter?
A) It uses less memory
B) It prevents one client from consuming the entire rate limit and starving other clients
C) It's faster to compute
D) It doesn't require synchronization
Correct: B

Q: What should your server return when a client exceeds their rate limit?
A) 200 OK with empty body
B) 500 Internal Server Error
C) 429 Too Many Requests with Retry-After header
D) Close the TCP connection silently
Correct: C

## Challenge

Implement a token bucket rate limiter with a `rate` (tokens per second) and `burst` (max tokens). Write an `Allow()` method that returns `true` if a request is allowed and `false` if rate limited. Test it by making 5 rapid requests with a rate of 2/second and burst of 3.

## Starter Code

```go
package main

import (
    "fmt"
    "time"
)

type RateLimiter struct {
    tokens     float64
    maxTokens  float64
    refillRate float64
    lastRefill time.Time
}

func NewRateLimiter(ratePerSec, burst float64) *RateLimiter {
    // TODO
    return nil
}

func (rl *RateLimiter) Allow() bool {
    // TODO: refill tokens based on elapsed time, then try to consume one
    return false
}

func main() {
    limiter := NewRateLimiter(2, 3)
    for i := 1; i <= 5; i++ {
        fmt.Printf("Request %d: allowed=%v\n", i, limiter.Allow())
    }
}
```

## Expected Output

```
Request 1: allowed=true
Request 2: allowed=true
Request 3: allowed=true
Request 4: allowed=false
Request 5: allowed=false
```

## Hint

Initialize `tokens` to `burst`. On each call to `Allow`, calculate elapsed time since `lastRefill`, add `elapsed * refillRate` to tokens (capped at maxTokens), then check if `tokens >= 1`. If so, decrement and return true.

## Solution

```go
package main

import (
    "fmt"
    "time"
)

type RateLimiter struct {
    tokens     float64
    maxTokens  float64
    refillRate float64
    lastRefill time.Time
}

func NewRateLimiter(ratePerSec, burst float64) *RateLimiter {
    return &RateLimiter{
        tokens:     burst,
        maxTokens:  burst,
        refillRate: ratePerSec,
        lastRefill: time.Now(),
    }
}

func (rl *RateLimiter) Allow() bool {
    now := time.Now()
    elapsed := now.Sub(rl.lastRefill).Seconds()
    rl.tokens += elapsed * rl.refillRate
    if rl.tokens > rl.maxTokens {
        rl.tokens = rl.maxTokens
    }
    rl.lastRefill = now

    if rl.tokens >= 1 {
        rl.tokens--
        return true
    }
    return false
}

func main() {
    limiter := NewRateLimiter(2, 3)
    for i := 1; i <= 5; i++ {
        fmt.Printf("Request %d: allowed=%v\n", i, limiter.Allow())
    }
}
```
