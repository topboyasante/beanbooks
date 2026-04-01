---
id: "configuration-and-secrets"
moduleId: "spring-boot"
title: "Configuration & Secrets Management"
description: "Manage application configuration securely with environment variables, profiles, and secrets management tools."
order: 6
---

## Banking Scenario

In 2019, a major bank accidentally committed AWS credentials to a public GitHub repository. Automated scanners found them within minutes, and attackers used them to access customer data. The breach cost the bank $80 million in fines. This isn't hypothetical — it happens regularly. As a backend engineer at a bank, managing configuration and secrets correctly is not optional. Your database passwords, API keys, encryption keys, and JWT signing secrets must NEVER appear in source code, Docker images, or log files. This lesson teaches you how to do it right.

## Content

### Why Configuration Matters

The most dangerous line of code you can write at a bank looks like this: `String password = "Pr0d_P@ssw0rd!"`. Hardcoded values make your application inflexible and insecure. If that password changes, you have to rebuild and redeploy your entire app. If someone clones your repo, they now have production credentials.

Different environments need different configuration. In development, you use an H2 in-memory database on localhost. In staging, you connect to a test database with mock payment services. In production, you connect to a real PostgreSQL cluster with real payment gateways. The code is the same across all three — only the configuration changes.

This is a core principle from the 12-Factor App methodology: **store config in the environment**. Configuration is everything that varies between deploys. Code doesn't change between deploys — config does. Keep them separate.

### Environment Variables

Environment variables are OS-level key-value pairs available to any running process. They live outside your codebase entirely.

Setting them is straightforward. On Linux or Mac: `export DB_PASSWORD=secret`. On Windows: `set DB_PASSWORD=secret`. In Java, you read them with `System.getenv("DB_PASSWORD")`.

Spring Boot makes this even easier with **relaxed binding**. An environment variable named `SPRING_DATASOURCE_URL` automatically maps to the property `spring.datasource.url`. The rule is simple: replace dots with underscores and uppercase everything. So `DB_PASSWORD` maps to `db.password`, and `JWT_SECRET_KEY` maps to `jwt.secret.key`.

The key benefit: environment variables are not in your source code, not baked into Docker images, and are set by whatever deployment platform you use (Kubernetes, AWS ECS, Heroku, etc.).

### Spring's Configuration Hierarchy

Spring Boot loads configuration from many sources, and they follow a strict priority order. The highest priority wins:

1. **Command-line arguments** — `--server.port=9090` overrides everything
2. **Environment variables** — `SERVER_PORT=9090`
3. **application-{profile}.yml** — profile-specific config like `application-prod.yml`
4. **application.yml** — your base defaults

You inject config values into your beans with `@Value("${db.password}")`. You can also set default values: `@Value("${cache.ttl:3600}")` uses 3600 if the property is not set anywhere.

For more structured configuration, use `@ConfigurationProperties`. This gives you type-safe config binding to a POJO:

```java
@ConfigurationProperties(prefix = "db")
@Validated
public class DatabaseConfig {
    @NotBlank private String url;
    @NotBlank private String username;
    @NotBlank private String password;
    // getters and setters
}
```

Spring automatically maps `db.url`, `db.username`, and `db.password` to this class. The `@Validated` annotation enforces constraints — your app won't start if required config is missing.

### .env Files for Local Development

You need environment variables locally, but running `export DB_PASSWORD=secret` every time you open a terminal is tedious. A `.env` file solves this — it's a simple key-value file loaded at startup:

```
DB_URL=jdbc:h2:mem:devdb
DB_USERNAME=sa
DB_PASSWORD=devpassword
JWT_SECRET=dev-jwt-secret-key
```

**CRITICAL: your `.env` file must be in `.gitignore`. NEVER commit it.** Instead, commit a `.env.example` file that shows required variables without actual values:

```
DB_URL=
DB_USERNAME=
DB_PASSWORD=
JWT_SECRET=
```

New developers clone the repo, copy `.env.example` to `.env`, and fill in their local values. You can use the `spring-dotenv` library or configure environment variables directly in your IDE's run configuration.

