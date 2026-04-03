---
id: "spring-boot-project-anatomy"
moduleId: "spring"
title: "Spring Boot Project Anatomy"
description: "Understand how a Spring Boot project is structured, how auto-configuration works, and how to manage profiles."
order: 3
---

## Banking Scenario

When you join a banking development team, the first thing you encounter is the project structure. A typical Spring Boot banking service contains dozens of packages, multiple configuration files, and environment-specific settings for development, staging, and production. Before you write a single line of business logic, you need to understand how the project is organized.

Understanding the anatomy of a Spring Boot project means knowing what each file does, how auto-configuration discovers and creates beans, and how profiles let you switch between a local H2 database during development and a production PostgreSQL instance. This foundational knowledge prevents confusion when navigating real banking codebases and helps you contribute faster.

## Content

### @SpringBootApplication Breakdown

Every Spring Boot application starts with a main class annotated with `@SpringBootApplication`. This single annotation is actually a shortcut that combines three separate annotations:

- `@Configuration` marks the class as a source of bean definitions. Spring treats it like an XML config file, but in Java.
- `@EnableAutoConfiguration` tells Spring Boot to automatically configure beans based on the libraries on your classpath. If you have a database driver, Spring creates a DataSource. If you have Spring MVC, it configures an embedded web server.
- `@ComponentScan` tells Spring to scan the current package and all sub-packages for classes annotated with `@Component`, `@Service`, `@Repository`, and `@Controller`, registering them as beans.

```java
// This one annotation replaces three
@SpringBootApplication
public class JavaBankApplication {
    public static void main(String[] args) {
        SpringApplication.run(JavaBankApplication.class, args);
    }
}
```

The `main` method calls `SpringApplication.run()`, which bootstraps the entire application: it creates the application context, runs auto-configuration, starts the embedded server, and makes your app ready to handle requests.

### Project Structure Conventions

Spring Boot follows a standard Maven/Gradle project layout:

- `src/main/java` contains your application code. All your controllers, services, and models live here.
- `src/main/resources` holds configuration files like `application.yml`, static assets, and templates.
- `src/test/java` contains your test classes, mirroring the same package structure as your main code.

```java
// Standard Spring Boot project layout
// src/main/java/com/javabank/JavaBankApplication.java  (main class)
// src/main/resources/application.yml                    (config)
// src/main/resources/application-dev.yml                (dev config)
// src/main/resources/application-prod.yml               (prod config)
// src/test/java/com/javabank/JavaBankApplicationTests.java
```

### Package Organization for a Banking App

Professional banking applications organize code by feature responsibility. Each package has a clear role:

```java
// com.javabank.controller   - REST endpoints, request handling
// com.javabank.service      - Business logic, validation rules
// com.javabank.repository   - Database access, queries
// com.javabank.model        - JPA entities (Account, Transaction, Customer)
// com.javabank.dto          - Data Transfer Objects for API requests/responses
// com.javabank.config       - Custom configuration classes
// com.javabank.exception    - Custom exceptions and error handlers
```

This separation keeps your code organized as the application grows. When a new developer needs to fix a bug in account transfers, they know to look in `com.javabank.service`. When someone needs to add a new API endpoint, they go to `com.javabank.controller`.

### application.yml Deep Dive

The `application.yml` file is where you configure your application. Spring Boot reads this file on startup and uses the values to configure beans, set server options, and define custom properties.

```java
// application.yml structure (represented here for reference)
// server:
//   port: 8080
//
// spring:
//   datasource:
//     url: jdbc:h2:mem:javabankdb
//     driver-class-name: org.h2.Driver
//   jpa:
//     hibernate:
//       ddl-auto: create-drop
//     show-sql: true
//
// javabank:
//   default-currency: USD
//   max-transfer-limit: 50000.00
```

You access custom properties in your code using `@Value("${javabank.default-currency}")` or by creating a `@ConfigurationProperties` class that maps an entire section to a Java object.

