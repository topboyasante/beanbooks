---
id: "domain-model"
moduleId: "capstone"
title: "Domain Model"
description: "Design Customer, Account, and Transaction entities with proper JPA relationships."
order: 2
---

## Banking Scenario

JavaBank's data architects are designing the core domain model. A bank is nothing without its data: customers open accounts, accounts hold balances, and transactions record every deposit, withdrawal, and transfer. The relationships between these entities must be modeled precisely. A customer can have multiple accounts (checking, savings), and each account can have thousands of transactions over its lifetime.

Getting the entity relationships wrong means data integrity issues, orphaned records, and bugs that only surface in production when real money is on the line. This lesson applies everything you learned about OOP, inheritance, and JPA to build a rock-solid domain layer.

## Content

### BaseEntity with Audit Fields

Every entity in a banking system needs audit trails. Rather than duplicating `createdAt` and `updatedAt` on every class, use a mapped superclass, applying the inheritance concepts from the OOP module:

```java
package com.javabank.api.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@MappedSuperclass
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
```

### Enums for Type Safety

Enums enforce valid values at the Java level, preventing invalid data from ever reaching the database. This is a pattern from the Java basics and OOP modules applied to real business rules:

```java
public enum AccountType {
    CHECKING, SAVINGS, BUSINESS
}

public enum TransactionType {
    DEPOSIT, WITHDRAWAL, TRANSFER
}
```

### Customer Entity

The Customer entity is the root of our domain. It owns a collection of accounts through a `@OneToMany` relationship:

```java
package com.javabank.api.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "customers")
public class Customer extends BaseEntity {

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(nullable = false, unique = true)
    private String email;

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Account> accounts = new ArrayList<>();

    public void addAccount(Account account) {
        accounts.add(account);
        account.setCustomer(this);
    }

    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmail() { return email; }
    public List<Account> getAccounts() { return accounts; }
}
```

### Account Entity

Each account belongs to a customer and holds a collection of transactions. The `@ManyToOne` side is the owning side of the relationship:

```java
package com.javabank.api.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "accounts")
public class Account extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String accountNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AccountType accountType;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @OneToMany(mappedBy = "account", cascade = CascadeType.ALL)
    private List<Transaction> transactions = new ArrayList<>();

    public String getAccountNumber() { return accountNumber; }
    public AccountType getAccountType() { return accountType; }
    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }
    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }
}
```

### Transaction Entity

Transactions are immutable records. Once created, they should never be modified. Notice the use of `BigDecimal` for monetary amounts, never use `double` for money:

```java
package com.javabank.api.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "transactions")
public class Transaction extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionType transactionType;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    public TransactionType getTransactionType() { return transactionType; }
    public BigDecimal getAmount() { return amount; }
    public String getDescription() { return description; }
    public Account getAccount() { return account; }
}
```

### Flyway Migrations

Instead of letting Hibernate auto-generate tables, use Flyway migrations for version-controlled schema changes. This is how production banking systems manage their databases:

```java
// V1__create_tables.sql
// CREATE TABLE customers (
//     id BIGSERIAL PRIMARY KEY,
//     first_name VARCHAR(100) NOT NULL,
//     last_name VARCHAR(100) NOT NULL,
//     email VARCHAR(255) NOT NULL UNIQUE,
//     created_at TIMESTAMP NOT NULL,
//     updated_at TIMESTAMP
// );
//
// CREATE TABLE accounts (
//     id BIGSERIAL PRIMARY KEY,
//     account_number VARCHAR(20) NOT NULL UNIQUE,
//     account_type VARCHAR(20) NOT NULL,
//     balance NUMERIC(19,2) NOT NULL DEFAULT 0,
//     customer_id BIGINT NOT NULL REFERENCES customers(id),
//     created_at TIMESTAMP NOT NULL,
//     updated_at TIMESTAMP
// );
//
// CREATE TABLE transactions (
//     id BIGSERIAL PRIMARY KEY,
//     transaction_type VARCHAR(20) NOT NULL,
//     amount NUMERIC(19,2) NOT NULL,
//     description VARCHAR(255),
//     account_id BIGINT NOT NULL REFERENCES accounts(id),
//     created_at TIMESTAMP NOT NULL,
//     updated_at TIMESTAMP
// );
```

