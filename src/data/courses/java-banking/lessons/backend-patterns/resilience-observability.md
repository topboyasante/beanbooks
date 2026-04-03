---
id: "resilience-observability"
moduleId: "backend-patterns"
title: "Resilience & Observability"
description: "Build fault-tolerant systems with circuit breakers, retries, and comprehensive monitoring."
order: 9
---

## Banking Scenario

Your payment service calls an external fraud detection API before approving transactions. If that API goes down, do you reject all payments and lose revenue? Block indefinitely and exhaust your thread pool? A resilient system uses circuit breakers to fail fast when a dependency is unhealthy, retries with exponential backoff for transient failures, and timeouts to prevent thread exhaustion.

Meanwhile, observability — metrics, logs, and traces — tells you what is happening before your customers notice. When the fraud API starts responding slowly at 2 AM, your monitoring alerts the on-call engineer before the system degrades. Without observability, you find out when angry customers call.

## Content

### Circuit Breaker Pattern

A circuit breaker monitors calls to a dependency and trips open when failures exceed a threshold. It has three states: CLOSED (normal operation, requests pass through), OPEN (failing fast, requests are immediately rejected without calling the dependency), and HALF_OPEN (testing recovery by allowing a limited number of requests through). If the test requests succeed, the circuit closes. If they fail, it opens again.

```java
// Resilience4j circuit breaker configuration
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)         // open after 50% failure rate
    .waitDurationInOpenState(Duration.ofSeconds(30))  // stay open for 30s
    .slidingWindowSize(10)            // evaluate last 10 calls
    .permittedNumberOfCallsInHalfOpenState(3) // test with 3 calls
    .build();

CircuitBreaker breaker = CircuitBreaker.of("fraudService", config);

// Wrapping a call with the circuit breaker
Supplier<FraudResult> decorated = CircuitBreaker
    .decorateSupplier(breaker, () -> fraudService.check(transaction));
```

### Retry with Exponential Backoff

When a call fails due to a transient error (network blip, temporary overload), retrying can succeed. But linear retries are dangerous: if a service is struggling, hundreds of clients retrying simultaneously create a thundering herd that makes things worse. Exponential backoff increases the delay between retries (1s, 2s, 4s, 8s), and adding random jitter prevents synchronized retries.

```java
// Retry logic: only retry on 5xx errors, never on 4xx (client errors)
// 4xx means the request itself is wrong — retrying won't help

RetryConfig retryConfig = RetryConfig.custom()
    .maxAttempts(3)
    .waitDuration(Duration.ofMillis(500))
    .intervalFunction(IntervalFunction.ofExponentialBackoff(500, 2.0))
    .retryOnException(e -> e instanceof ServerErrorException)  // 5xx only
    .build();
```

### Timeouts

Every external call needs a timeout. Without one, a slow dependency can hold threads indefinitely until your entire thread pool is exhausted. Set connection timeouts (how long to wait to establish a connection) and read timeouts (how long to wait for a response) separately. Tune per dependency — a fraud check might get 2 seconds, while a balance lookup gets 500ms.

```java
// RestTemplate with timeouts
SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
factory.setConnectTimeout(1000);  // 1 second to connect
factory.setReadTimeout(2000);     // 2 seconds to read response
RestTemplate restTemplate = new RestTemplate(factory);
```

### Bulkhead Pattern

The bulkhead pattern isolates thread pools per dependency. If the fraud API becomes slow and consumes all 200 threads in your shared pool, your account lookup and balance check services also stop working. With bulkheads, each dependency gets its own limited thread pool — if one pool is exhausted, others continue operating normally.

```java
// Resilience4j bulkhead — limit concurrent calls to fraud service
BulkheadConfig bulkheadConfig = BulkheadConfig.custom()
    .maxConcurrentCalls(10)        // max 10 simultaneous calls
    .maxWaitDuration(Duration.ofMillis(500))  // wait 500ms for a slot
    .build();

Bulkhead bulkhead = Bulkhead.of("fraudService", bulkheadConfig);
```

### Distributed Tracing

In a microservices architecture, a single user request may traverse 5-10 services. Distributed tracing assigns a unique trace ID to each request and propagates it across service boundaries. Each service creates spans within the trace. When something is slow, you can see exactly which service and which operation caused the delay.

