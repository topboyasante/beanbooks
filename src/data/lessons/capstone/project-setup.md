---
id: "project-setup"
moduleId: "capstone"
title: "Project Setup"
description: "Initialize a Spring Boot banking project with the right dependencies and structure."
order: 1
---

## Banking Scenario

Every real-world banking application starts long before the first line of business logic. The architecture team at JavaBank has been tasked with bootstrapping a brand-new API from scratch. They need to pick the right framework, select dependencies that cover web serving, data persistence, security, validation, and testing, and lay out a project structure that will scale as the team grows.

Getting the foundation right means fewer headaches later. A misconfigured project or a missing dependency can cost hours of debugging. In this lesson you will initialize a Spring Boot project exactly the way a professional team would, applying everything you have learned about Java, Spring, and build tools.

## Content

### Generating the Project with Spring Initializr

Spring Initializr is the standard way to scaffold a Spring Boot application. You can use the web UI at start.spring.io or the command line. For JavaBank, select these starters:

```java
// build.gradle (key dependencies)
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    runtimeOnly 'org.postgresql:postgresql'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}
```

Each starter pulls in a curated set of libraries. `spring-boot-starter-web` gives you an embedded Tomcat server and Spring MVC. `spring-boot-starter-data-jpa` brings Hibernate and Spring Data repositories. `spring-boot-starter-security` adds authentication and authorization filters. `spring-boot-starter-validation` enables Bean Validation annotations like `@NotNull` and `@Size`. The test starter includes JUnit 5, Mockito, and MockMvc.

### Project Structure for a Banking App

A well-organized package layout keeps concerns separated. JavaBank follows a layered architecture:

```java
// Package structure
// com.javabank.api
//   ├── config/          Security, CORS, and app configuration
//   ├── controller/      REST controllers
//   ├── dto/             Request and response objects
//   ├── entity/          JPA entities
//   ├── exception/       Custom exceptions and handlers
//   ├── repository/      Spring Data interfaces
//   ├── service/         Business logic
//   └── JavaBankApplication.java
```

This mirrors the separation of concerns you learned in OOP and Spring modules. Each layer depends only on the layer directly below it.

### Configuring application.yml with Profiles

Spring Boot supports environment-specific configuration through profiles. JavaBank needs different settings for development and production:

```java
// application.yml
// spring:
//   profiles:
//     active: dev
//
// ---
// spring:
//   config:
//     activate:
//       on-profile: dev
//   datasource:
//     url: jdbc:postgresql://localhost:5432/javabank_dev
//     username: dev_user
//     password: dev_pass
//   jpa:
//     hibernate:
//       ddl-auto: validate
//     show-sql: true
//
// ---
// spring:
//   config:
//     activate:
//       on-profile: prod
//   datasource:
//     url: ${DATABASE_URL}
//     username: ${DB_USER}
//     password: ${DB_PASSWORD}
//   jpa:
//     hibernate:
//       ddl-auto: none
//     show-sql: false
```

Notice how the production profile uses environment variables instead of hardcoded credentials, a security practice covered in the backend patterns module.

### Creating the Main Application Class

The entry point is simple but critical. The `@SpringBootApplication` annotation combines component scanning, auto-configuration, and configuration in one:

```java
package com.javabank.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class JavaBankApplication {

    public static void main(String[] args) {
        SpringApplication.run(JavaBankApplication.class, args);
        System.out.println("JavaBank API started successfully!");
    }
}
```

### Verifying the Application Runs

After setup, run the application and confirm it starts without errors. Spring Boot logs the port, active profile, and any auto-configuration decisions. A health check endpoint from Actuator can confirm everything is wired correctly:

```java
package com.javabank.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/api/health")
    public String health() {
        System.out.println("Health check requested");
        return "JavaBank API is running";
    }
}
```

### Dependency Management Best Practices

Use the Spring Boot BOM (Bill of Materials) to keep dependency versions aligned. Never mix Spring Boot starter versions manually. Pin your Java version in the build file and use Gradle's `platform` or Maven's `dependencyManagement` to avoid version conflicts across modules.

## Why It Matters

A properly scaffolded project is the foundation everything else builds on. In professional banking software, misconfigured dependencies or sloppy project structure lead to security vulnerabilities, hard-to-trace bugs, and painful onboarding for new developers. Getting setup right means you spend your time on business logic, not fighting your build system.

## Questions

Q: Which Spring Boot starter provides embedded Tomcat and Spring MVC?
A) spring-boot-starter-data-jpa
B) spring-boot-starter-web
C) spring-boot-starter-security
D) spring-boot-starter-validation
Correct: B

Q: Why does the production profile use environment variables instead of hardcoded values for database credentials?
A) Environment variables make the app run faster
B) Hardcoded values cause compilation errors in production
C) Environment variables keep secrets out of source code
D) Spring Boot requires environment variables in production mode
Correct: C

Q: What does the @SpringBootApplication annotation combine?
A) @Controller, @Service, and @Repository
B) @ComponentScan, @EnableAutoConfiguration, and @Configuration
C) @RestController, @RequestMapping, and @ResponseBody
D) @Entity, @Table, and @Column
Correct: B

## Challenge

Create a Spring Boot main class for JavaBank that prints a startup banner showing the application name, active profile, and port. Add a health check endpoint that returns the current server time.

## Starter Code
```java
package com.javabank.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class JavaBankApplication {

    public static void main(String[] args) {
        // TODO: Start the application
        // TODO: Print startup banner with app name
        System.out.println("=================================");
        System.out.println("  JavaBank API");
        // TODO: Print the active profile and port
        System.out.println("=================================");
    }
}
```

## Expected Output
```
=================================
  JavaBank API
  Profile: dev
  Port: 8080
  Status: RUNNING
=================================
Health check requested
Server time: 2026-04-01T10:30:00
```

## Hint

Use `SpringApplication.run()` which returns a `ConfigurableApplicationContext`. From the context you can call `getEnvironment().getActiveProfiles()` to get the active profile and `getEnvironment().getProperty("server.port", "8080")` to get the port.

## Solution
```java
package com.javabank.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;

@SpringBootApplication
public class JavaBankApplication {

    public static void main(String[] args) {
        ConfigurableApplicationContext context =
            SpringApplication.run(JavaBankApplication.class, args);

        Environment env = context.getEnvironment();
        String profile = env.getActiveProfiles().length > 0
            ? env.getActiveProfiles()[0] : "default";
        String port = env.getProperty("server.port", "8080");

        System.out.println("=================================");
        System.out.println("  JavaBank API");
        System.out.println("  Profile: " + profile);
        System.out.println("  Port: " + port);
        System.out.println("  Status: RUNNING");
        System.out.println("=================================");
    }
}
```
