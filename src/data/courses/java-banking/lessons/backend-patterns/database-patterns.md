---
id: "database-patterns"
moduleId: "backend-patterns"
title: "Database Patterns"
description: "Master ACID transactions, locking strategies, and connection pooling for reliable data access."
order: 2
---

## Banking Scenario

When two ATMs process withdrawals from the same account simultaneously, only proper database patterns prevent double-spending. Banks rely on ACID guarantees, strategic locking, and connection pooling to handle thousands of concurrent database operations without data corruption.

Consider a joint account with a $1,000 balance. Two cardholders each try to withdraw $800 at the same moment from different ATMs. Without proper isolation and locking, both ATMs could read the $1,000 balance, approve the withdrawal, and drain the account to negative $600. Database patterns exist specifically to prevent these scenarios.

## Content

### ACID Deep Dive

Every banking transaction depends on four guarantees, known as ACID:

**Atomicity** means all operations in a transaction succeed or none do. A transfer that debits Account A but fails to credit Account B must roll back entirely. There is no partial state.

**Consistency** means the database moves from one valid state to another. Constraints like "balance >= 0" are enforced. A transaction that would violate a constraint is rejected.

**Isolation** means concurrent transactions do not interfere with each other. Two simultaneous withdrawals behave as if they executed one after the other.

**Durability** means once a transaction is committed, it survives crashes. The data is written to disk, not just held in memory.

```java
// Conceptual ACID transfer
// Atomicity: both updates or neither
// Consistency: balance constraint checked
// Isolation: other transactions see before or after, not during
// Durability: committed data survives server restart
```

### Isolation Levels

Not all isolation is equal. Higher isolation costs more performance:

- **READ_UNCOMMITTED**: Can read uncommitted data from other transactions (dirty reads). Never used in banking.
- **READ_COMMITTED**: Only reads committed data. Default in PostgreSQL. Prevents dirty reads but allows non-repeatable reads.
- **REPEATABLE_READ**: Guarantees re-reading the same row returns the same value. Default in MySQL InnoDB. Prevents phantom reads in some implementations.
- **SERIALIZABLE**: Transactions behave as if executed one at a time. Safest but slowest. Banks use this for critical operations like end-of-day reconciliation.

```java
// In Spring, set isolation on a transaction
// @Transactional(isolation = Isolation.SERIALIZABLE)
// public void processEndOfDaySettlement() { ... }
```

Most banking applications use READ_COMMITTED for general operations and escalate to SERIALIZABLE for critical financial calculations.

### Optimistic Locking

Optimistic locking assumes conflicts are rare. Each row has a version column. When updating, the application checks that the version has not changed since it was read:

```java
// Entity has a version field:
// @Version private Long version;

// UPDATE accounts SET balance = 900, version = 2
// WHERE id = 1 AND version = 1;
// If version changed, 0 rows updated -> throw OptimisticLockException
```

Use optimistic locking for low-contention scenarios: reading account details, updating customer profiles, or modifying non-financial metadata. It avoids holding database locks during processing.

### Pessimistic Locking

Pessimistic locking assumes conflicts will happen. It locks the row when reading, blocking other transactions from modifying it:

```sql
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
-- Row is now locked until this transaction commits or rolls back
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
COMMIT;
```

Use pessimistic locking for high-contention writes: balance updates, withdrawals, and transfers. The tradeoff is reduced concurrency, but you guarantee correctness.

### Connection Pooling

Creating a database connection is expensive: TCP handshake, authentication, memory allocation. A connection pool maintains a set of reusable connections.

**HikariCP** is the standard pool for Java applications:

```java
// HikariCP configuration (application.properties)
// spring.datasource.hikari.maximum-pool-size=10
// spring.datasource.hikari.minimum-idle=5
// spring.datasource.hikari.connection-timeout=30000
// spring.datasource.hikari.idle-timeout=600000
```

Key settings: `maximumPoolSize` limits total connections (too high overloads the DB, too low causes thread starvation). `connectionTimeout` is how long a thread waits for a connection before throwing an exception. Monitor pool metrics to detect exhaustion before it causes outages.

### Indexing Strategies

Beyond basic indexes, banking databases require strategic indexing:

- **Primary keys** automatically get a unique index.
- **Foreign keys** should always be indexed to speed up JOINs.
- **Composite indexes** cover queries that filter on multiple columns. Column order matters: `(customer_id, transaction_date)` helps queries filtering by customer, but not queries filtering only by date.
- **Covering indexes** include all columns a query needs, so the database never reads the actual table row.

```sql
-- Covering index for a common query
CREATE INDEX idx_txn_covering ON transactions(account_id, type, amount);
-- Query can be answered entirely from the index:
-- SELECT type, amount FROM transactions WHERE account_id = 42;
```

Index selectivity measures how unique the values are. High selectivity (like account_id) makes great indexes. Low selectivity (like account_type with only 3 values) makes poor indexes.

## Why It Matters

