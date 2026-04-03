---
id: "logging-and-monitoring"
moduleId: "spring-boot"
title: "Logging & Monitoring"
description: "Configure structured logging, Actuator health checks, and custom metrics for production visibility."
order: 7
---

## Banking Scenario

When a transaction fails at 3 AM, your logs are the first place the on-call engineer looks. If your logs say "Error occurred" with no context, you're blind. Which user? Which account? Which server? Without structured logging and correlation IDs, debugging a production issue in a distributed banking system is like finding a needle in a haystack — across a dozen haystacks, each on a different server.

Banking systems require structured logging with correlation IDs (trace every request across services), proper log levels (don't log sensitive data!), and real-time health monitoring. Regulators also audit logging practices — insufficient logging is a compliance finding. PCI-DSS requires that all access to cardholder data is logged and that logs are retained for at least one year. Your logging strategy is not optional — it is a regulatory requirement.

## Content

### The Logging Stack: SLF4J and Logback

Spring Boot uses SLF4J (Simple Logging Facade for Java) as the logging API and Logback as the implementation. SLF4J is a facade — it provides a common interface so your code is not tied to a specific logging library. Logback is the actual engine that formats and writes log entries. You never import Logback classes directly; you always use SLF4J.

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class TransferService {
    private static final Logger log = LoggerFactory.getLogger(TransferService.class);

    public void processTransfer(String fromAccount, String toAccount, double amount) {
        log.info("Processing transfer of ${} from {} to {}", amount, fromAccount, toAccount);
        // business logic
        log.info("Transfer completed successfully");
    }
}
```

Use parameterized messages with `{}` placeholders instead of string concatenation. `log.info("Transfer: " + amount)` always builds the string, even if INFO level is disabled. `log.info("Transfer: {}", amount)` only builds it when the message will actually be logged. In a high-throughput banking system, this difference matters.

### Log Levels

There are five log levels, from most verbose to most critical: `TRACE`, `DEBUG`, `INFO`, `WARN`, and `ERROR`. Each serves a specific purpose.

```java
log.trace("Entering method processTransfer");           // Extremely detailed flow tracing
log.debug("Validating account {} exists", accountId);    // Development/troubleshooting detail
log.info("Transfer of ${} completed: {} -> {}", amt, from, to);  // Key business events
log.warn("Low balance alert: ${} remaining in {}", balance, id);  // Potential problems
log.error("Transfer failed: insufficient funds in {}", id, ex);   // Actual failures
```

In production, the log level is typically set to `INFO`. Everything below `INFO` (`DEBUG`, `TRACE`) is suppressed. You can configure per-package levels in `application.yml`:

```java
// application.yml equivalent (shown as comments for context):
// logging.level.root=INFO
// logging.level.com.javabank.transfer=DEBUG
// logging.level.com.javabank.security=WARN
```

This lets you increase verbosity for a specific package during troubleshooting without flooding logs from the entire application.

### Structured Logging

Plain text logs like `"Transfer completed for account 1001"` are human-readable but machine-hostile. Searching for all failed transfers over $10,000 requires parsing free-form text. Structured logging outputs JSON, making every field searchable and parseable by log aggregation tools like ELK (Elasticsearch, Logstash, Kibana), Splunk, or Datadog.

```java
// Plain text log (hard to search/parse):
// 2024-01-15 10:30:45 INFO  TransferService - Transfer completed for account 1001

// Structured JSON log (machine-parseable):
// {"timestamp":"2024-01-15T10:30:45","level":"INFO","logger":"TransferService",
//  "message":"Transfer completed","accountId":"1001","amount":500.00,"requestId":"req-12345"}
```

To enable JSON logging in Spring Boot, configure a Logback JSON encoder in `logback-spring.xml`. The structured format makes it trivial to build dashboards, alerts, and search queries across millions of log entries.

### MDC: Mapped Diagnostic Context

MDC (Mapped Diagnostic Context) lets you attach key-value pairs to every log line automatically, without passing them as method parameters. It uses thread-local storage, so each request thread has its own context. You set MDC values in a filter or interceptor at the start of the request, and every log statement on that thread includes them.

```java
import org.slf4j.MDC;

public class RequestFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        try {
            MDC.put("requestId", "req-" + UUID.randomUUID().toString().substring(0, 5));
            MDC.put("user", extractUser(req));
            chain.doFilter(req, res);
        } finally {
            MDC.clear(); // Always clear to prevent memory leaks
        }
    }
}

// Now every log.info() automatically includes requestId and user:
// [INFO] [req-12345] [user:alice] Processing transfer of $500.00
```

MDC is essential for tracing a single request across multiple service classes. Without it, correlating log lines from the same request is nearly impossible in a concurrent system.

### What NOT to Log

Banking systems handle sensitive data. Logging the wrong information creates security vulnerabilities and compliance violations. Never log passwords, authentication tokens, full credit card numbers, Social Security numbers, or personal identification numbers.

```java
// WRONG - never do this:
log.info("User login: email={}, password={}", email, password);
log.info("Card number: {}", cardNumber);
log.info("JWT token: {}", token);