```java
// Spring Boot with Micrometer Tracing (successor to Spring Cloud Sleuth)
// Trace IDs propagate automatically via HTTP headers

// In logs, trace and span IDs appear automatically:
// 2026-03-15 10:23:45 [traceId=abc123 spanId=def456] INFO PaymentService - Processing payment
// 2026-03-15 10:23:45 [traceId=abc123 spanId=ghi789] INFO FraudService - Checking fraud rules
```

### Structured Logging and Correlation IDs

Use JSON-formatted structured logs in production — they are searchable and parseable by log aggregation tools (ELK, Splunk, Datadog). MDC (Mapped Diagnostic Context) lets you attach context like correlation IDs, user IDs, and account numbers to every log line in a request thread.

```java
// Setting MDC context for a request
MDC.put("correlationId", UUID.randomUUID().toString());
MDC.put("accountId", "ACC-1001");

log.info("Processing transfer"); // automatically includes correlationId and accountId
// Output: {"timestamp":"2026-03-15T10:23:45","level":"INFO","correlationId":"a1b2c3","accountId":"ACC-1001","message":"Processing transfer"}

MDC.clear(); // clean up after request
```

### Metrics and Health Checks

Metrics quantify system behavior: counters (total requests), gauges (active connections right now), and histograms (response time distribution). Health checks tell orchestrators (Kubernetes) whether your service is alive (liveness) and ready to accept traffic (readiness). A service might be alive but not ready if its database connection pool is initializing.

```java
// Micrometer metrics
Counter transferCounter = Counter.builder("transfers.total")
    .tag("status", "success")
    .register(meterRegistry);
transferCounter.increment();

// Custom health indicator
@Component
public class FraudServiceHealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        boolean fraudServiceUp = checkFraudService();
        return fraudServiceUp ? Health.up().build()
            : Health.down().withDetail("reason", "Fraud API unreachable").build();
    }
}
```

## Why It Matters

Distributed systems fail — that is not a possibility, it is a certainty. Circuit breakers, retries, and timeouts are the difference between a minor blip and a full outage. Observability is the difference between finding a problem in minutes and spending hours debugging blind. Banking interviewers expect you to know these patterns because every production banking system relies on them. Building resilient, observable services is what separates a developer who writes code from an engineer who runs systems.

## Challenge

Implement a simple circuit breaker with three states (CLOSED, OPEN, HALF_OPEN). The breaker should open after 3 consecutive failures and transition to HALF_OPEN after a cooldown period. A successful call in HALF_OPEN should close the circuit.

## Starter Code
```java
public class CircuitBreakerDemo {

    enum CircuitState { CLOSED, OPEN, HALF_OPEN }

    static class CircuitBreaker {
        private CircuitState state = CircuitState.CLOSED;
        private int failureCount = 0;
        private final int failureThreshold;
        private final long cooldownMillis;
        private long lastFailureTime = 0;

        public CircuitBreaker(int failureThreshold, long cooldownMillis) {
            this.failureThreshold = failureThreshold;
            this.cooldownMillis = cooldownMillis;
        }

        public String call(java.util.function.Supplier<String> action) {
            // TODO: If OPEN, check if cooldown has elapsed → transition to HALF_OPEN
            // TODO: If OPEN and cooldown not elapsed, throw exception (fail fast)
            // TODO: If CLOSED or HALF_OPEN, execute the action
            // TODO: On success → reset failures, set state to CLOSED
            // TODO: On failure → increment failures, if threshold reached → set state to OPEN

            return null; // replace this
        }

        public CircuitState getState() {
            return state;
        }
    }

    // Simulated external fraud detection service
    static class FraudDetectionService {
        private int callCount = 0;

        public String checkTransaction(String transactionId) {
            callCount++;
            // Simulate: calls 4-6 fail, others succeed
            if (callCount >= 4 && callCount <= 6) {
                throw new RuntimeException("Fraud service unavailable");
            }
            return "APPROVED: " + transactionId;
        }
    }

    public static void main(String[] args) throws InterruptedException {
        CircuitBreaker breaker = new CircuitBreaker(3, 2000); // 3 failures, 2s cooldown
        FraudDetectionService fraudService = new FraudDetectionService();

        System.out.println("=== Circuit Breaker Demo ===\n");

        for (int i = 1; i <= 10; i++) {
            String txnId = "TXN-" + String.format("%03d", i);

            try {
                String result = breaker.call(() -> fraudService.checkTransaction(txnId));
                System.out.println("Call " + i + ": " + result + " [Circuit: " + breaker.getState() + "]");
            } catch (RuntimeException e) {
                System.out.println("Call " + i + ": FAILED - " + e.getMessage() + " [Circuit: " + breaker.getState() + "]");
            }

            // After call 7, wait for cooldown to allow HALF_OPEN transition
            if (i == 7) {
                System.out.println("\n--- Waiting 2 seconds for cooldown ---\n");
                Thread.sleep(2100);
            }
        }
    }
}
```

