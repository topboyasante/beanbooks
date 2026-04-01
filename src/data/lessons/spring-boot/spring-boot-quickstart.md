---
id: "spring-boot-quickstart"
moduleId: "spring-boot"
title: "Spring Boot Quickstart"
description: "Create a Spring Boot application with auto-configuration and starters."
order: 1
---

## Banking Scenario

Your team at JavaBank has been tasked with building a new microservice for account management. With plain Spring Framework, you would spend hours configuring a web server, setting up a database connection pool, configuring JSON serialization, and writing XML or Java config classes. Spring Boot eliminates this setup time by providing sensible defaults and auto-configuration.

In the time it takes to configure a traditional Spring application, you can have a Spring Boot application running with an embedded web server, serving REST endpoints, connected to a database, and ready for production. This is why every modern banking project uses Spring Boot as its foundation.

## Content

### What Spring Boot Adds Over Spring

Spring Framework is powerful but requires significant configuration. You need to choose and configure a servlet container (Tomcat, Jetty), set up a DispatcherServlet, configure view resolvers, message converters, and dozens of other components. Spring Boot automates all of this.

Spring Boot provides three key features. First, auto-configuration detects libraries on your classpath and configures them automatically. If you include the Jackson library, Spring Boot configures JSON serialization. If you include HikariCP, it sets up a connection pool. Second, starter dependencies bundle compatible libraries together, so you add one dependency instead of ten. Third, an embedded server means your application runs as a standalone JAR with no external Tomcat installation needed.

The philosophy is "convention over configuration." Spring Boot makes opinionated choices for you (embedded Tomcat, HikariCP connection pool, Jackson for JSON) but lets you override everything. You start fast and customize only what you need.

```java
// Traditional Spring: dozens of config lines
// - Configure DispatcherServlet
// - Configure ViewResolver
// - Configure MessageConverters
// - Configure DataSource
// - Deploy to external Tomcat
// - Package as WAR file

// Spring Boot: one annotation, one class
@SpringBootApplication
public class JavaBankApplication {
    public static void main(String[] args) {
        SpringApplication.run(JavaBankApplication.class, args);
        // Embedded Tomcat starts on port 8080
        // Auto-configured JSON, database, security...
    }
}
```

### Spring Boot Starters

Starters are curated dependency sets that pull in everything you need for a specific feature. `spring-boot-starter-web` includes Spring MVC, embedded Tomcat, Jackson, and validation. `spring-boot-starter-data-jpa` includes Hibernate, HikariCP, and Spring Data JPA. `spring-boot-starter-security` includes Spring Security with default configuration.

You add one starter to your `pom.xml` or `build.gradle`, and Maven or Gradle resolves all transitive dependencies with compatible versions. No more version conflicts or missing libraries. Spring Boot's dependency management ensures that all libraries work together.

Common starters for banking applications include `spring-boot-starter-web` (REST APIs), `spring-boot-starter-data-jpa` (database access), `spring-boot-starter-security` (authentication), `spring-boot-starter-validation` (input validation), and `spring-boot-starter-actuator` (monitoring).

```java
// pom.xml starters for a banking application:
//
// <dependency>
//     <groupId>org.springframework.boot</groupId>
//     <artifactId>spring-boot-starter-web</artifactId>
// </dependency>
//
// <dependency>
//     <groupId>org.springframework.boot</groupId>
//     <artifactId>spring-boot-starter-data-jpa</artifactId>
// </dependency>
//
// <dependency>
//     <groupId>org.springframework.boot</groupId>
//     <artifactId>spring-boot-starter-security</artifactId>
// </dependency>
//
// Each starter pulls in ~10-20 compatible libraries automatically
```

### @SpringBootApplication

The `@SpringBootApplication` annotation is a convenience that combines three annotations. `@Configuration` marks the class as a source of bean definitions. `@EnableAutoConfiguration` tells Spring Boot to configure beans based on the classpath. `@ComponentScan` scans the package (and sub-packages) for Spring components.

This single annotation replaces what would be several configuration classes in a traditional Spring application. Place your main class in the root package of your project so that `@ComponentScan` finds all your components, services, and controllers in sub-packages.

The `main` method calls `SpringApplication.run()`, which bootstraps the entire application: creates the ApplicationContext, runs auto-configuration, starts the embedded server, and begins accepting requests. The return value is the ApplicationContext itself, which you rarely need to use directly.

```java
// @SpringBootApplication = @Configuration + @EnableAutoConfiguration + @ComponentScan
@SpringBootApplication
public class JavaBankApplication {

    public static void main(String[] args) {
        // Bootstrap sequence:
        // 1. Create ApplicationContext
        // 2. Scan for @Component, @Service, @Repository, @Controller
        // 3. Auto-configure based on classpath
        // 4. Start embedded Tomcat on port 8080
        // 5. Application is ready to serve requests

        SpringApplication.run(JavaBankApplication.class, args);
    }
}

// Package structure:
// com.javabank
//   ├── JavaBankApplication.java  (@SpringBootApplication)
//   ├── controller/
//   │   └── AccountController.java
//   ├── service/
//   │   └── AccountService.java
//   └── repository/
//       └── AccountRepository.java
```

### Application Configuration

