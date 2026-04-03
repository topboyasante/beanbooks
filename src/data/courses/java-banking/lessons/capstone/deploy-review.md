---
id: "deploy-review"
moduleId: "capstone"
title: "Deploy & Review"
description: "Containerize the app, configure monitoring, and review the complete codebase."
order: 6
---

## Banking Scenario

JavaBank's API is feature-complete and fully tested. Now the operations team needs to ship it. The app must run identically on every developer's machine, in staging, and in production. A Docker container guarantees that consistency. The team also needs monitoring to know if the app is healthy, and a final code review to ensure nothing was missed before going live.

This lesson ties together everything from the entire course. You will containerize the application, set up monitoring endpoints, configure production settings, and run through a code review checklist that touches every module you have studied.

## Content

### Multi-Stage Dockerfile

A multi-stage Docker build keeps the final image small by separating the build environment from the runtime. This is the containerization concept from the deployment module applied to JavaBank:

```java
// Dockerfile
// # Stage 1: Build
// FROM eclipse-temurin:21-jdk AS builder
// WORKDIR /app
// COPY build.gradle settings.gradle ./
// COPY gradle/ gradle/
// COPY gradlew ./
// RUN ./gradlew dependencies --no-daemon
// COPY src/ src/
// RUN ./gradlew bootJar --no-daemon
//
// # Stage 2: Run
// FROM eclipse-temurin:21-jre
// WORKDIR /app
// COPY --from=builder /app/build/libs/*.jar app.jar
// EXPOSE 8080
// ENTRYPOINT ["java", "-jar", "app.jar"]
```

The first stage uses the full JDK to compile the code. The second stage uses only the JRE, cutting the image size significantly. Dependencies are cached in a separate layer so they are not re-downloaded on every code change.

### Docker Compose with PostgreSQL

Docker Compose defines the full runtime environment. JavaBank needs the API server and a PostgreSQL database:

```java
// docker-compose.yml
// version: '3.8'
// services:
//   db:
//     image: postgres:16
//     environment:
//       POSTGRES_DB: javabank
//       POSTGRES_USER: javabank_user
//       POSTGRES_PASSWORD: ${DB_PASSWORD}
//     ports:
//       - "5432:5432"
//     volumes:
//       - pgdata:/var/lib/postgresql/data
//
//   api:
//     build: .
//     ports:
//       - "8080:8080"
//     environment:
//       SPRING_PROFILES_ACTIVE: prod
//       DATABASE_URL: jdbc:postgresql://db:5432/javabank
//       DB_USER: javabank_user
//       DB_PASSWORD: ${DB_PASSWORD}
//     depends_on:
//       - db
//
// volumes:
//   pgdata:
```

Notice how database credentials use environment variables, never hardcoded secrets in compose files. The `depends_on` ensures the database starts before the API.

### Actuator Health and Metrics Endpoints

Spring Boot Actuator provides production-ready monitoring out of the box. Health checks tell load balancers if the app is ready. Metrics endpoints expose JVM and application statistics:

```java
// application.yml (actuator config)
// management:
//   endpoints:
//     web:
//       exposure:
//         include: health, metrics, info
//   endpoint:
//     health:
//       show-details: when_authorized
```

```java
package com.javabank.api.config;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component
public class BankHealthIndicator implements HealthIndicator {

    @Override
    public Health health() {
        boolean databaseUp = checkDatabase();
        if (databaseUp) {
            System.out.println("Health check: UP");
            return Health.up()
                .withDetail("database", "connected")
                .withDetail("service", "JavaBank API")
                .build();
        }
        System.out.println("Health check: DOWN");
        return Health.down()
            .withDetail("database", "disconnected")
            .build();
    }

    private boolean checkDatabase() {
        return true; // Simplified for demonstration
    }
}
```

### Environment-Based Configuration for Production

Production configuration must be strict: no SQL logging, no auto-schema changes, connection pooling tuned for load, and all secrets from environment variables:

```java
// Production checklist in application-prod.yml:
// spring.jpa.hibernate.ddl-auto: none
// spring.jpa.show-sql: false
// server.error.include-stacktrace: never
// logging.level.root: WARN
// logging.level.com.javabank: INFO
```

```java
package com.javabank.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import jakarta.annotation.PostConstruct;

@Configuration
@Profile("prod")
public class ProductionConfig {

    @PostConstruct
    public void init() {
        System.out.println("Production configuration loaded");
        System.out.println("SQL logging: disabled");
        System.out.println("Stack traces in errors: hidden");
        System.out.println("DDL auto: none (Flyway manages schema)");
    }
}
```

### Code Review Checklist

Before merging to main, the team runs through a comprehensive review. This checklist touches every module from the course:

```java
// JavaBank Code Review Checklist:
//
// SECURITY
// [ ] No hardcoded secrets in source code
// [ ] All endpoints require authentication (except public)
// [ ] Input validated with Bean Validation annotations
// [ ] SQL injection prevented (using parameterized queries)
//
// ERROR HANDLING
// [ ] GlobalExceptionHandler covers all exception types
// [ ] No stack traces leaked to API consumers
// [ ] Business exceptions use appropriate HTTP status codes
//
// TEST COVERAGE
// [ ] Unit tests for all service methods
// [ ] Controller tests for all endpoints
// [ ] Integration tests for critical flows
// [ ] Edge cases covered (empty lists, null values, limits)
//
// LOGGING
// [ ] Structured logging with appropriate levels
// [ ] No sensitive data in log output
// [ ] Request/response logging for audit trail
//
// CODE QUALITY
// [ ] DTOs separate API contract from entities
// [ ] BigDecimal used for all monetary values
// [ ] Transactions annotated with @Transactional
// [ ] No circular dependencies between services
```

