---
id: "sql-fundamentals"
moduleId: "backend-patterns"
title: "SQL for Backend Engineers"
description: "Write queries to retrieve, filter, join, and aggregate banking data."
order: 1
---

## Banking Scenario

Every banking application talks to a relational database. Whether you are looking up account balances, generating transaction reports, or auditing transfers, you are writing SQL. As a backend engineer on a banking team, you will write repository methods that translate to SQL under the hood, debug slow queries that bring dashboards to a crawl, and optimize indexes so that millions of rows can be searched in milliseconds.

Understanding SQL deeply is not optional. Even with ORMs like Hibernate generating queries for you, the moment something goes wrong in production, you will be reading raw SQL in logs, analyzing query plans, and deciding where to add an index.

## Content

### SELECT, WHERE, and ORDER BY

The foundation of every query is retrieving rows from a table and filtering them. In a banking schema, an `accounts` table typically has columns like `id`, `customer_id`, `account_type`, `balance`, and `created_at`.

```sql
SELECT id, account_type, balance
FROM accounts
WHERE balance > 10000
ORDER BY balance DESC;
```

`WHERE` filters rows before they are returned. `ORDER BY` sorts the result set. Adding `LIMIT` controls how many rows come back, which is critical when tables have millions of records.

### JOINs: Connecting Related Data

Banks store data across normalized tables. To get useful information, you combine them with JOINs.

**INNER JOIN** returns only matching rows from both tables:

```sql
SELECT a.id, a.balance, t.amount, t.transaction_date
FROM accounts a
INNER JOIN transactions t ON a.id = t.account_id
WHERE t.transaction_date > '2026-01-01';
```

**LEFT JOIN** returns all rows from the left table, even if there is no match. This is useful for finding customers who may not have accounts yet:

```sql
SELECT c.name, a.id AS account_id
FROM customers c
LEFT JOIN accounts a ON c.id = a.customer_id
WHERE a.id IS NULL;
```

### GROUP BY and Aggregate Functions

Aggregates collapse multiple rows into summary values. Banks use them constantly for reporting.

```sql
SELECT account_id, SUM(amount) AS total_deposits, COUNT(*) AS num_transactions
FROM transactions
WHERE type = 'DEPOSIT'
GROUP BY account_id
HAVING SUM(amount) > 5000;
```

Common aggregates: `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`. The `HAVING` clause filters groups after aggregation, unlike `WHERE` which filters individual rows before grouping.

### Subqueries

A subquery is a query nested inside another. Find accounts with a balance above the average:

```sql
SELECT id, balance
FROM accounts
WHERE balance > (SELECT AVG(balance) FROM accounts);
```

Subqueries can appear in `WHERE`, `FROM`, or `SELECT` clauses. For complex analytics, Common Table Expressions (CTEs) using `WITH` are often cleaner.

### Indexes and Performance

An index is a data structure (typically a B-tree) that lets the database find rows without scanning the entire table. Think of it like a book index versus reading every page.

```sql
CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_txn_account_date ON transactions(account_id, transaction_date);
```

The second example is a **composite index**, which is efficient when queries filter on both columns. Index order matters: the leftmost column must appear in your `WHERE` clause for the index to be used.

### EXPLAIN: Reading Query Plans

Use `EXPLAIN` to see how the database executes your query. Look for full table scans (`Seq Scan` in PostgreSQL, `ALL` in MySQL) on large tables, which indicate a missing index.

```sql
EXPLAIN SELECT * FROM transactions WHERE account_id = 42;
```

A good plan shows `Index Scan` or `Index Only Scan`. A bad plan shows `Seq Scan` on a table with millions of rows.

### SQL Transactions