### Secrets Management in Production

Environment variables are better than hardcoding, but they still have risks. They're visible in process listings (`ps aux`), container inspection (`docker inspect`), and memory dumps.

Production-grade solutions include:

- **HashiCorp Vault** — a dedicated secrets server. Your app authenticates to Vault at startup and retrieves secrets. Vault can rotate credentials automatically.
- **AWS Secrets Manager / Azure Key Vault / GCP Secret Manager** — cloud-native secrets services integrated with their platforms.
- **Kubernetes Secrets** — mounted as environment variables or files in your pod, encrypted at rest.
- **Spring Cloud Config Server** — centralized config for multiple microservices, supports encrypted values, backed by Git.

The pattern in production looks like this: your `application.yml` references environment variables (`${DB_PASSWORD}`). The orchestrator (Kubernetes, ECS) injects those env vars from a secrets store (Vault, AWS Secrets Manager). Your application code never sees raw secrets — it just reads properties like normal.

### What Gets You Fired at a Bank

**Committing credentials to Git** — even in a private repo. Git history is forever. Someone can find that password in a commit from three years ago.

```java
// WRONG - hardcoded credentials
String password = "SuperSecret123!";

// RIGHT - read from environment
String password = System.getenv("DB_PASSWORD");
```

**Logging sensitive values** — `log.info("Connecting with password: " + password)` sends your credentials to Splunk, ELK, or CloudWatch where dozens of people can see them.

```java
// WRONG - logging secrets
log.info("DB password: " + dbPassword);

// RIGHT - mask sensitive values
log.info("DB connection configured [password=MASKED]");
```

**Hardcoding in Dockerfiles** — `ENV DB_PASSWORD=secret` bakes it into the image layer permanently.

**Sharing credentials via Slack or email** — use a secrets manager. Always.

**Not rotating credentials** — if a key is compromised, rotation limits the blast radius. **Using the same credentials across environments** — your dev password should NEVER work in production.

### Credential Rotation

Credentials must be rotated periodically (every 90 days is common at banks) and on-demand after security incidents or employee departures.

Spring Cloud Vault integration supports automatic secret rotation without restarting your application. Vault can even create **dynamic secrets** — temporary database users with short lifespans. When the lease expires, Vault deletes the user. If credentials leak, they're already expired.

## Why It Matters

Security is the number one priority at every bank. A single leaked credential can expose millions of customer records, trigger regulatory investigations, and cost the bank hundreds of millions in fines. As a backend engineer, you're expected to handle secrets correctly from day one. Interviewers at banks will ask about this — "How do you manage database credentials in production?" If your answer involves hardcoding or committing to Git, the interview is over.

## Challenge

Simulate reading configuration from different sources with a priority hierarchy. Show how environment variables override properties file values, and demonstrate how secrets are masked in logs.

## Starter Code
```java
import java.util.HashMap;
import java.util.Map;

public class ConfigurationManager {

    // Simulated application.yml defaults
    private Map<String, String> fileConfig = new HashMap<>();

    // Simulated environment variable overrides
    private Map<String, String> envConfig = new HashMap<>();

    // The final resolved configuration
    private Map<String, String> resolvedConfig = new HashMap<>();

    // List of keys that contain sensitive data
    private String[] sensitiveKeys = {"db.password", "jwt.secret"};

    public ConfigurationManager() {
        // TODO: Load file-based defaults (like application.yml)
        // db.url -> jdbc:h2:mem:devdb
        // db.username -> sa
        // db.password -> devpassword
        // jwt.secret -> dev-secret

        // TODO: Load environment overrides (simulated)
        // db.url -> jdbc:postgresql://prod-db:5432/javabank
        // db.username -> javabank_app
        // db.password -> xK9#mP2$vL5nQ8
        // jwt.secret -> prod-jwt-RS256-key-2024

        // TODO: Resolve config — env vars override file config
    }

    public String getProperty(String key) {
        // TODO: Return resolved value
        return null;
    }

    public String getMaskedProperty(String key) {
        // TODO: Return [MASKED] for sensitive keys, actual value otherwise
        return null;
    }

    private boolean isSensitive(String key) {
        // TODO: Check if the key is in the sensitiveKeys array
        return false;
    }

    public void printConfigReport() {
        // TODO: Print the full configuration report matching expected output
    }

    public static void main(String[] args) {
        ConfigurationManager config = new ConfigurationManager();
        config.printConfigReport();
    }
}
```

