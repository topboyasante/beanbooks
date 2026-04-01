---
id: "entity-relationships"
moduleId: "spring"
title: "Entity Relationships"
description: "Model database relationships with @OneToMany, @ManyToOne, and understand lazy vs eager loading."
order: 7
---

## Banking Scenario

A bank's data model is inherently relational. A Customer has many Accounts. Each Account has many Transactions. An Account belongs to one Branch. These relationships must be correctly mapped in JPA, or you will face data integrity issues, N+1 query performance problems, or cascade deletion disasters where closing an account accidentally deletes the customer who owns it.

Getting entity relationships right is one of the most important skills in banking software development. A poorly mapped relationship can cause your application to execute hundreds of unnecessary database queries on a single page load, or worse, silently delete records that should have been preserved for regulatory compliance.

## Content

### @ManyToOne - The Owning Side

`@ManyToOne` maps the "many" side of a relationship. In banking, a Transaction belongs to one Account, but an Account can have many Transactions. The foreign key column lives in the transaction table, making Transaction the owning side of the relationship.

```java
@Entity
class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;
    private double amount;

    @ManyToOne
    @JoinColumn(name = "account_id")
    private Account account;

    // Constructors, getters, setters
    Transaction() {}

    Transaction(String type, double amount) {
        this.type = type;
        this.amount = amount;
    }

    public String getType() { return type; }
    public double getAmount() { return amount; }
    public void setAccount(Account account) { this.account = account; }
}
```

The `@JoinColumn(name = "account_id")` annotation specifies the foreign key column name in the transaction table. This column stores the ID of the associated Account. When JPA loads a Transaction, it can follow this foreign key to load the related Account.

### @OneToMany - The Inverse Side

`@OneToMany` maps the "one" side of the relationship. An Account has many Transactions. The `mappedBy` attribute tells JPA that the Transaction entity owns the relationship through its `account` field. Without `mappedBy`, JPA would create an unnecessary join table.

```java
@Entity
class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String holderName;
    private double balance;

    @OneToMany(mappedBy = "account", cascade = CascadeType.ALL)
    private List<Transaction> transactions = new ArrayList<>();

    // Helper method to keep both sides in sync
    public void addTransaction(Transaction transaction) {
        transactions.add(transaction);
        transaction.setAccount(this);
    }
}
```

You need both sides of the relationship. `@ManyToOne` on Transaction lets you navigate from a transaction to its account. `@OneToMany` on Account lets you navigate from an account to all its transactions. The `addTransaction` helper method ensures both sides stay in sync.

### Cascade Types

Cascade types control what happens to child entities when you perform operations on the parent. Each type serves a specific purpose:

- `CascadeType.PERSIST` saves child entities when the parent is saved. Add transactions to an account, save the account, and the transactions are saved automatically.
- `CascadeType.REMOVE` deletes children when the parent is deleted. Delete an account, and all its transactions are deleted too.
- `CascadeType.MERGE` updates children when the parent is updated.
- `CascadeType.ALL` applies all cascade types at once.

In banking, `CascadeType.ALL` is dangerous at certain levels. If you put `CascadeType.ALL` on a Customer's list of Accounts, deleting a customer would delete all their accounts and every transaction in those accounts. Regulatory requirements often mandate that transaction records be preserved. Use cascade types deliberately and only where the lifecycle of the child truly depends on the parent.

```java
// Safe: Transactions live and die with their Account
@OneToMany(mappedBy = "account", cascade = CascadeType.ALL)
private List<Transaction> transactions;

// Dangerous: Deleting a customer would delete all their accounts
// Use CascadeType.PERSIST instead, handle deletion separately
@OneToMany(mappedBy = "customer", cascade = CascadeType.PERSIST)
private List<Account> accounts;
```

### Fetch Strategies

When JPA loads an entity, it must decide whether to also load its related entities. There are two strategies:

- `FetchType.LAZY` (default for collections) does not load related entities until you explicitly access them. Loading an Account does not load its Transactions until you call `account.getTransactions()`.
- `FetchType.EAGER` loads related entities immediately. Loading an Account instantly loads all its Transactions too.

LAZY is almost always preferred in banking applications. An account might have thousands of transactions spanning years. Loading them all every time you fetch the account wastes memory and database bandwidth. Only load transactions when you actually need them.

```java
// LAZY: Transactions are loaded only when accessed (default for @OneToMany)
@OneToMany(mappedBy = "account", fetch = FetchType.LAZY)
private List<Transaction> transactions;

// EAGER: Account is loaded immediately with each Transaction (default for @ManyToOne)
@ManyToOne(fetch = FetchType.EAGER)
private Account account;
```

### The N+1 Problem

The N+1 problem is the most common performance issue with JPA relationships. Imagine you load 100 accounts, then iterate through each one to access its transactions. JPA executes 1 query to load the accounts, then 100 additional queries to load each account's transactions. That is 101 queries for what should be a single operation.

