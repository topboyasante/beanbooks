---
id: "database-integration"
moduleId: "spring-boot"
title: "Database Integration"
description: "Connect to databases with HikariCP, manage schemas with Flyway, and configure for different environments."
order: 3
---

## Banking Scenario

JavaBank's account data must persist across application restarts, handle thousands of concurrent queries, and evolve its schema as new features are added. You cannot simply run `ALTER TABLE` on a production database and hope it works. You need connection pooling for performance, schema migration tools for safe evolution, and environment-specific configuration for development versus production.

This lesson covers the database infrastructure that every banking application depends on: connection pools that manage database connections efficiently, Flyway for versioned schema migrations, and configuration strategies that let you use H2 for development and PostgreSQL for production without changing your code.

## Content

### HikariCP Connection Pool

Opening a database connection is expensive: TCP handshake, authentication, session initialization. In a banking application handling hundreds of requests per second, creating a new connection for every query would cripple performance. Connection pooling solves this by maintaining a pool of pre-established connections that are borrowed and returned.

HikariCP is Spring Boot's default connection pool, chosen for its speed and reliability. When your application starts, HikariCP opens a configurable number of connections (minimum idle) and keeps them ready. When a service needs a database connection, it borrows one from the pool. When the service is done, the connection returns to the pool for reuse. If all connections are busy, new requests wait (up to a configurable timeout).

Key configuration properties include `maximumPoolSize` (maximum connections, typically 10-50), `minimumIdle` (connections to keep ready), `connectionTimeout` (how long to wait for a connection), and `idleTimeout` (how long idle connections live). In banking, oversizing the pool wastes database resources, while undersizing causes request timeouts.

```java
// application.yml HikariCP configuration
// spring:
//   datasource:
//     url: jdbc:postgresql://localhost:5432/javabank
//     username: ${DB_USERNAME}
//     password: ${DB_PASSWORD}
//     hikari:
//       maximum-pool-size: 20
//       minimum-idle: 5
//       connection-timeout: 30000    # 30 seconds
//       idle-timeout: 600000         # 10 minutes
//       max-lifetime: 1800000        # 30 minutes
//       pool-name: JavaBankPool

// How pooling works:
// Request 1 -> borrow connection -> query -> return connection
// Request 2 -> borrow connection -> query -> return connection
// Request 3 -> pool empty -> wait for available connection
// Without pooling: each request creates and destroys a connection
// With pooling: connections are reused, massive performance gain
```

### H2 for Development

H2 is an in-memory Java database perfect for development and testing. It starts instantly, requires no installation, and disappears when the application stops. Spring Boot auto-configures H2 when it detects the dependency and no other datasource is configured.

H2 provides a web console for inspecting data during development. Enable it with `spring.h2.console.enabled=true` and access it at `/h2-console`. You can run SQL queries, view table structures, and verify that your JPA entities map correctly to tables.

For banking development, H2 lets you iterate quickly. You can drop and recreate the entire database on every restart, preload test data with `data.sql`, and verify your queries without a PostgreSQL installation. However, some PostgreSQL-specific features (like advanced JSON operations or array types) may not work in H2, so integration tests should also run against PostgreSQL.

```java
// application-dev.yml
// spring:
//   datasource:
//     url: jdbc:h2:mem:javabankdb
//     driver-class-name: org.h2.Driver
//     username: sa
//     password:
//   h2:
//     console:
//       enabled: true
//       path: /h2-console
//   jpa:
//     hibernate:
//       ddl-auto: create-drop
//     show-sql: true

// H2 creates tables from @Entity annotations
// Data lives only in memory - fresh database every restart
// Perfect for rapid development and unit tests
```

### PostgreSQL for Production

Production banking systems use PostgreSQL for its reliability, ACID compliance, advanced features, and strong ecosystem. PostgreSQL handles concurrent transactions safely, supports complex queries, and provides robust backup and replication options. It is the most popular database choice for financial applications.

