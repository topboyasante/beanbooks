---
id: "spring-data-jpa"
moduleId: "spring"
title: "Spring Data JPA"
description: "Map Java objects to database tables and use repositories for data access."
order: 6
---

## Banking Scenario

JavaBank stores all account data in a relational database. Every account, transaction, and customer record lives in database tables with rows and columns. But Java works with objects, not rows. Object-Relational Mapping (ORM) bridges this gap by mapping Java classes to database tables and Java fields to columns.

Spring Data JPA combines JPA (Java Persistence API) with Spring's repository abstraction to eliminate boilerplate database code. Instead of writing SQL queries and ResultSet parsing, you define an entity class and a repository interface. Spring generates the implementation automatically, letting you focus on business logic rather than data access plumbing.

## Content

### Object-Relational Mapping

ORM solves the impedance mismatch between object-oriented Java code and relational databases. In Java, data lives in objects with fields, methods, and relationships. In databases, data lives in tables with columns, rows, and foreign keys. Without ORM, you write JDBC code to manually convert between these two worlds: extracting values from ResultSets, constructing SQL strings, and managing connections.

JPA is the Java standard for ORM. It defines annotations that map classes to tables and fields to columns. Hibernate is the most popular JPA implementation. Spring Data JPA builds on top of JPA/Hibernate, adding the repository pattern that eliminates even more boilerplate.

The benefit is dramatic: what once required 50 lines of JDBC code (connection, statement, query, ResultSet, mapping, exception handling, cleanup) becomes a single method call on a repository. The ORM handles SQL generation, parameter binding, result mapping, and connection management.

```java
// Without ORM: manual JDBC (verbose and error-prone)
public Account findById(Long id) throws SQLException {
    Connection conn = dataSource.getConnection();
    PreparedStatement stmt = conn.prepareStatement(
        "SELECT id, holder_name, balance FROM accounts WHERE id = ?");
    stmt.setLong(1, id);
    ResultSet rs = stmt.executeQuery();
    if (rs.next()) {
        return new Account(rs.getLong("id"),
            rs.getString("holder_name"), rs.getDouble("balance"));
    }
    return null;
    // Plus: close rs, stmt, conn, handle exceptions...
}

// With Spring Data JPA: one line
Account account = accountRepository.findById(id).orElse(null);
```

### @Entity and Table Mapping

The `@Entity` annotation marks a Java class as a JPA entity, meaning it maps to a database table. By default, the table name matches the class name. Use `@Table(name = "accounts")` to specify a different table name. Each instance of the entity represents one row in the table.

The `@Id` annotation marks the primary key field. `@GeneratedValue` tells JPA to auto-generate the ID. The strategy `GenerationType.IDENTITY` uses the database's auto-increment feature, which is the most common choice for PostgreSQL and MySQL. Other strategies include `SEQUENCE` (database sequence) and `UUID`.