Spring Boot reads configuration from `application.yml` (or `application.properties`). The most common settings include server port, database connection, logging level, and application name. Spring Boot auto-configuration reads these properties and applies them to the auto-configured beans.

You can override any auto-configuration property. For example, `server.port=9090` changes the embedded server port. `spring.datasource.url` configures the database connection. `logging.level.com.javabank=DEBUG` sets the log level for your packages.

For banking applications, you typically configure the server port, database connection, connection pool settings, logging levels, and security properties. Profile-specific files (`application-dev.yml`, `application-prod.yml`) provide environment-specific overrides.

```java
// application.yml for a banking application:
//
// server:
//   port: 8080
//   servlet:
//     context-path: /javabank
//
// spring:
//   application:
//     name: javabank-account-service
//   datasource:
//     url: jdbc:postgresql://localhost:5432/javabank
//     username: ${DB_USERNAME:admin}
//     password: ${DB_PASSWORD}
//   jpa:
//     hibernate:
//       ddl-auto: validate
//     show-sql: false
//
// logging:
//   level:
//     com.javabank: INFO
//     org.springframework.security: WARN

class ServerConfig {
    static void printStartupInfo(String appName, int port) {
        System.out.println(appName + " Starting...");
        System.out.println("Server running on port " + port);
    }
}
```

### Running the Application

Spring Boot applications can be run in several ways during development. `mvn spring-boot:run` starts the application using Maven. `./gradlew bootRun` starts it with Gradle. You can also build a JAR with `mvn package` and run it directly with `java -jar target/app.jar`. IDEs like IntelliJ let you run the main class directly.

For production, you build a fat JAR (uber-JAR) that contains your application and all dependencies, including the embedded server. This single JAR file is all you need to deploy -- no application server installation required. Docker containers typically run `java -jar app.jar`.

Spring Boot DevTools provides hot reload during development. When you change a Java file and recompile, DevTools automatically restarts the application in about 1-2 seconds. This dramatically speeds up the develop-test cycle compared to deploying to an external application server.

```java
// Development:
// mvn spring-boot:run
// ./gradlew bootRun
// IDE: Run JavaBankApplication.main()

// Production:
// mvn package
// java -jar target/javabank-1.0.0.jar

// With environment variables:
// DB_PASSWORD=secret java -jar javabank-1.0.0.jar --spring.profiles.active=prod

// Docker:
// FROM eclipse-temurin:21-jre
// COPY target/javabank-1.0.0.jar app.jar
// ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Spring Initializr

Spring Initializr (start.spring.io) is a web tool that generates Spring Boot project skeletons. You select your build tool (Maven or Gradle), Java version, Spring Boot version, and dependencies. It generates a downloadable ZIP with the correct project structure, `pom.xml`, main class, and test class.

Most banking teams use Initializr to start new microservices. It ensures consistent project structure and compatible dependency versions across the team. You can also access it from within IntelliJ IDEA (File > New > Spring Initializr) for a seamless workflow.

For a typical banking microservice, you would select: Spring Web, Spring Data JPA, PostgreSQL Driver, Spring Security, Validation, Actuator, and Lombok. Initializr generates the project with all these starters properly configured.

```java
// Spring Initializr selections for a banking microservice:
//
// Project: Maven
// Language: Java
// Spring Boot: 3.3.x
// Java: 21
//
// Dependencies:
// - Spring Web (REST APIs)
// - Spring Data JPA (Database access)
// - PostgreSQL Driver (Production DB)
// - H2 Database (Development/Testing)
// - Spring Security (Authentication)
// - Validation (Input validation)
// - Spring Boot Actuator (Monitoring)
// - Lombok (Reduce boilerplate)
//
// Generated structure:
// src/main/java/com/javabank/Application.java
// src/main/resources/application.properties
// src/test/java/com/javabank/ApplicationTests.java
// pom.xml
```

## Why It Matters

Spring Boot is the standard framework for building Java applications in banking and finance. It eliminates configuration overhead so you can focus on business logic. Understanding auto-configuration, starters, and the application lifecycle is essential for every Spring Boot developer. This is the foundation that every subsequent lesson builds on, and it is what you will use to build real banking services.

## Challenge

Create a Spring Boot main class with a simulated health endpoint. Print the application startup sequence and health check response.

## Starter Code
```java
public class Main {
    public static void main(String[] args) {
        // TODO: Create a JavaBankApplication class
        // TODO: Simulate the startup sequence
        // TODO: Create a HealthController with a health() method
        // TODO: Print startup messages and health check result
    }
}
```

## Expected Output
```
JavaBank Application Starting...
Server running on port 8080
Health Check: UP
```

## Hint

Create a `JavaBankApplication` class with a `start` method that prints the startup messages. Create a `HealthController` class with a `health` method that returns "UP". In `main`, create the application, call `start`, then call the health endpoint and print the result.

## Solution
```java
class JavaBankApplication {
    private int port;

    JavaBankApplication(int port) {
        this.port = port;
    }

    void start() {
        System.out.println("JavaBank Application Starting...");
        System.out.println("Server running on port " + port);
    }
}

class HealthController {
    String health() {
        return "UP";
    }
}

public class Main {
    public static void main(String[] args) {
        JavaBankApplication app = new JavaBankApplication(8080);
        app.start();

        HealthController healthController = new HealthController();
        System.out.println("Health Check: " + healthController.health());
    }
}
```