The transition from H2 to PostgreSQL is seamless with Spring Data JPA. Your entity classes, repositories, and service code remain unchanged. Only the datasource configuration changes. This is the power of database abstraction: the same application code runs against different databases in different environments.

Production database configuration includes SSL connections, read replicas for query scaling, connection pool tuning for expected load, and monitoring of connection usage and query performance.

```java
// application-prod.yml
// spring:
//   datasource:
//     url: jdbc:postgresql://prod-db.javabank.com:5432/javabank
//     username: ${DB_USERNAME}
//     password: ${DB_PASSWORD}
//     hikari:
//       maximum-pool-size: 50
//       minimum-idle: 10
//   jpa:
//     hibernate:
//       ddl-auto: validate   # NEVER use create/update in production
//     show-sql: false
//     properties:
//       hibernate:
//         dialect: org.hibernate.dialect.PostgreSQLDialect

// IMPORTANT: ddl-auto settings
// create-drop : H2 dev (recreate every start)
// update      : careful with staging
// validate    : production (only verify schema, never modify)
// none        : production (skip validation too)
```

### Flyway Schema Migration

Flyway manages database schema changes through versioned SQL scripts. Instead of manually running `ALTER TABLE` on each database, you write migration scripts that Flyway executes automatically on application startup. Each migration runs exactly once and is tracked in a `flyway_schema_history` table.

Migration files follow the naming convention `V{version}__{description}.sql`. The version number determines execution order. Flyway runs pending migrations in order and records each in the history table. If a migration has already been applied, it is skipped. This ensures every environment (development, staging, production) has the exact same schema.

For banking, Flyway provides an audit trail of every schema change. You can see when each table was created or modified, who authored the migration, and roll forward to any version. Never modify an already-applied migration -- always create a new one. This immutability ensures consistency across environments.

```java
// Migration files in src/main/resources/db/migration/

// V1__create_accounts_table.sql
// CREATE TABLE accounts (
//     id BIGSERIAL PRIMARY KEY,
//     holder_name VARCHAR(100) NOT NULL,
//     balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
//     account_type VARCHAR(20) NOT NULL,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

// V2__create_transactions_table.sql
// CREATE TABLE transactions (
//     id BIGSERIAL PRIMARY KEY,
//     account_id BIGINT NOT NULL REFERENCES accounts(id),
//     amount DECIMAL(15, 2) NOT NULL,
//     type VARCHAR(20) NOT NULL,
//     description VARCHAR(255),
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );
// CREATE INDEX idx_transactions_account ON transactions(account_id);

// V3__add_audit_table.sql
// CREATE TABLE audit_log (
//     id BIGSERIAL PRIMARY KEY,
//     entity_type VARCHAR(50) NOT NULL,
//     entity_id BIGINT NOT NULL,
//     action VARCHAR(20) NOT NULL,
//     performed_by VARCHAR(100),
//     performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );
```

### Banking Database Schema Design

A banking database schema typically includes accounts (customer financial accounts), transactions (every debit and credit), customers (personal information), and audit logs (who did what and when). The schema design must enforce referential integrity, support efficient queries, and maintain a complete audit trail.

Key design principles for banking schemas: use `DECIMAL` for monetary values (never floating point), add indexes on frequently queried columns, use foreign keys to maintain referential integrity, and create audit tables that record every data change. Soft deletes (marking records as inactive rather than deleting) are common because banking regulations require data retention.

The accounts-transactions relationship is one-to-many: one account has many transactions. Every financial operation creates a transaction record. Balances can be derived from transaction history (sum of all transactions) or maintained as a denormalized field on the account (updated with each transaction, verified periodically).

```java
// Banking schema relationships:
// customers (1) --> (N) accounts (1) --> (N) transactions
//                                              |
//                                              v
//                                         audit_log

// Schema design principles:
// 1. DECIMAL(15,2) for money - never FLOAT or DOUBLE
// 2. Foreign keys for referential integrity
// 3. Indexes on account_id, created_at for query performance
// 4. Audit table for compliance
// 5. Soft delete (is_active flag) instead of hard delete
// 6. Timestamps on every table (created_at, updated_at)

class DatabaseSchema {
    static void printMigrationStatus(String[] migrations, boolean[] applied) {
        for (int i = 0; i < migrations.length; i++) {
            String status = applied[i] ? "SUCCESS" : "PENDING";
            System.out.println("Migration V" + (i + 1) + ": " + migrations[i] + " - " + status);
        }
    }
}
```

