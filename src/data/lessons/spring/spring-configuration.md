---
id: "spring-configuration"
moduleId: "spring"
title: "Spring Configuration"
description: "Configure Spring applications with annotations, Java config, and properties."
order: 2
---

## Banking Scenario

JavaBank runs in three environments: development (local H2 database, debug logging), staging (shared PostgreSQL, normal logging), and production (replicated PostgreSQL cluster, minimal logging, SSL enabled). The application code should be identical across all environments -- only the configuration should change.

Spring's configuration system lets you externalize settings like database URLs, connection pool sizes, and feature flags into properties files. Spring profiles let you activate different configurations per environment, so the same JAR file runs correctly whether deployed to a developer's laptop or a production server.

## Content

### @Configuration and @Bean

The `@Configuration` annotation marks a class as a source of bean definitions. Methods annotated with `@Bean` inside a configuration class return objects that Spring manages as beans. This is Java-based configuration, an alternative to component scanning when you need more control over bean creation.

Use `@Configuration` when you need to create beans from third-party classes that you cannot annotate with `@Component`, when bean creation requires complex initialization logic, or when you want to centralize related bean definitions. Each `@Bean` method acts as a factory method, and Spring calls it once (for singleton scope) and caches the result.

The method name becomes the bean name by default. You can override it with `@Bean("customName")`. Spring resolves dependencies between `@Bean` methods automatically: if one bean method calls another, Spring returns the cached singleton rather than creating a new instance.

```java
@Configuration
class BankingConfig {

    @Bean
    DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:postgresql://localhost:5432/javabank");
        ds.setUsername("admin");
        ds.setPassword("secret");
        ds.setMaximumPoolSize(10);
        return ds;
    }

    @Bean
    AccountRepository accountRepository(DataSource dataSource) {
        return new JpaAccountRepository(dataSource);
    }

    @Bean
    AccountService accountService(AccountRepository repository) {
        return new AccountService(repository);
    }
}
```

### @Value for Properties

The `@Value` annotation injects values from property files into your beans. Instead of hardcoding database URLs or pool sizes, you reference property keys with the `${property.name}` syntax. You can provide defaults with `${property.name:defaultValue}`.

This separates configuration from code. The same compiled application can connect to different databases by changing a properties file, without recompilation. In banking, this is critical for compliance: production database credentials should never be in source code.

`@Value` supports SpEL (Spring Expression Language) for computed values. You can reference environment variables, perform arithmetic, or call methods. However, for complex configuration, `@ConfigurationProperties` (covered later) is preferred over scattered `@Value` annotations.

```java
@Service
class DatabaseService {

    @Value("${database.url}")
    private String dbUrl;

    @Value("${database.pool.maxSize:10}")  // default: 10
    private int maxPoolSize;

    @Value("${bank.name:JavaBank}")
    private String bankName;

    void printConfig() {
        System.out.println("Database URL: " + dbUrl);
        System.out.println("Max Pool Size: " + maxPoolSize);
        System.out.println("Bank: " + bankName);
    }
}
```

### Application Properties

Spring Boot loads configuration from `application.properties` or `application.yml` files. YAML is preferred in modern projects for its readability and support for hierarchical structures. These files go in `src/main/resources` and are automatically loaded at startup.

Properties follow a hierarchical naming convention using dots: `spring.datasource.url`, `spring.datasource.username`, `server.port`. Spring Boot auto-configuration reads many of these properties to configure infrastructure beans automatically. You can also define custom properties for your application.

Property files support placeholders and references. You can reference environment variables with `${ENV_VAR}`, reference other properties with `${other.property}`, and use random values with `${random.int}` for testing.

```java
// application.properties
// server.port=8080
// spring.datasource.url=jdbc:h2:mem:testdb
// spring.datasource.username=sa
// bank.name=JavaBank
// bank.max-transfer-amount=50000

// application.yml (equivalent, more readable)
// server:
//   port: 8080
// spring:
//   datasource:
//     url: jdbc:h2:mem:testdb
//     username: sa
// bank:
//   name: JavaBank
//   max-transfer-amount: 50000

class AppConfig {
    private String profile;
    private String databaseUrl;
    private int maxPoolSize;

    AppConfig(String profile, String databaseUrl, int maxPoolSize) {
        this.profile = profile;
        this.databaseUrl = databaseUrl;
        this.maxPoolSize = maxPoolSize;
    }

    void printConfig() {
        System.out.println("Active Profile: " + profile);
        System.out.println("Database URL: " + databaseUrl);
        System.out.println("Max Pool Size: " + maxPoolSize);
    }
}
```

### Spring Profiles

Profiles let you define environment-specific configurations. You can have different beans, property values, and even entire configuration classes active only in specific profiles. The active profile is set via the `spring.profiles.active` property, command-line argument, or environment variable.

In banking, profiles are essential. Development uses H2 for fast iteration, staging uses a shared test database, and production uses a replicated cluster with connection pooling and SSL. Each environment needs different credentials, URLs, and performance tuning.

Profile-specific properties files follow the naming pattern `application-{profile}.properties`. Properties in `application-dev.properties` override defaults when the `dev` profile is active. You can also annotate `@Configuration` classes or `@Bean` methods with `@Profile` to conditionally create beans.