The `@Column` annotation maps a field to a specific column. It is optional when the field name matches the column name (using JPA's naming strategy). Use it to specify column names that differ from field names, set length constraints, or mark columns as not nullable.

```java
@Entity
@Table(name = "accounts")
class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "holder_name", nullable = false, length = 100)
    private String holderName;

    @Column(nullable = false)
    private double balance;

    @Column(name = "account_type", length = 20)
    private String accountType;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Default constructor required by JPA
    protected Account() {}

    public Account(String holderName, double balance) {
        this.holderName = holderName;
        this.balance = balance;
        this.createdAt = LocalDateTime.now();
    }

    // getters and setters
}
```

### JpaRepository Interface

Spring Data JPA's `JpaRepository` interface provides CRUD operations without writing any implementation. You define an interface extending `JpaRepository<EntityType, IdType>`, and Spring generates the implementation at runtime. This gives you `save()`, `findById()`, `findAll()`, `deleteById()`, `count()`, and more out of the box.

The repository pattern separates data access logic from business logic. Your service classes call repository methods without knowing whether the data comes from PostgreSQL, MySQL, or an in-memory database. This abstraction makes testing easy: you can mock the repository in unit tests.

Spring creates a proxy implementation of your interface at startup. When you call `findById(1L)`, the proxy generates and executes the SQL query, maps the result to your entity, and returns it wrapped in an `Optional`.

```java
// Just an interface - Spring provides the implementation
interface AccountRepository extends JpaRepository<Account, Long> {
    // Inherited methods:
    // save(Account) - insert or update
    // findById(Long) - find by primary key, returns Optional<Account>
    // findAll() - get all accounts
    // deleteById(Long) - delete by primary key
    // count() - count total records
    // existsById(Long) - check if exists
}

// Usage in a service
@Service
class AccountService {
    private final AccountRepository repository;

    AccountService(AccountRepository repository) {
        this.repository = repository;
    }

    Account createAccount(String holder, double balance) {
        Account account = new Account(holder, balance);
        return repository.save(account);  // INSERT INTO accounts ...
    }

    Account getAccount(Long id) {
        return repository.findById(id)     // SELECT * FROM accounts WHERE id = ?
            .orElseThrow(() -> new RuntimeException("Account not found"));
    }

    List<Account> getAllAccounts() {
        return repository.findAll();       // SELECT * FROM accounts
    }
}
```

### Derived Query Methods

Spring Data JPA can generate queries from method names. By following a naming convention, you declare what you want to find and Spring figures out the SQL. Method names start with `findBy`, `countBy`, `deleteBy`, or `existsBy`, followed by field names and operators.

For example, `findByHolderName(String name)` generates `SELECT * FROM accounts WHERE holder_name = ?`. You can chain conditions with `And` and `Or`, add ordering with `OrderBy`, and limit results with `Top` or `First`. This covers 80% of common queries without writing any SQL.

For banking, derived queries handle common lookups: find accounts by holder, find transactions by date range, count accounts by type. The method name is the query, making the code self-documenting.

```java
interface AccountRepository extends JpaRepository<Account, Long> {

    // SELECT * FROM accounts WHERE holder_name = ?
    List<Account> findByHolderName(String holderName);

    // SELECT * FROM accounts WHERE balance > ?
    List<Account> findByBalanceGreaterThan(double amount);

    // SELECT * FROM accounts WHERE account_type = ? AND balance > ?
    List<Account> findByAccountTypeAndBalanceGreaterThan(String type, double minBalance);

    // SELECT * FROM accounts WHERE holder_name LIKE ?
    List<Account> findByHolderNameContaining(String partial);

    // SELECT * FROM accounts ORDER BY balance DESC LIMIT 5
    List<Account> findTop5ByOrderByBalanceDesc();

    // SELECT COUNT(*) FROM accounts WHERE account_type = ?
    long countByAccountType(String type);

    // SELECT EXISTS(SELECT 1 FROM accounts WHERE holder_name = ?)
    boolean existsByHolderName(String holderName);
}
```

### @Query for Custom JPQL

When derived query methods become unwieldy, use `@Query` to write JPQL (Java Persistence Query Language) directly. JPQL looks like SQL but operates on entity classes and fields rather than tables and columns. This gives you full control over the query while still benefiting from JPA's parameter binding and type safety.

You can also write native SQL with `@Query(nativeQuery = true)` for database-specific features or complex queries that JPQL cannot express. Use named parameters (`:paramName`) or positional parameters (`?1`) for clarity and safety against SQL injection.

For banking applications, custom queries handle complex reporting: aggregate balances by account type, find accounts with unusual activity patterns, or calculate monthly transaction summaries.

```java
interface AccountRepository extends JpaRepository<Account, Long> {

    // JPQL: uses entity class names, not table names
    @Query("SELECT a FROM Account a WHERE a.balance > :minBalance ORDER BY a.balance DESC")
    List<Account> findWealthyAccounts(@Param("minBalance") double minBalance);

    // JPQL with aggregation
    @Query("SELECT SUM(a.balance) FROM Account a WHERE a.accountType = :type")
    Double getTotalBalanceByType(@Param("type") String type);

    // Native SQL when needed
    @Query(value = "SELECT * FROM accounts WHERE created_at > NOW() - INTERVAL '30 days'",
           nativeQuery = true)
    List<Account> findRecentAccounts();

    // Update query
    @Modifying
    @Query("UPDATE Account a SET a.balance = a.balance + :amount WHERE a.id = :id")
    int addToBalance(@Param("id") Long id, @Param("amount") double amount);
}
```

### @Transactional

The `@Transactional` annotation wraps a method in a database transaction. If the method completes normally, the transaction commits. If an exception is thrown, it rolls back. This ensures data consistency: either all changes succeed or none do.

In banking, transactions are critical. A transfer from Account A to Account B involves two operations: debit A and credit B. If the credit fails after the debit succeeds, money disappears. `@Transactional` ensures both operations succeed or both are rolled back.

By default, `@Transactional` rolls back on unchecked exceptions (RuntimeException and its subclasses) but not on checked exceptions. You can customize this with `rollbackFor` and `noRollbackFor`. Propagation settings control how nested transactions behave: `REQUIRED` (default) joins an existing transaction or creates a new one.

```java
@Service
class TransferService {
    private final AccountRepository accountRepository;

    TransferService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional  // all-or-nothing
    void transfer(Long fromId, Long toId, double amount) {
        Account from = accountRepository.findById(fromId)
            .orElseThrow(() -> new RuntimeException("Source not found"));
        Account to = accountRepository.findById(toId)
            .orElseThrow(() -> new RuntimeException("Target not found"));

        if (from.getBalance() < amount) {
            throw new RuntimeException("Insufficient funds");
            // Transaction rolls back, no changes committed
        }

        from.setBalance(from.getBalance() - amount);
        to.setBalance(to.getBalance() + amount);

        accountRepository.save(from);
        accountRepository.save(to);
        // Both saves commit together, or neither does
    }
}
```

## Why It Matters

Data access is at the heart of every banking application. Spring Data JPA eliminates boilerplate, ensures type safety, and provides transaction management that keeps your data consistent. Understanding entities, repositories, queries, and transactions is essential for building reliable banking backends. These concepts appear in every Spring Boot application and every banking Java interview.

## Challenge

Define an `Account` entity and a repository interface. Simulate CRUD operations (create, read, list) and print the results.

## Starter Code
```java
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        // TODO: Create an Account class with id, holderName, balance
        // TODO: Create a simulated AccountRepository with save, findById, findAll
        // TODO: Save an account, find it by ID, list all accounts
        // TODO: Print results
    }
}
```

## Expected Output
```
Saved: Account{id=1, holder='Alice Martin'}
Found: Account{id=1, holder='Alice Martin', balance=5000.0}
All accounts: 3
```

## Hint

Create an `Account` class with id, holderName, and balance fields. Create a `SimpleAccountRepository` class with a `HashMap<Long, Account>` for storage. Implement `save` (puts in map and returns the account), `findById` (gets from map), and `findAll` (returns all values). Save three accounts, find the first one by ID, and print the count of all accounts.

## Solution
```java
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

class Account {
    private long id;
    private String holderName;
    private double balance;

    Account(long id, String holderName, double balance) {
        this.id = id;
        this.holderName = holderName;
        this.balance = balance;
    }

    public long getId() { return id; }
    public String getHolderName() { return holderName; }
    public double getBalance() { return balance; }

    public String toString() {
        return "Account{id=" + id + ", holder='" + holderName + "'}";
    }

    public String toDetailString() {
        return "Account{id=" + id + ", holder='" + holderName
            + "', balance=" + balance + "}";
    }
}

class SimpleAccountRepository {
    private Map<Long, Account> store = new HashMap<>();

    Account save(Account account) {
        store.put(account.getId(), account);
        return account;
    }

    Account findById(long id) {
        return store.get(id);
    }

    List<Account> findAll() {
        return new ArrayList<>(store.values());
    }
}

public class Main {
    public static void main(String[] args) {
        SimpleAccountRepository repository = new SimpleAccountRepository();

        Account alice = repository.save(new Account(1, "Alice Martin", 5000.0));
        System.out.println("Saved: " + alice);

        repository.save(new Account(2, "Bob Jones", 3200.0));
        repository.save(new Account(3, "Carol White", 7500.0));

        Account found = repository.findById(1);
        System.out.println("Found: " + found.toDetailString());

        List<Account> all = repository.findAll();
        System.out.println("All accounts: " + all.size());
    }
}
```