### @Transactional Deep Dive

The `@Transactional` annotation in Spring manages database transaction boundaries. When a transactional method starts, Spring begins a database transaction. If the method completes normally, it commits. If a runtime exception is thrown, it rolls back. This automatic management prevents the data inconsistencies that plague banking applications.

Propagation controls how transactions interact. `REQUIRED` (default) joins an existing transaction or creates a new one. `REQUIRES_NEW` always creates a new transaction, suspending any existing one. `MANDATORY` requires an existing transaction and throws an error if none exists. In banking, `REQUIRED` is used for most operations, while `REQUIRES_NEW` is used for audit logging (you want the audit log even if the main transaction fails).

Isolation levels control how concurrent transactions interact. `READ_COMMITTED` (default for PostgreSQL) prevents dirty reads. `REPEATABLE_READ` prevents non-repeatable reads. `SERIALIZABLE` prevents phantom reads but has the highest performance cost. For banking transfers, at minimum `READ_COMMITTED` is required to prevent reading uncommitted balance changes.

```java
@Service
class TransferService {

    @Transactional(propagation = Propagation.REQUIRED,
                   isolation = Isolation.READ_COMMITTED,
                   rollbackFor = Exception.class)
    void transfer(Long fromId, Long toId, double amount) {
        // All operations in one transaction
        Account from = accountRepo.findById(fromId).orElseThrow();
        Account to = accountRepo.findById(toId).orElseThrow();

        from.debit(amount);
        to.credit(amount);

        accountRepo.save(from);
        accountRepo.save(to);
        // Commits only if both saves succeed
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void auditLog(String action, Long accountId) {
        // Separate transaction: logs even if main transaction fails
        auditRepo.save(new AuditEntry(action, accountId));
    }
}
```

## Why It Matters

Every banking application is ultimately a database application. Understanding connection pooling, schema migration, and transaction management is essential for building reliable financial systems. HikariCP keeps your application performant under load, Flyway ensures your schema evolves safely, and `@Transactional` keeps your data consistent. These are infrastructure skills that separate professional backend developers from beginners.

## Challenge

Simulate Flyway migrations for creating accounts and transactions tables. Print the migration status showing that both migrations were applied successfully.

## Starter Code
```java
public class Main {
    public static void main(String[] args) {
        // TODO: Create a FlywayMigration class that tracks migration history
        // TODO: Define two migrations:
        //   V1: Create accounts table
        //   V2: Create transactions table
        // TODO: Run the migrations and print their status
        // TODO: Print final database ready message
    }
}
```

## Expected Output
```
Migration V1: Create accounts table - SUCCESS
Migration V2: Create transactions table - SUCCESS
Database ready: 2 migrations applied
```

## Hint

Create a `FlywayMigration` class with a list of migration names and a method to "apply" each migration. Keep a counter of applied migrations. Iterate through the migrations, print each one with "SUCCESS", and at the end print the total count. This simulates what Flyway does at application startup.

## Solution
```java
import java.util.ArrayList;
import java.util.List;

class FlywayMigration {
    private List<String> appliedMigrations = new ArrayList<>();

    void apply(int version, String description) {
        appliedMigrations.add("V" + version + ": " + description);
        System.out.println("Migration V" + version + ": " + description + " - SUCCESS");
    }

    int getAppliedCount() {
        return appliedMigrations.size();
    }
}

public class Main {
    public static void main(String[] args) {
        FlywayMigration flyway = new FlywayMigration();

        flyway.apply(1, "Create accounts table");
        flyway.apply(2, "Create transactions table");

        System.out.println("Database ready: " + flyway.getAppliedCount() + " migrations applied");
    }
}
```