```java
// application.properties (defaults)
// spring.profiles.active=development

// application-development.properties
// spring.datasource.url=jdbc:h2:mem:testdb
// spring.datasource.pool.max-size=5

// application-production.properties
// spring.datasource.url=jdbc:postgresql://prod-db:5432/javabank
// spring.datasource.pool.max-size=50

@Configuration
class DataSourceConfig {

    @Bean
    @Profile("development")
    DataSource devDataSource() {
        System.out.println("Creating H2 development datasource");
        return new H2DataSource("jdbc:h2:mem:testdb");
    }

    @Bean
    @Profile("production")
    DataSource prodDataSource() {
        System.out.println("Creating PostgreSQL production datasource");
        return new PostgresDataSource("jdbc:postgresql://prod-db:5432/javabank");
    }
}
```

### @ConfigurationProperties

For complex configuration with many related properties, `@ConfigurationProperties` is better than individual `@Value` annotations. It binds an entire prefix of properties to a Java object, providing type safety, validation, and IDE auto-completion.

You create a class with fields matching the property names, annotate it with `@ConfigurationProperties(prefix = "bank")`, and Spring automatically populates the fields from properties starting with `bank.`. Nested objects map to nested property prefixes. Lists and maps are supported.

This approach is cleaner because all related configuration lives in one class. You can validate it with JSR-303 annotations (`@NotNull`, `@Min`, `@Max`) and Spring will fail fast at startup if the configuration is invalid. In banking, failing at startup is much better than failing at midnight when processing transactions.

```java
// @ConfigurationProperties(prefix = "bank")
class BankProperties {
    private String name;
    private double maxTransferAmount;
    private DatabaseProperties database;

    // getters and setters

    static class DatabaseProperties {
        private String url;
        private int poolSize;
        // getters and setters
    }
}

// application.yml
// bank:
//   name: JavaBank
//   max-transfer-amount: 50000
//   database:
//     url: jdbc:postgresql://localhost:5432/javabank
//     pool-size: 20
```

### Environment-Specific Configuration

In practice, banking applications use a combination of profiles, external configuration, and environment variables to manage settings across environments. The priority order matters: command-line arguments override environment variables, which override `application-{profile}.properties`, which override `application.properties`.

Production secrets like database passwords and API keys should never be in property files committed to source control. Use environment variables, a secrets manager (like AWS Secrets Manager or HashiCorp Vault), or Spring Cloud Config Server. Spring's `${DB_PASSWORD}` syntax reads environment variables seamlessly.

A common pattern is to have sensible defaults in `application.properties`, environment-specific overrides in profile files, and secrets injected via environment variables or a config server at deployment time.

```java
// Combining profiles and environment variables
// application.properties
// bank.name=JavaBank
// spring.profiles.active=${SPRING_PROFILE:development}

// application-development.properties
// database.url=jdbc:h2:mem:testdb
// database.pool-size=5

// application-production.properties
// database.url=${DATABASE_URL}
// database.pool-size=${DB_POOL_SIZE:20}

// At deployment:
// export SPRING_PROFILE=production
// export DATABASE_URL=jdbc:postgresql://prod-db:5432/javabank
// export DB_POOL_SIZE=50
// java -jar javabank.jar
```

## Why It Matters

Configuration management is a critical skill for deploying banking applications across environments. Understanding how Spring handles properties, profiles, and bean configuration lets you build applications that are portable, secure, and easy to operate. Misconfigured applications are a top cause of production incidents in banking, and knowing how Spring resolves configuration is essential for debugging deployment issues.

## Challenge

Create a configuration class that provides different settings based on the active profile. Simulate a development profile with H2 database configuration and print the active settings.

## Starter Code
```java
public class Main {
    public static void main(String[] args) {
        // TODO: Create an AppConfig class with fields: profile, databaseUrl, maxPoolSize
        // TODO: Create a "development" configuration:
        //   - profile: "development"
        //   - databaseUrl: "jdbc:h2:mem:testdb"
        //   - maxPoolSize: 5
        // TODO: Print the configuration
    }
}
```

## Expected Output
```
Active Profile: development
Database URL: jdbc:h2:mem:testdb
Max Pool Size: 5
```

## Hint

Create an `AppConfig` class with a constructor that takes the profile name, database URL, and max pool size. Add a `printConfig` method that prints each field. In `main`, create an instance with the development values and call `printConfig`. This simulates what Spring profiles do automatically with `application-development.properties`.

## Solution
```java
class AppConfig {
    private final String profile;
    private final String databaseUrl;
    private final int maxPoolSize;

    AppConfig(String profile, String databaseUrl, int maxPoolSize) {
        this.profile = profile;
        this.databaseUrl = databaseUrl;
        this.maxPoolSize = maxPoolSize;
    }

    void printConfig() {
        System.out.println("Active Profile: " + profile);
        System.out.println("Database URL: " + databaseUrl);
        System.out.println("Max Pool Size: " + maxPoolSize);
    }
}

public class Main {
    public static void main(String[] args) {
        String activeProfile = "development";

        AppConfig config;
        if (activeProfile.equals("development")) {
            config = new AppConfig("development", "jdbc:h2:mem:testdb", 5);
        } else {
            config = new AppConfig("production", "jdbc:postgresql://prod:5432/javabank", 50);
        }

        config.printConfig();
    }
}
```
