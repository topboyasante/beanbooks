---
id: "production-readiness"
moduleId: "spring-boot"
title: "Production Readiness"
description: "Prepare Spring Boot applications for production with Actuator, Docker, and monitoring."
order: 5
---

## Banking Scenario

JavaBank's account service has passed all tests, security reviews, and load testing. Now it needs to go live. Production deployment in banking is not just running `java -jar app.jar` on a server. You need health checks so load balancers know your application is ready. You need metrics so operations can monitor performance. You need containerization for consistent deployment. And you need structured logging so incidents can be investigated.

The gap between "works on my machine" and "runs reliably in production" is where many developers struggle. This lesson covers the operational concerns that make your Spring Boot application production-ready: Actuator for observability, Docker for consistent deployment, and monitoring for proactive incident detection.

## Content

### Spring Boot Actuator

Spring Boot Actuator adds production-ready features to your application with a single dependency. It exposes HTTP endpoints for health checks, metrics, application info, and environment details. Load balancers use the health endpoint to route traffic. Monitoring systems scrape the metrics endpoint to track performance.

The most important endpoints are `/actuator/health` (application health status), `/actuator/metrics` (performance data like request count, response time, JVM memory), `/actuator/info` (application version and metadata), and `/actuator/env` (configuration properties). By default, only `/actuator/health` is exposed. You configure which endpoints are available.

In banking, the health endpoint is critical. Kubernetes uses it for readiness and liveness probes. If health returns DOWN, the container is restarted. Health checks can include database connectivity, disk space, external service availability, and custom checks for business-critical dependencies.

```java
// Add to pom.xml:
// <dependency>
//     <groupId>org.springframework.boot</groupId>
//     <artifactId>spring-boot-starter-actuator</artifactId>
// </dependency>

// application.yml:
// management:
//   endpoints:
//     web:
//       exposure:
//         include: health, info, metrics, prometheus
//   endpoint:
//     health:
//       show-details: always
//   info:
//     env:
//       enabled: true

// info:
//   app:
//     name: JavaBank Account Service
//     version: 1.0.0
//     description: Account management microservice

// GET /actuator/health response:
// {
//   "status": "UP",
//   "components": {
//     "db": { "status": "UP", "details": { "database": "PostgreSQL" } },
//     "diskSpace": { "status": "UP", "details": { "free": "50GB" } }
//   }
// }
```

### Custom Health Indicators

Spring Boot lets you create custom health indicators for application-specific checks. Implement the `HealthIndicator` interface and return `Health.up()` or `Health.down()` based on your check. Custom indicators appear alongside built-in ones in the health endpoint response.

For banking, custom health indicators might check: core banking system connectivity, payment gateway availability, message queue status, or license validity. If any critical dependency is down, the health indicator reports it, and the load balancer stops sending traffic to the unhealthy instance.

Health indicators should be fast (under 1 second) and should not have side effects. They are called frequently by monitoring systems and load balancers. If a health check takes too long, it can trigger false-positive DOWN statuses that cause unnecessary container restarts.

```java
@Component
class CoreBankingHealthIndicator implements HealthIndicator {

    private final CoreBankingClient client;

    CoreBankingHealthIndicator(CoreBankingClient client) {
        this.client = client;
    }

    @Override
    public Health health() {
        try {
            boolean reachable = client.ping();
            if (reachable) {
                return Health.up()
                    .withDetail("coreBanking", "Connected")
                    .withDetail("responseTime", "45ms")
                    .build();
            }
            return Health.down()
                .withDetail("coreBanking", "Unreachable")
                .build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}

// Health response now includes:
// "coreBanking": { "status": "UP", "details": { "responseTime": "45ms" } }
```

### Dockerizing a Spring Boot App

Docker containers package your application, runtime, and dependencies into a portable unit. The same container image runs identically on a developer's laptop, in CI, and in production. This eliminates environment-specific bugs and simplifies deployment.

A multi-stage Dockerfile optimizes the image. The first stage uses a full JDK image to build the application. The second stage uses a minimal JRE image to run it. This produces a smaller, more secure image (typically 200-300 MB instead of 800+ MB).