Solutions include `JOIN FETCH` in JPQL queries, `@EntityGraph` annotations, or batch fetching with `@BatchSize`. For example:

```java
// JPQL JOIN FETCH eliminates the N+1 problem
// "SELECT a FROM Account a JOIN FETCH a.transactions"

// @EntityGraph on a repository method
// @EntityGraph(attributePaths = "transactions")
// List<Account> findAllWithTransactions();
```

### @ManyToMany and Bidirectional Relationships

Some banking relationships are many-to-many. A Customer can have multiple Accounts (checking, savings), and an Account can have multiple Customers (joint accounts). JPA uses a join table to represent this.

```java
// On the owning side (Customer)
@ManyToMany
@JoinTable(
    name = "customer_accounts",
    joinColumns = @JoinColumn(name = "customer_id"),
    inverseJoinColumns = @JoinColumn(name = "account_id")
)
private List<Account> accounts;

// On the inverse side (Account)
@ManyToMany(mappedBy = "accounts")
private List<Customer> customers;
```

For complex many-to-many relationships where you need extra columns on the join table (like `role` or `addedDate`), create a separate entity instead. A `CustomerAccountMembership` entity with `@ManyToOne` to both Customer and Account gives you full control over the relationship.

## Why It Matters

Entity relationships are the backbone of any banking application's data model. Mapping them correctly ensures data integrity, prevents accidental deletions of regulated records, and avoids performance disasters like the N+1 problem. A single misconfigured cascade type could violate compliance requirements by deleting transaction history. A missing fetch strategy optimization could bring your application to a crawl under production load. Mastering JPA relationships lets you build data models that are correct, performant, and safe for financial data.

## Challenge

Model an Account that has many Transactions. Create an Account for "Alice Martin", add three transactions (a deposit, a withdrawal, and a transfer), and calculate the final balance. Use a helper method to keep the bidirectional relationship in sync.

## Starter Code
```java
import java.util.ArrayList;
import java.util.List;

public class EntityRelationshipDemo {

    public static void main(String[] args) {
        // TODO: Create an Account for Alice Martin
        // TODO: Add three transactions: Deposit $1000, Withdrawal $250, Transfer $500
        // TODO: Calculate the balance and print the account with its transactions
    }
}

class Account {
    private Long id;
    private String holderName;
    private double balance;
    private List<Transaction> transactions = new ArrayList<>();

    // TODO: Add constructor, getters, setters
    // TODO: Add an addTransaction() helper that keeps both sides in sync
    // TODO: Add a method to calculate balance from transactions
}

class Transaction {
    private Long id;
    private String type;
    private double amount;
    private Account account;

    // TODO: Add constructor, getters, setters
}
```

## Expected Output
```
Account: Alice Martin
Transactions:
  - Deposit: $1000.0
  - Withdrawal: $250.0
  - Transfer: $500.0
Balance: $250.0
```

## Hint

Create the Account and three Transaction objects. The `addTransaction` helper should add the transaction to the account's list and set the transaction's account reference. To calculate the balance, iterate through all transactions: deposits add to the balance, while withdrawals and transfers subtract from it.

## Solution
```java
import java.util.ArrayList;
import java.util.List;

public class EntityRelationshipDemo {

    public static void main(String[] args) {
        Account account = new Account(1L, "Alice Martin");

        account.addTransaction(new Transaction(1L, "Deposit", 1000.0));
        account.addTransaction(new Transaction(2L, "Withdrawal", 250.0));
        account.addTransaction(new Transaction(3L, "Transfer", 500.0));

        account.calculateBalance();

        System.out.println("Account: " + account.getHolderName());
        System.out.println("Transactions:");
        for (Transaction t : account.getTransactions()) {
            System.out.println("  - " + t.getType() + ": $" + t.getAmount());
        }
        System.out.println("Balance: $" + account.getBalance());
    }
}

class Account {
    private Long id;
    private String holderName;
    private double balance;
    private List<Transaction> transactions = new ArrayList<>();

    Account(Long id, String holderName) {
        this.id = id;
        this.holderName = holderName;
        this.balance = 0.0;
    }

    public void addTransaction(Transaction transaction) {
        transactions.add(transaction);
        transaction.setAccount(this);
    }

    public void calculateBalance() {
        balance = 0.0;
        for (Transaction t : transactions) {
            if (t.getType().equals("Deposit")) {
                balance += t.getAmount();
            } else {
                balance -= t.getAmount();
            }
        }
    }

    public Long getId() { return id; }
    public String getHolderName() { return holderName; }
    public double getBalance() { return balance; }
    public List<Transaction> getTransactions() { return transactions; }
}

class Transaction {
    private Long id;
    private String type;
    private double amount;
    private Account account;

    Transaction(Long id, String type, double amount) {
        this.id = id;
        this.type = type;
        this.amount = amount;
    }

    public Long getId() { return id; }
    public String getType() { return type; }
    public double getAmount() { return amount; }
    public void setAccount(Account account) { this.account = account; }
}
```
