---
id: "rate-limiting"
moduleId: "backend-patterns"
title: "Rate Limiting & Throttling"
description: "Protect banking APIs from abuse with token bucket, sliding window, and throttling patterns."
order: 7
---

## Banking Scenario

Banking APIs are high-value targets. Without rate limiting, a single client could overwhelm your transaction API with thousands of requests per second — whether from a bug, a DDoS attack, or a scraping bot trying to enumerate account numbers. In 2019, a major bank's public API went down for hours because a partner's misconfigured integration sent millions of duplicate requests.

Rate limiting ensures fair usage, prevents system overload, and is required by many banking regulators for API security compliance. Every production banking API implements rate limiting — it is not optional.

## Content

### Why Rate Limit

Rate limiting serves four purposes in banking: abuse prevention (stopping brute-force attacks on login endpoints), fair usage (ensuring one client doesn't starve others), cost control (downstream services like fraud detection charge per call), and regulatory compliance (PSD2 and Open Banking mandates require rate limits on third-party API access).

```java
// Without rate limiting — a single bad actor can bring down your system
// With rate limiting — the system stays healthy for all clients
// HTTP 429 Too Many Requests — the standard response when limits are exceeded
```

### Token Bucket Algorithm

The token bucket is the most popular rate limiting algorithm. Imagine a bucket that holds a fixed number of tokens. Tokens regenerate at a steady rate. Each request consumes one token. If the bucket is empty, the request is rejected. This naturally allows short bursts (a full bucket) while enforcing a sustained rate.

```java
public class TokenBucket {
    private final int maxTokens;
    private final double refillRatePerSecond;
    private double currentTokens;
    private long lastRefillTimestamp;

    public TokenBucket(int maxTokens, double refillRatePerSecond) {
        this.maxTokens = maxTokens;
        this.refillRatePerSecond = refillRatePerSecond;
        this.currentTokens = maxTokens;
        this.lastRefillTimestamp = System.nanoTime();
    }

    public synchronized boolean tryConsume() {
        refill();
        if (currentTokens >= 1) {
            currentTokens -= 1;
            return true;
        }
        return false;
    }

    private void refill() {
        long now = System.nanoTime();
        double elapsed = (now - lastRefillTimestamp) / 1_000_000_000.0;
        currentTokens = Math.min(maxTokens, currentTokens + elapsed * refillRatePerSecond);
        lastRefillTimestamp = now;
    }
}
```

### Sliding Window Counter

A sliding window counter counts requests in the last N seconds. Unlike fixed windows (which reset at boundaries and allow burst problems), a sliding window smoothly moves forward in time. For example, "100 requests per 60 seconds" always looks at the last 60 seconds from right now, not from the start of the current minute.

```java
// Fixed window problem: 100 requests at 12:00:59, 100 more at 12:01:01
// Both pass the 100/minute limit, but 200 requests hit in 2 seconds!

// Sliding window: always counts the last 60 seconds from NOW
// Much more predictable rate enforcement
```

### HTTP Rate Limit Headers

When implementing rate limiting, communicate limits to clients via standard headers. This lets well-behaved clients self-throttle before hitting the limit.

```java
// Response headers for rate-limited endpoints
// X-RateLimit-Limit: 100        — max requests allowed in window
// X-RateLimit-Remaining: 42     — requests remaining in current window
// X-RateLimit-Reset: 1680000060 — Unix timestamp when the window resets

// When limit is exceeded, return HTTP 429:
// HTTP/1.1 429 Too Many Requests
// Retry-After: 30
```

### Implementation Approaches

For a single server, in-memory rate limiting works fine (ConcurrentHashMap keyed by client ID). For distributed systems, use Redis with atomic INCR and EXPIRE commands — all servers share the same counters. At scale, move rate limiting to the API gateway (Kong, AWS API Gateway) so it happens before requests reach your application.

```java
// Per-client limiting using API keys
Map<String, TokenBucket> clientBuckets = new ConcurrentHashMap<>();

public boolean allowRequest(String apiKey) {
    TokenBucket bucket = clientBuckets.computeIfAbsent(apiKey,
        key -> new TokenBucket(100, 10.0)); // 100 burst, 10/sec sustained
    return bucket.tryConsume();
}
```

### Spring Boot Implementation

In Spring Boot, implement rate limiting as a `HandlerInterceptor` that runs before every controller method. Extract the client identifier (API key, IP address, or authenticated user) and check their rate limit bucket.

```java
@Component
public class RateLimitInterceptor implements HandlerInterceptor {
    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String clientId = request.getHeader("X-API-Key");
        TokenBucket bucket = buckets.computeIfAbsent(clientId,
            k -> new TokenBucket(50, 5.0));

        if (!bucket.tryConsume()) {
            response.setStatus(429);
            return false; // reject request
        }
        return true; // allow request
    }
}
```

### Throttling vs Rate Limiting

Rate limiting rejects excess requests outright (HTTP 429). Throttling slows them down — excess requests are queued and processed at a controlled rate. Throttling provides a better client experience (requests eventually succeed) but requires more server resources (queue memory, longer-lived connections). Banks often use rate limiting for public APIs and throttling for internal service-to-service communication.

## Why It Matters

Every banking API in production uses rate limiting. It is a fundamental security and reliability control that interviewers expect you to understand. Knowing the trade-offs between token bucket and sliding window, understanding HTTP 429 semantics, and being able to implement a rate limiter from scratch demonstrates that you can build systems that are both robust under load and fair to all consumers.

## Challenge

Implement a `TokenBucketRateLimiter` with a configurable capacity and refill rate. Simulate a burst of banking API requests and show which requests are allowed and which are rejected.

## Starter Code
```java
public class RateLimiterDemo {

    static class TokenBucketRateLimiter {
        private final int maxTokens;
        private final int refillAmount;
        private int currentTokens;

        public TokenBucketRateLimiter(int maxTokens, int refillAmount) {
            this.maxTokens = maxTokens;
            this.refillAmount = refillAmount;
            this.currentTokens = maxTokens;
        }

        public boolean tryAcquire() {
            // TODO: Check if a token is available, consume it, and return true
            // TODO: Return false if no tokens available
            return false;
        }

        public void refill() {
            // TODO: Add refillAmount tokens, but don't exceed maxTokens
        }

        public int getAvailableTokens() {
            return currentTokens;
        }
    }

    public static void main(String[] args) {
        TokenBucketRateLimiter limiter = new TokenBucketRateLimiter(5, 2);

        System.out.println("=== Banking API Rate Limiter ===");
        System.out.println("Bucket capacity: 5 tokens | Refill: 2 tokens\n");

        // Simulate 7 rapid requests (burst)
        System.out.println("--- Burst of 7 requests ---");
        for (int i = 1; i <= 7; i++) {
            String endpoint = switch (i % 3) {
                case 0 -> "GET /api/v1/accounts";
                case 1 -> "POST /api/v1/transfers";
                default -> "GET /api/v1/transactions";
            };
            boolean allowed = limiter.tryAcquire();
            System.out.println("Request " + i + " [" + endpoint + "] → "
                + (allowed ? "ALLOWED" : "REJECTED (429 Too Many Requests)")
                + " | Tokens remaining: " + limiter.getAvailableTokens());
        }

        // Simulate token refill
        System.out.println("\n--- Token refill (+2 tokens) ---");
        limiter.refill();
        System.out.println("Tokens after refill: " + limiter.getAvailableTokens());

        // Simulate 3 more requests after refill
        System.out.println("\n--- 3 more requests after refill ---");
        for (int i = 8; i <= 10; i++) {
            boolean allowed = limiter.tryAcquire();
            System.out.println("Request " + i + " [POST /api/v1/transfers] → "
                + (allowed ? "ALLOWED" : "REJECTED (429 Too Many Requests)")
                + " | Tokens remaining: " + limiter.getAvailableTokens());
        }
    }
}
```

## Expected Output
```
=== Banking API Rate Limiter ===
Bucket capacity: 5 tokens | Refill: 2 tokens

--- Burst of 7 requests ---
Request 1 [POST /api/v1/transfers] → ALLOWED | Tokens remaining: 4
Request 2 [GET /api/v1/transactions] → ALLOWED | Tokens remaining: 3
Request 3 [GET /api/v1/accounts] → ALLOWED | Tokens remaining: 2
Request 4 [POST /api/v1/transfers] → ALLOWED | Tokens remaining: 1
Request 5 [GET /api/v1/transactions] → ALLOWED | Tokens remaining: 0
Request 6 [GET /api/v1/accounts] → REJECTED (429 Too Many Requests) | Tokens remaining: 0
Request 7 [POST /api/v1/transfers] → REJECTED (429 Too Many Requests) | Tokens remaining: 0

--- Token refill (+2 tokens) ---
Tokens after refill: 2

--- 3 more requests after refill ---
Request 8 [POST /api/v1/transfers] → ALLOWED | Tokens remaining: 1
Request 9 [POST /api/v1/transfers] → ALLOWED | Tokens remaining: 0
Request 10 [POST /api/v1/transfers] → REJECTED (429 Too Many Requests) | Tokens remaining: 0
```

## Hint

In `tryAcquire()`, check if `currentTokens > 0`. If so, decrement and return `true`. In `refill()`, use `Math.min(maxTokens, currentTokens + refillAmount)` to cap tokens at the bucket capacity.

## Solution
```java
public class RateLimiterDemo {

    static class TokenBucketRateLimiter {
        private final int maxTokens;
        private final int refillAmount;
        private int currentTokens;

        public TokenBucketRateLimiter(int maxTokens, int refillAmount) {
            this.maxTokens = maxTokens;
            this.refillAmount = refillAmount;
            this.currentTokens = maxTokens;
        }

        public boolean tryAcquire() {
            if (currentTokens > 0) {
                currentTokens--;
                return true;
            }
            return false;
        }

        public void refill() {
            currentTokens = Math.min(maxTokens, currentTokens + refillAmount);
        }

        public int getAvailableTokens() {
            return currentTokens;
        }
    }

    public static void main(String[] args) {
        TokenBucketRateLimiter limiter = new TokenBucketRateLimiter(5, 2);

        System.out.println("=== Banking API Rate Limiter ===");
        System.out.println("Bucket capacity: 5 tokens | Refill: 2 tokens\n");

        // Simulate 7 rapid requests (burst)
        System.out.println("--- Burst of 7 requests ---");
        for (int i = 1; i <= 7; i++) {
            String endpoint = switch (i % 3) {
                case 0 -> "GET /api/v1/accounts";
                case 1 -> "POST /api/v1/transfers";
                default -> "GET /api/v1/transactions";
            };
            boolean allowed = limiter.tryAcquire();
            System.out.println("Request " + i + " [" + endpoint + "] → "
                + (allowed ? "ALLOWED" : "REJECTED (429 Too Many Requests)")
                + " | Tokens remaining: " + limiter.getAvailableTokens());
        }

        // Simulate token refill
        System.out.println("\n--- Token refill (+2 tokens) ---");
        limiter.refill();
        System.out.println("Tokens after refill: " + limiter.getAvailableTokens());

        // Simulate 3 more requests after refill
        System.out.println("\n--- 3 more requests after refill ---");
        for (int i = 8; i <= 10; i++) {
            boolean allowed = limiter.tryAcquire();
            System.out.println("Request " + i + " [POST /api/v1/transfers] → "
                + (allowed ? "ALLOWED" : "REJECTED (429 Too Many Requests)")
                + " | Tokens remaining: " + limiter.getAvailableTokens());
        }
    }
}
```