### How Auto-Configuration Works

Spring Boot's auto-configuration reads files in `META-INF/spring.factories` (or `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` in newer versions) to discover configuration classes. Each configuration class uses conditional annotations to decide whether to create beans:

- `@ConditionalOnClass` activates only if a specific class is on the classpath.
- `@ConditionalOnMissingBean` creates a bean only if you have not already defined one yourself.

For example, when you add `spring-boot-starter-data-jpa` to your dependencies, Spring Boot detects Hibernate on the classpath and automatically creates a `DataSource`, `EntityManagerFactory`, and `TransactionManager`. You get a fully configured persistence layer without writing a single configuration class.

### Profiles

Profiles let you maintain different configurations for different environments. A banking app typically has `dev`, `staging`, and `prod` profiles:

```java
// application-dev.yml uses an in-memory H2 database
// spring.datasource.url=jdbc:h2:mem:javabankdb

// application-prod.yml uses PostgreSQL
// spring.datasource.url=jdbc:postgresql://db.javabank.com:5432/javabank
```

You activate a profile by setting `spring.profiles.active=dev` in `application.yml`, passing `--spring.profiles.active=prod` as a command-line argument, or setting the `SPRING_PROFILES_ACTIVE` environment variable. You can also use `@Profile("dev")` on a bean to make it available only in a specific profile.

### Starters

Spring Boot starters are curated dependency bundles. Instead of manually adding Tomcat, Jackson, and Spring MVC separately, you add one dependency: `spring-boot-starter-web`. Common starters for a banking app include:

- `spring-boot-starter-web` includes embedded Tomcat, Spring MVC, and Jackson for JSON.
- `spring-boot-starter-data-jpa` includes Hibernate, Spring Data JPA, and connection pooling.
- `spring-boot-starter-security` includes Spring Security for authentication and authorization.
- `spring-boot-starter-test` includes JUnit 5, Mockito, and Spring Test utilities.

Each starter brings in a set of libraries and triggers auto-configuration for those libraries, so you get sensible defaults with zero manual setup.

## Why It Matters

Understanding the anatomy of a Spring Boot project is the foundation for everything else you will build. When you know how `@SpringBootApplication` bootstraps your app, how auto-configuration detects and creates beans, and how profiles switch between environments, you can navigate any Spring Boot codebase confidently. In a banking environment where production stability is critical, knowing how to properly configure profiles ensures that development database credentials never accidentally reach production, and understanding starters helps you audit exactly which libraries and features are active in your deployed service.

## Challenge

Create a `JavaBankApplication` main class that reads the active profile, database URL, and server port from configuration, then prints them. Simulate profile-based configuration by setting up properties for a development environment.

## Starter Code
```java
public class JavaBankApplication {

    public static void main(String[] args) {
        // TODO: Simulate reading Spring Boot configuration
        // Set up profile, database URL, and server port
        // Print the active profile, database URL, and server port

        String activeProfile = _____;
        String databaseUrl = _____;
        int serverPort = _____;

        System.out.println("Active Profile: " + activeProfile);
        System.out.println("Database: " + databaseUrl);
        System.out.println("Server Port: " + serverPort);
    }
}
```

## Expected Output
```
Active Profile: development
Database: jdbc:h2:mem:javabankdb
Server Port: 8080
```

## Hint

Think about what values a development profile would use. An in-memory H2 database is standard for local development because it requires no external database server. The default Spring Boot server port is 8080. Assign these values to the variables and print them.

## Solution
```java
public class JavaBankApplication {

    public static void main(String[] args) {
        // Simulating Spring Boot profile configuration
        String activeProfile = "development";
        String databaseUrl = "jdbc:h2:mem:javabankdb";
        int serverPort = 8080;

        System.out.println("Active Profile: " + activeProfile);
        System.out.println("Database: " + databaseUrl);
        System.out.println("Server Port: " + serverPort);
    }
}
```