When transferring money between accounts, both the debit and credit must succeed or both must fail. SQL transactions guarantee this:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;
COMMIT;
```

If anything fails, you issue `ROLLBACK` to undo all changes. This atomicity is the "A" in ACID and is fundamental to banking systems.

## Why It Matters

SQL is the universal language of data in banking. Every backend service, every report, every audit trail ultimately runs SQL against a database. A backend engineer who understands joins, aggregation, indexing, and transactions can build systems that are correct, fast, and reliable. In interviews for banking roles, SQL questions are almost guaranteed, and in production, your SQL skills directly impact system performance and data integrity.

## Challenge

Write a Java program that simulates SQL query results for a banking database. Print the results of three queries: finding high-value accounts, joining accounts with their transactions, and computing total balance per customer.

## Starter Code

```java
public class SqlFundamentals {
    public static void main(String[] args) {
        System.out.println("=== Query 1: High-Value Accounts (balance > 50000) ===");
        System.out.println("SQL: SELECT id, account_type, balance FROM accounts WHERE balance > 50000 ORDER BY balance DESC");
        // TODO: Print simulated results for accounts with balance > 50000

        System.out.println("\n=== Query 2: Accounts with Recent Transactions (INNER JOIN) ===");
        System.out.println("SQL: SELECT a.id, a.balance, t.amount, t.type FROM accounts a INNER JOIN transactions t ON a.id = t.account_id");
        // TODO: Print simulated join results

        System.out.println("\n=== Query 3: Total Balance per Customer (GROUP BY) ===");
        System.out.println("SQL: SELECT customer_id, SUM(balance) AS total_balance FROM accounts GROUP BY customer_id");
        // TODO: Print simulated aggregation results
    }
}
```

## Expected Output

```
=== Query 1: High-Value Accounts (balance > 50000) ===
SQL: SELECT id, account_type, balance FROM accounts WHERE balance > 50000 ORDER BY balance DESC
| id  | account_type | balance    |
| 103 | SAVINGS      | 125000.00  |
| 101 | CHECKING     | 78500.00   |
| 107 | SAVINGS      | 62000.00   |

=== Query 2: Accounts with Recent Transactions (INNER JOIN) ===
SQL: SELECT a.id, a.balance, t.amount, t.type FROM accounts a INNER JOIN transactions t ON a.id = t.account_id
| account_id | balance   | amount   | type       |
| 101        | 78500.00  | 2500.00  | DEPOSIT    |
| 101        | 78500.00  | 1200.00  | WITHDRAWAL |
| 103        | 125000.00 | 5000.00  | DEPOSIT    |
| 107        | 62000.00  | 3000.00  | TRANSFER   |

=== Query 3: Total Balance per Customer (GROUP BY) ===
SQL: SELECT customer_id, SUM(balance) AS total_balance FROM accounts GROUP BY customer_id
| customer_id | total_balance |
| C001        | 203500.00     |
| C002        | 62000.00      |
| C003        | 45000.00      |
```

## Hint

Create arrays or use formatted `System.out.printf` statements to simulate table output. Use `String.format("| %-3s | %-12s | %-10s |", id, type, balance)` for aligned columns.

## Solution

```java
public class SqlFundamentals {
    public static void main(String[] args) {
        System.out.println("=== Query 1: High-Value Accounts (balance > 50000) ===");
        System.out.println("SQL: SELECT id, account_type, balance FROM accounts WHERE balance > 50000 ORDER BY balance DESC");
        System.out.printf("| %-3s | %-12s | %-10s |%n", "id", "account_type", "balance");
        System.out.printf("| %-3s | %-12s | %-10s |%n", "103", "SAVINGS", "125000.00");
        System.out.printf("| %-3s | %-12s | %-10s |%n", "101", "CHECKING", "78500.00");
        System.out.printf("| %-3s | %-12s | %-10s |%n", "107", "SAVINGS", "62000.00");

        System.out.println("\n=== Query 2: Accounts with Recent Transactions (INNER JOIN) ===");
        System.out.println("SQL: SELECT a.id, a.balance, t.amount, t.type FROM accounts a INNER JOIN transactions t ON a.id = t.account_id");
        System.out.printf("| %-10s | %-9s | %-8s | %-10s |%n", "account_id", "balance", "amount", "type");
        System.out.printf("| %-10s | %-9s | %-8s | %-10s |%n", "101", "78500.00", "2500.00", "DEPOSIT");
        System.out.printf("| %-10s | %-9s | %-8s | %-10s |%n", "101", "78500.00", "1200.00", "WITHDRAWAL");
        System.out.printf("| %-10s | %-9s | %-8s | %-10s |%n", "103", "125000.00", "5000.00", "DEPOSIT");
        System.out.printf("| %-10s | %-9s | %-8s | %-10s |%n", "107", "62000.00", "3000.00", "TRANSFER");

        System.out.println("\n=== Query 3: Total Balance per Customer (GROUP BY) ===");
        System.out.println("SQL: SELECT customer_id, SUM(balance) AS total_balance FROM accounts GROUP BY customer_id");
        System.out.printf("| %-11s | %-13s |%n", "customer_id", "total_balance");
        System.out.printf("| %-11s | %-13s |%n", "C001", "203500.00");
        System.out.printf("| %-11s | %-13s |%n", "C002", "62000.00");
        System.out.printf("| %-11s | %-13s |%n", "C003", "45000.00");
    }
}
```