## Why It Matters

The domain model is the heart of any banking application. Incorrect relationships lead to orphaned transactions, wrong balances, and data corruption. Using `BigDecimal` for money, enums for type safety, audit fields for traceability, and Flyway for schema management are all industry-standard practices that protect real financial data.

## Questions

Q: Why should you use BigDecimal instead of double for monetary amounts?
A) BigDecimal is faster than double
B) double cannot store negative numbers
C) double has floating-point precision errors that lose cents
D) BigDecimal uses less memory than double
Correct: C

Q: What does `orphanRemoval = true` on Customer's accounts list do?
A) Deletes the customer when all accounts are removed
B) Deletes accounts from the database when they are removed from the list
C) Prevents accounts from being added to the list
D) Automatically creates new accounts for the customer
Correct: B

Q: Why does the Account entity use `FetchType.LAZY` for the customer relationship?
A) Lazy loading prevents the customer from being modified
B) Lazy loading loads the customer data only when it is actually accessed
C) Lazy loading makes the customer field read-only
D) Lazy loading stores the customer in a separate cache
Correct: B

## Challenge

Create a simplified domain model with a `Customer` class and an `Account` class. The customer should have a list of accounts. Write a main method that creates a customer, adds two accounts (checking and savings), and prints out the customer's details.

## Starter Code
```java
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

enum AccountType { CHECKING, SAVINGS }

class Customer {
    private String name;
    private String email;
    private List<Account> accounts = new ArrayList<>();

    // TODO: Constructor, addAccount method, getters
}

class Account {
    private String accountNumber;
    private AccountType accountType;
    private BigDecimal balance;

    // TODO: Constructor, getters, toString
}

public class DomainModelDemo {
    public static void main(String[] args) {
        // TODO: Create a customer
        // TODO: Add a checking account with balance 2500.00
        // TODO: Add a savings account with balance 10000.00
        // TODO: Print customer info and all accounts
    }
}
```

## Expected Output
```
Customer: Alice Johnson (alice@javabank.com)
Accounts:
  CHK-1001 | CHECKING | $2500.00
  SAV-2001 | SAVINGS  | $10000.00
Total accounts: 2
```

## Hint

Use `BigDecimal` constructor with a String argument like `new BigDecimal("2500.00")` to avoid floating-point issues. In the `addAccount` method, add the account to the internal list. Use `String.format` with `%-8s` for aligned output.

## Solution
```java
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

enum AccountType { CHECKING, SAVINGS }

class Customer {
    private String name;
    private String email;
    private List<Account> accounts = new ArrayList<>();

    public Customer(String name, String email) {
        this.name = name;
        this.email = email;
    }

    public void addAccount(Account account) {
        accounts.add(account);
    }

    public String getName() { return name; }
    public String getEmail() { return email; }
    public List<Account> getAccounts() { return accounts; }
}

class Account {
    private String accountNumber;
    private AccountType accountType;
    private BigDecimal balance;

    public Account(String accountNumber, AccountType accountType,
                   BigDecimal balance) {
        this.accountNumber = accountNumber;
        this.accountType = accountType;
        this.balance = balance;
    }

    public String getAccountNumber() { return accountNumber; }
    public AccountType getAccountType() { return accountType; }
    public BigDecimal getBalance() { return balance; }
}

public class DomainModelDemo {
    public static void main(String[] args) {
        Customer customer = new Customer("Alice Johnson",
            "alice@javabank.com");

        Account checking = new Account("CHK-1001", AccountType.CHECKING,
            new BigDecimal("2500.00"));
        Account savings = new Account("SAV-2001", AccountType.SAVINGS,
            new BigDecimal("10000.00"));

        customer.addAccount(checking);
        customer.addAccount(savings);

        System.out.println("Customer: " + customer.getName()
            + " (" + customer.getEmail() + ")");
        System.out.println("Accounts:");
        for (Account acc : customer.getAccounts()) {
            System.out.println("  " + acc.getAccountNumber()
                + " | " + String.format("%-8s", acc.getAccountType())
                + " | $" + acc.getBalance());
        }
        System.out.println("Total accounts: "
            + customer.getAccounts().size());
    }
}
```