## Expected Output
```
=== Configuration Sources ===
application.yml: db.url = jdbc:h2:mem:devdb
application.yml: db.password = ****

Environment Override: db.url = jdbc:postgresql://prod-db:5432/javabank
Environment Override: db.password = ****

Final Resolved Config:
  db.url = jdbc:postgresql://prod-db:5432/javabank
  db.username = javabank_app
  db.password = [MASKED]
  jwt.secret = [MASKED]

Security Check:
  Credentials in source code: NO
  .env in .gitignore: YES
  Secrets masked in logs: YES
  Status: COMPLIANT
```

## Hint

Start by populating the `fileConfig` and `envConfig` maps in the constructor. For resolution, iterate through all keys in `fileConfig`, then check if `envConfig` has an override. The `isSensitive` method should loop through the `sensitiveKeys` array. For `getMaskedProperty`, call `isSensitive` and return `[MASKED]` if true. Build the report section by section using `System.out.println`.

## Solution
```java
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

public class ConfigurationManager {

    private Map<String, String> fileConfig = new LinkedHashMap<>();
    private Map<String, String> envConfig = new LinkedHashMap<>();
    private Map<String, String> resolvedConfig = new LinkedHashMap<>();
    private String[] sensitiveKeys = {"db.password", "jwt.secret"};

    public ConfigurationManager() {
        // Load file-based defaults (simulating application.yml)
        fileConfig.put("db.url", "jdbc:h2:mem:devdb");
        fileConfig.put("db.username", "sa");
        fileConfig.put("db.password", "devpassword");
        fileConfig.put("jwt.secret", "dev-secret");

        // Load environment overrides (simulating production env vars)
        envConfig.put("db.url", "jdbc:postgresql://prod-db:5432/javabank");
        envConfig.put("db.username", "javabank_app");
        envConfig.put("db.password", "xK9#mP2$vL5nQ8");
        envConfig.put("jwt.secret", "prod-jwt-RS256-key-2024");

        // Resolve config — env vars override file config
        for (String key : fileConfig.keySet()) {
            resolvedConfig.put(key, fileConfig.get(key));
        }
        for (String key : envConfig.keySet()) {
            resolvedConfig.put(key, envConfig.get(key));
        }
    }

    public String getProperty(String key) {
        return resolvedConfig.get(key);
    }

    public String getMaskedProperty(String key) {
        if (isSensitive(key)) {
            return "[MASKED]";
        }
        return resolvedConfig.get(key);
    }

    private boolean isSensitive(String key) {
        for (String sensitiveKey : sensitiveKeys) {
            if (sensitiveKey.equals(key)) {
                return true;
            }
        }
        return false;
    }

    public void printConfigReport() {
        System.out.println("=== Configuration Sources ===");
        System.out.println("application.yml: db.url = " + fileConfig.get("db.url"));
        System.out.println("application.yml: db.password = ****");
        System.out.println();
        System.out.println("Environment Override: db.url = " + envConfig.get("db.url"));
        System.out.println("Environment Override: db.password = ****");
        System.out.println();
        System.out.println("Final Resolved Config:");
        for (String key : resolvedConfig.keySet()) {
            System.out.println("  " + key + " = " + getMaskedProperty(key));
        }
        System.out.println();
        System.out.println("Security Check:");
        System.out.println("  Credentials in source code: NO");
        System.out.println("  .env in .gitignore: YES");
        System.out.println("  Secrets masked in logs: YES");
        System.out.println("  Status: COMPLIANT");
    }

    public static void main(String[] args) {
        ConfigurationManager config = new ConfigurationManager();
        config.printConfigReport();
    }
}
```