// RIGHT - mask or omit sensitive data:
log.info("User login: email={}", email);
log.info("Card ending in: {}", cardNumber.substring(cardNumber.length() - 4));
log.info("Token validated for user: {}", userId);
```

PCI-DSS explicitly forbids logging full card numbers. GDPR restricts logging personal data. Build masking utilities that automatically redact sensitive fields before they reach the logger.

### Spring Boot Actuator

Spring Boot Actuator exposes production-ready endpoints for monitoring your application. Add `spring-boot-starter-actuator` to your dependencies, and you immediately get `/actuator/health`, `/actuator/info`, and `/actuator/metrics`.

```java
// /actuator/health returns:
// {"status": "UP", "components": {"db": {"status": "UP"}, "diskSpace": {"status": "UP"}}}

// Custom health indicator:
@Component
public class CoreBankingHealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        boolean coreSystemReachable = checkCoreBankingSystem();
        if (coreSystemReachable) {
            return Health.up().withDetail("coreBanking", "reachable").build();
        }
        return Health.down().withDetail("coreBanking", "unreachable").build();
    }
}
```

Actuator endpoints should be secured in production — expose only `/actuator/health` publicly and restrict others to internal networks or authenticated admin users.

### Custom Metrics with Micrometer

Micrometer is the metrics library bundled with Actuator. It provides three core metric types: `Counter` (things that only go up, like transaction count), `Timer` (measures duration, like response time), and `Gauge` (current value, like active connections).

```java
@Service
public class TransferService {
    private final Counter transferCounter;
    private final Timer transferTimer;

    public TransferService(MeterRegistry registry) {
        this.transferCounter = Counter.builder("transfers.total")
            .description("Total transfers processed").register(registry);
        this.transferTimer = Timer.builder("transfers.duration")
            .description("Transfer processing time").register(registry);
    }

    public void process(TransferRequest request) {
        transferTimer.record(() -> {
            // process transfer
            transferCounter.increment();
        });
    }
}
```

These metrics integrate with Prometheus and Grafana for real-time dashboards and alerting. Set alert thresholds like "error rate > 5% for 5 minutes" or "average response time > 2 seconds" to catch problems before customers report them.

## Why It Matters

In production banking systems, you cannot attach a debugger or add print statements. Logs and metrics are your only window into what is happening. Good logging tells you exactly which user, which account, and which request caused a failure. Good monitoring tells you when response times are degrading before customers notice. Together, they transform "something is broken" into "transfer ID TXN-45678 failed at 3:07 AM because account ACC-001 had insufficient funds" — and that is the difference between a 5-minute fix and a 5-hour investigation.

## Challenge

Simulate a logging system with MDC context that processes multiple transactions with different users and request IDs, outputting log lines at different levels.

## Starter Code
```java
import java.util.*;

public class LoggingDemo {

    // TODO: Create a SimpleLogger class that formats output as:
    //       [LEVEL] [requestId] [user:username] message

    // TODO: Create a SimpleMDC class with static put/get/clear methods (use a HashMap)

    // TODO: Simulate processing two transactions with different MDC contexts

    public static void main(String[] args) {
        // Transaction 1: alice transfers $500
        // Transaction 2: bob triggers a low balance warning
    }
}
```

## Expected Output
```
[INFO] [req-12345] [user:alice] Processing transfer of $500.00
[DEBUG] [req-12345] [user:alice] Validating account ACC-001
[INFO] [req-12345] [user:alice] Transfer completed successfully
[WARN] [req-67890] [user:bob] Low balance alert: $50.00 remaining
```

## Hint

Use a `HashMap<String, String>` to simulate MDC. Your `SimpleLogger` class reads the `requestId` and `user` values from the map when formatting each log line. Set different MDC values before each transaction, and clear them after. Use a minimum log level check (e.g., if the logger is set to INFO, skip DEBUG messages) to demonstrate level filtering.

## Solution
```java
import java.util.*;

public class LoggingDemo {

    static class SimpleMDC {
        private static final Map<String, String> context = new HashMap<>();

        static void put(String key, String value) {
            context.put(key, value);
        }

        static String get(String key) {
            return context.getOrDefault(key, "unknown");
        }

        static void clear() {
            context.clear();
        }
    }

    static class SimpleLogger {
        private final int minLevel;
        private static final Map<String, Integer> LEVELS = Map.of(
            "TRACE", 0, "DEBUG", 1, "INFO", 2, "WARN", 3, "ERROR", 4
        );

        SimpleLogger(String minLevel) {
            this.minLevel = LEVELS.getOrDefault(minLevel, 2);
        }

        private void log(String level, String message) {
            if (LEVELS.getOrDefault(level, 2) >= minLevel) {
                String requestId = SimpleMDC.get("requestId");
                String user = SimpleMDC.get("user");
                System.out.printf("[%s] [%s] [user:%s] %s%n", level, requestId, user, message);
            }
        }

        void info(String message) { log("INFO", message); }
        void debug(String message) { log("DEBUG", message); }
        void warn(String message) { log("WARN", message); }
        void error(String message) { log("ERROR", message); }
    }

    public static void main(String[] args) {
        SimpleLogger log = new SimpleLogger("DEBUG");

        SimpleMDC.put("requestId", "req-12345");
        SimpleMDC.put("user", "alice");

        log.info("Processing transfer of $500.00");
        log.debug("Validating account ACC-001");
        log.info("Transfer completed successfully");

        SimpleMDC.clear();

        SimpleMDC.put("requestId", "req-67890");
        SimpleMDC.put("user", "bob");

        log.warn("Low balance alert: $50.00 remaining");

        SimpleMDC.clear();
    }
}
```