For banking, Docker provides consistency and security. Container images are scanned for vulnerabilities. Each deployment uses an immutable image -- no manual changes to production servers. Rolling updates deploy new containers while draining traffic from old ones, ensuring zero-downtime deployments.

```java
// Dockerfile (multi-stage build):
//
// # Stage 1: Build
// FROM eclipse-temurin:21-jdk AS build
// WORKDIR /app
// COPY pom.xml .
// COPY src ./src
// RUN mvn package -DskipTests
//
// # Stage 2: Run
// FROM eclipse-temurin:21-jre
// WORKDIR /app
// COPY --from=build /app/target/*.jar app.jar
//
// # Non-root user for security
// RUN addgroup --system appgroup && adduser --system appuser --ingroup appgroup
// USER appuser
//
// EXPOSE 8080
// ENTRYPOINT ["java", "-jar", "app.jar"]

// Build and run:
// docker build -t javabank-accounts:1.0.0 .
// docker run -p 8080:8080 \
//   -e SPRING_PROFILES_ACTIVE=prod \
//   -e DB_PASSWORD=secret \
//   javabank-accounts:1.0.0

// Docker Compose for local development:
// services:
//   app:
//     build: .
//     ports: ["8080:8080"]
//     depends_on: [db]
//   db:
//     image: postgres:16
//     environment:
//       POSTGRES_DB: javabank
//       POSTGRES_PASSWORD: devpass
```

### Environment Configuration

Production applications receive configuration through environment variables, not hardcoded property files. Spring Boot reads environment variables automatically: `DB_PASSWORD` maps to `db.password`, `SPRING_PROFILES_ACTIVE` sets the active profile. This follows the twelve-factor app methodology.

Secrets management is critical in banking. Database passwords, API keys, and encryption keys must never be in source code or Docker images. Use environment variables injected by the orchestrator (Kubernetes Secrets, AWS Secrets Manager) or a dedicated config server (Spring Cloud Config, HashiCorp Vault).

A common pattern is to have defaults in `application.yml` for development and override everything in production through environment variables. This lets developers run the application locally with zero configuration while production uses secure, externalized settings.

```java
// application.yml with environment variable fallbacks:
// spring:
//   datasource:
//     url: ${DATABASE_URL:jdbc:h2:mem:devdb}
//     username: ${DB_USERNAME:sa}
//     password: ${DB_PASSWORD:}
//   profiles:
//     active: ${SPRING_PROFILE:development}
// server:
//   port: ${SERVER_PORT:8080}

// Kubernetes deployment:
// env:
//   - name: SPRING_PROFILE
//     value: "production"
//   - name: DATABASE_URL
//     value: "jdbc:postgresql://db:5432/javabank"
//   - name: DB_PASSWORD
//     valueFrom:
//       secretKeyRef:
//         name: javabank-secrets
//         key: db-password
```

### Structured Logging

Production logging must be machine-parseable. JSON-formatted logs with consistent fields enable searching, filtering, and aggregation in log management tools like ELK Stack (Elasticsearch, Logstash, Kibana) or Grafana Loki. Unstructured text logs are nearly impossible to query at scale.

Correlation IDs trace a single request across multiple services. When a customer initiates a transfer, a unique ID follows the request from the API gateway through the account service, transaction service, and notification service. If something fails, you search for that ID and see the complete request journey.

In banking, audit logging is a regulatory requirement. Every account access, transaction, and configuration change must be logged with who, what, when, and where. Structured logs make it possible to query "show all transactions by user X in the last 30 days" across millions of log entries.

```java
// Logback configuration for JSON output (logback-spring.xml):
// <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
//   <encoder class="net.logstash.logback.encoder.LogstashEncoder">
//     <includeMdcKeyName>correlationId</includeMdcKeyName>
//     <includeMdcKeyName>userId</includeMdcKeyName>
//   </encoder>
// </appender>

// Using MDC for correlation IDs:
import org.slf4j.MDC;

class RequestFilter {
    void doFilter(Request request) {
        String correlationId = request.getHeader("X-Correlation-ID");
        if (correlationId == null) {
            correlationId = UUID.randomUUID().toString();
        }
        MDC.put("correlationId", correlationId);
        // All subsequent log statements include correlationId
    }
}

// JSON log output:
// {"timestamp":"2026-03-15T10:23:45","level":"INFO",
//  "message":"Transfer completed","correlationId":"abc-123",
//  "userId":"alice","amount":500.0,"fromAccount":"ACC-001"}
```