### Full Project Recap

JavaBank brings together every concept from the course. Java basics gave you the language fundamentals. OOP taught you to model the domain with classes, inheritance, and encapsulation. Spring provided dependency injection and the web framework. Testing gave you confidence in your code. Git and CI/CD prepared you for team workflows. And now deployment closes the loop from code to production.

```java
public class ProjectRecap {
    public static void main(String[] args) {
        System.out.println("JavaBank API - Project Complete");
        System.out.println("================================");
        System.out.println("Modules applied:");
        System.out.println("  Java Basics    -> Types, control flow, exceptions");
        System.out.println("  OOP            -> Entities, inheritance, encapsulation");
        System.out.println("  Spring         -> DI, controllers, services, repos");
        System.out.println("  Testing        -> JUnit, Mockito, MockMvc");
        System.out.println("  Security       -> JWT, roles, filter chain");
        System.out.println("  Deployment     -> Docker, Compose, Actuator");
        System.out.println("================================");
        System.out.println("Status: Ready for production");
    }
}
```

## Why It Matters

Code that cannot be deployed is code that does not exist. Containerization ensures your app runs the same everywhere. Monitoring tells you when something breaks before your customers do. A thorough code review catches the issues that automated tests miss. These final steps transform a working application into a production-ready banking system, completing the full software development lifecycle.

## Questions

Q: Why does a multi-stage Docker build use a JRE image for the final stage instead of a JDK?
A) The JRE includes more tools for debugging in production
B) The JRE image is smaller because it excludes compilation tools not needed at runtime
C) The JDK cannot run JAR files
D) Spring Boot requires the JRE specifically
Correct: B

Q: What does `depends_on: db` in docker-compose.yml ensure?
A) The API container shares memory with the database container
B) The database container starts before the API container
C) The database is automatically backed up when the API starts
D) The API container runs inside the database container
Correct: B

Q: Why should `spring.jpa.hibernate.ddl-auto` be set to `none` in production?
A) It makes the application start faster
B) Hibernate cannot generate valid SQL for PostgreSQL
C) Automatic schema changes in production can corrupt data or drop tables
D) The none setting enables read-only mode for better security
Correct: C

## Challenge

Create a deployment configuration simulator. Build a class that loads different configuration settings based on the environment (dev vs prod) and prints a startup report including database settings, security status, and monitoring endpoints.

## Starter Code
```java
import java.util.HashMap;
import java.util.Map;

class AppConfig {
    private String profile;
    private Map<String, String> settings = new HashMap<>();

    // TODO: Constructor that takes a profile name
    // TODO: loadDevConfig method
    // TODO: loadProdConfig method
    // TODO: printStartupReport method
}

public class DeployReviewDemo {
    public static void main(String[] args) {
        // TODO: Create dev config and print report
        // TODO: Create prod config and print report
    }
}
```

## Expected Output
```
=== JavaBank Startup Report ===
Profile: dev
Database: jdbc:postgresql://localhost:5432/javabank_dev
SQL Logging: enabled
DDL Auto: validate
Security: basic
Monitoring: /actuator/health
===============================

=== JavaBank Startup Report ===
Profile: prod
Database: jdbc:postgresql://db:5432/javabank
SQL Logging: disabled
DDL Auto: none
Security: JWT + HTTPS
Monitoring: /actuator/health, /actuator/metrics
===============================
```

## Hint

Use a `Map<String, String>` to store settings. In the constructor, check the profile name and call either `loadDevConfig()` or `loadProdConfig()`. Each method populates the map with different values. The `printStartupReport()` method iterates over the map entries to display them.

## Solution
```java
import java.util.LinkedHashMap;
import java.util.Map;

class AppConfig {
    private String profile;
    private Map<String, String> settings = new LinkedHashMap<>();

    public AppConfig(String profile) {
        this.profile = profile;
        if ("dev".equals(profile)) {
            loadDevConfig();
        } else if ("prod".equals(profile)) {
            loadProdConfig();
        }
    }

    private void loadDevConfig() {
        settings.put("Database",
            "jdbc:postgresql://localhost:5432/javabank_dev");
        settings.put("SQL Logging", "enabled");
        settings.put("DDL Auto", "validate");
        settings.put("Security", "basic");
        settings.put("Monitoring", "/actuator/health");
    }

    private void loadProdConfig() {
        settings.put("Database",
            "jdbc:postgresql://db:5432/javabank");
        settings.put("SQL Logging", "disabled");
        settings.put("DDL Auto", "none");
        settings.put("Security", "JWT + HTTPS");
        settings.put("Monitoring",
            "/actuator/health, /actuator/metrics");
    }

    public void printStartupReport() {
        System.out.println("=== JavaBank Startup Report ===");
        System.out.println("Profile: " + profile);
        for (Map.Entry<String, String> entry
                : settings.entrySet()) {
            System.out.println(entry.getKey() + ": "
                + entry.getValue());
        }
        System.out.println("===============================");
    }
}

public class DeployReviewDemo {
    public static void main(String[] args) {
        AppConfig devConfig = new AppConfig("dev");
        devConfig.printStartupReport();
        System.out.println();

        AppConfig prodConfig = new AppConfig("prod");
        prodConfig.printStartupReport();
    }
}
```