Banking systems handle real money, and database patterns are the last line of defense against data corruption. Understanding ACID guarantees tells you what the database promises. Knowing when to use optimistic versus pessimistic locking determines whether your system is both correct and performant. Connection pooling ensures your application can handle production load without exhausting resources. These patterns appear in every banking backend interview and every production system you will work on.

## Challenge

Simulate optimistic and pessimistic locking behavior in Java. Show what happens when two threads try to update the same account balance using each strategy.

## Starter Code

```java
public class DatabasePatterns {
    static long balance = 1000;
    static int version = 1;

    public static void main(String[] args) {
        System.out.println("=== Optimistic Locking Simulation ===");
        System.out.println("Initial balance: $" + balance + ", version: " + version);
        // TODO: Simulate two "transactions" reading the same version
        // Transaction A reads version 1, updates balance to 800, sets version to 2
        // Transaction B reads version 1, tries to update but version is now 2 -> CONFLICT

        System.out.println("\n=== Pessimistic Locking Simulation ===");
        balance = 1000;
        System.out.println("Initial balance: $" + balance);
        // TODO: Simulate sequential access
        // Transaction A locks the row, withdraws 200, commits
        // Transaction B waits, then reads updated balance, withdraws 300, commits
    }
}
```

## Expected Output

```
=== Optimistic Locking Simulation ===
Initial balance: $1000, version: 1
Transaction A: Read balance=$1000, version=1
Transaction B: Read balance=$1000, version=1
Transaction A: UPDATE SET balance=800, version=2 WHERE version=1 -> SUCCESS
Transaction B: UPDATE SET balance=700, version=2 WHERE version=1 -> CONFLICT (version mismatch)
Transaction B: Retrying with fresh data...
Transaction B: Read balance=$800, version=2
Transaction B: UPDATE SET balance=500, version=3 WHERE version=2 -> SUCCESS
Final balance: $500, version: 3

=== Pessimistic Locking Simulation ===
Initial balance: $1000
Transaction A: SELECT balance FOR UPDATE -> locked row
Transaction A: Withdraw $200, new balance=$800
Transaction A: COMMIT -> released lock
Transaction B: SELECT balance FOR UPDATE -> locked row
Transaction B: Withdraw $300, new balance=$500
Transaction B: COMMIT -> released lock
Final balance: $500
```

## Hint

You do not need real threads or a database for this simulation. Use simple variables and sequential method calls. For optimistic locking, check the version before updating. For pessimistic locking, simulate a lock-then-update-then-release sequence.

## Solution

```java
public class DatabasePatterns {
    static long balance = 1000;
    static int version = 1;

    public static void main(String[] args) {
        System.out.println("=== Optimistic Locking Simulation ===");
        System.out.println("Initial balance: $" + balance + ", version: " + version);

        // Both transactions read the same state
        long readA = balance;
        int versionA = version;
        long readB = balance;
        int versionB = version;
        System.out.println("Transaction A: Read balance=$" + readA + ", version=" + versionA);
        System.out.println("Transaction B: Read balance=$" + readB + ", version=" + versionB);

        // Transaction A updates successfully
        if (version == versionA) {
            balance = readA - 200;
            version = versionA + 1;
            System.out.println("Transaction A: UPDATE SET balance=" + balance + ", version=" + version + " WHERE version=" + versionA + " -> SUCCESS");
        }

        // Transaction B tries to update but version has changed
        if (version == versionB) {
            System.out.println("Transaction B: UPDATE -> SUCCESS");
        } else {
            System.out.println("Transaction B: UPDATE SET balance=700, version=2 WHERE version=" + versionB + " -> CONFLICT (version mismatch)");
            System.out.println("Transaction B: Retrying with fresh data...");
            // Retry with fresh data
            readB = balance;
            versionB = version;
            System.out.println("Transaction B: Read balance=$" + readB + ", version=" + versionB);
            if (version == versionB) {
                balance = readB - 300;
                version = versionB + 1;
                System.out.println("Transaction B: UPDATE SET balance=" + balance + ", version=" + version + " WHERE version=" + versionB + " -> SUCCESS");
            }
        }

        System.out.println("Final balance: $" + balance + ", version: " + version);

        // Pessimistic Locking
        System.out.println("\n=== Pessimistic Locking Simulation ===");
        balance = 1000;
        System.out.println("Initial balance: $" + balance);

        // Transaction A acquires lock
        System.out.println("Transaction A: SELECT balance FOR UPDATE -> locked row");
        balance -= 200;
        System.out.println("Transaction A: Withdraw $200, new balance=$" + balance);
        System.out.println("Transaction A: COMMIT -> released lock");

        // Transaction B acquires lock after A releases
        System.out.println("Transaction B: SELECT balance FOR UPDATE -> locked row");
        balance -= 300;
        System.out.println("Transaction B: Withdraw $300, new balance=$" + balance);
        System.out.println("Transaction B: COMMIT -> released lock");

        System.out.println("Final balance: $" + balance);
    }
}
```