### Monitoring with Micrometer

Micrometer is Spring Boot's metrics facade, similar to SLF4J for logging. It collects metrics from your application and exports them to monitoring systems like Prometheus, Datadog, or New Relic. Spring Boot Actuator auto-configures Micrometer and exposes metrics through the `/actuator/prometheus` endpoint.

Built-in metrics include JVM memory usage, garbage collection, HTTP request count and latency, database connection pool stats, and thread counts. You can also define custom metrics for business operations: transactions per second, average transfer amount, failed authentication attempts.

For banking, monitoring is the early warning system. A spike in response time might indicate a database bottleneck. A drop in transactions per second could signal an outage. Increasing error rates might reveal a bug in a new deployment. Dashboards with alerts let operations teams respond before customers notice.

```java
// Custom metrics with Micrometer:
@Service
class TransactionService {

    private final Counter transactionCounter;
    private final Timer transactionTimer;

    TransactionService(MeterRegistry registry) {
        this.transactionCounter = Counter.builder("transactions.total")
            .description("Total transactions processed")
            .tag("service", "account")
            .register(registry);

        this.transactionTimer = Timer.builder("transactions.duration")
            .description("Transaction processing time")
            .register(registry);
    }

    void processTransaction(Transaction txn) {
        transactionTimer.record(() -> {
            // process transaction
            transactionCounter.increment();
        });
    }
}

// Prometheus metrics output at /actuator/prometheus:
// transactions_total{service="account"} 15234
// transactions_duration_seconds_count 15234
// transactions_duration_seconds_sum 456.78
// jvm_memory_used_bytes{area="heap"} 268435456
```

## Why It Matters

Building a feature is only half the job. Making it production-ready is the other half. Actuator health checks keep load balancers informed, Docker containers ensure consistent deployment, structured logging enables incident investigation, and monitoring provides visibility into application behavior. These operational skills are what separate junior developers who write code from senior developers who run services. In banking, production reliability is non-negotiable.

## Challenge

Simulate a production health check by creating a health endpoint that reports the status of the application, database, and disk space. Print the health check response.

## Starter Code
```java
public class Main {
    public static void main(String[] args) {
        // TODO: Create a HealthCheck class with checks for:
        //   - Database connectivity (simulated as UP)
        //   - Disk space (simulated as UP)
        //   - Overall application status
        // TODO: Create an AppInfo class with application name and version
        // TODO: Print health status and app info
    }
}
```

## Expected Output
```
Health: UP
Database: UP
Disk Space: UP
Application: JavaBank v1.0.0
```

## Hint

Create a `HealthCheck` class with methods `checkDatabase()` and `checkDiskSpace()` that return "UP". Add an `overallStatus()` method that returns "UP" if all checks pass. Create an `AppInfo` class with name and version fields. Print each health component and the application info at the end.

## Solution
```java
class HealthCheck {
    String checkDatabase() {
        return "UP";
    }

    String checkDiskSpace() {
        return "UP";
    }

    String overallStatus() {
        if ("UP".equals(checkDatabase()) && "UP".equals(checkDiskSpace())) {
            return "UP";
        }
        return "DOWN";
    }
}

class AppInfo {
    private String name;
    private String version;

    AppInfo(String name, String version) {
        this.name = name;
        this.version = version;
    }

    public String toString() {
        return name + " v" + version;
    }
}

public class Main {
    public static void main(String[] args) {
        HealthCheck health = new HealthCheck();
        AppInfo appInfo = new AppInfo("JavaBank", "1.0.0");

        System.out.println("Health: " + health.overallStatus());
        System.out.println("Database: " + health.checkDatabase());
        System.out.println("Disk Space: " + health.checkDiskSpace());
        System.out.println("Application: " + appInfo);
    }
}
```