## Expected Output
```
=== Circuit Breaker Demo ===

Call 1: APPROVED: TXN-001 [Circuit: CLOSED]
Call 2: APPROVED: TXN-002 [Circuit: CLOSED]
Call 3: APPROVED: TXN-003 [Circuit: CLOSED]
Call 4: FAILED - Fraud service unavailable [Circuit: CLOSED]
Call 5: FAILED - Fraud service unavailable [Circuit: CLOSED]
Call 6: FAILED - Fraud service unavailable [Circuit: OPEN]
Call 7: FAILED - Circuit breaker is OPEN — failing fast [Circuit: OPEN]

--- Waiting 2 seconds for cooldown ---

Call 8: APPROVED: TXN-008 [Circuit: CLOSED]
Call 9: APPROVED: TXN-009 [Circuit: CLOSED]
Call 10: APPROVED: TXN-010 [Circuit: CLOSED]
```

## Hint

In the `call()` method, first handle the OPEN state: check if `System.currentTimeMillis() - lastFailureTime >= cooldownMillis`. If so, transition to HALF_OPEN. If not, throw a "Circuit breaker is OPEN" exception. For CLOSED and HALF_OPEN states, try executing the action in a try-catch. On success, reset `failureCount` to 0 and set state to CLOSED. On failure, increment `failureCount`, record `lastFailureTime`, and if `failureCount >= failureThreshold`, set state to OPEN.

## Solution
```java
public class CircuitBreakerDemo {

    enum CircuitState { CLOSED, OPEN, HALF_OPEN }

    static class CircuitBreaker {
        private CircuitState state = CircuitState.CLOSED;
        private int failureCount = 0;
        private final int failureThreshold;
        private final long cooldownMillis;
        private long lastFailureTime = 0;

        public CircuitBreaker(int failureThreshold, long cooldownMillis) {
            this.failureThreshold = failureThreshold;
            this.cooldownMillis = cooldownMillis;
        }

        public String call(java.util.function.Supplier<String> action) {
            if (state == CircuitState.OPEN) {
                if (System.currentTimeMillis() - lastFailureTime >= cooldownMillis) {
                    state = CircuitState.HALF_OPEN;
                } else {
                    throw new RuntimeException("Circuit breaker is OPEN — failing fast");
                }
            }

            try {
                String result = action.get();
                failureCount = 0;
                state = CircuitState.CLOSED;
                return result;
            } catch (RuntimeException e) {
                failureCount++;
                lastFailureTime = System.currentTimeMillis();
                if (failureCount >= failureThreshold) {
                    state = CircuitState.OPEN;
                }
                throw e;
            }
        }

        public CircuitState getState() {
            return state;
        }
    }

    static class FraudDetectionService {
        private int callCount = 0;

        public String checkTransaction(String transactionId) {
            callCount++;
            if (callCount >= 4 && callCount <= 6) {
                throw new RuntimeException("Fraud service unavailable");
            }
            return "APPROVED: " + transactionId;
        }
    }

    public static void main(String[] args) throws InterruptedException {
        CircuitBreaker breaker = new CircuitBreaker(3, 2000);
        FraudDetectionService fraudService = new FraudDetectionService();

        System.out.println("=== Circuit Breaker Demo ===\n");

        for (int i = 1; i <= 10; i++) {
            String txnId = "TXN-" + String.format("%03d", i);

            try {
                String result = breaker.call(() -> fraudService.checkTransaction(txnId));
                System.out.println("Call " + i + ": " + result + " [Circuit: " + breaker.getState() + "]");
            } catch (RuntimeException e) {
                System.out.println("Call " + i + ": FAILED - " + e.getMessage() + " [Circuit: " + breaker.getState() + "]");
            }

            if (i == 7) {
                System.out.println("\n--- Waiting 2 seconds for cooldown ---\n");
                Thread.sleep(2100);
            }
        }
    }
}
```
