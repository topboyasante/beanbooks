---
id: "exception-handling"
moduleId: "advanced-java"
title: "Exception Handling"
description: "Handle errors gracefully with try-catch, custom exceptions, and best practices."
order: 5
---

## Banking Scenario

A customer walks up to an ATM and tries to withdraw $800 from an account with only $500. The system cannot simply crash -- it must recognize the problem, deny the transaction gracefully, display a helpful message, and leave the account untouched. Meanwhile, it must log the event for auditing.

Error handling in banking is not an afterthought; it is a core requirement. Every network timeout, every invalid input, every insufficient balance must be anticipated and handled. Java's exception system provides a structured way to separate normal business logic from error recovery, ensuring that failures are caught, reported, and resolved without corrupting financial data.

## Content

### The Exception Hierarchy

Java's exception system is built on a class hierarchy rooted at `Throwable`. Understanding this hierarchy is essential for writing correct error handling.

```
Throwable
├── Error (serious, unrecoverable -- OutOfMemoryError, StackOverflowError)
│   └── Do NOT catch these
└── Exception (recoverable problems)
    ├── RuntimeException (unchecked -- NullPointerException, IllegalArgumentException)
    │   └── Not required to catch or declare
    └── Other Exceptions (checked -- IOException, SQLException)
        └── MUST catch or declare with "throws"
```

```java
// Checked exception -- compiler forces you to handle it
// FileReader throws FileNotFoundException (checked)
try {
    java.io.FileReader reader = new java.io.FileReader("accounts.txt");
} catch (java.io.FileNotFoundException e) {
    System.out.println("File not found: " + e.getMessage());
}

// Unchecked exception -- compiler does not force handling
String name = null;
// name.length(); // NullPointerException at runtime
```

### Checked vs Unchecked Exceptions

**Checked exceptions** represent expected, recoverable problems (file not found, network down, SQL error). The compiler forces you to either catch them or declare them with `throws`. They are subclasses of `Exception` but not `RuntimeException`.

**Unchecked exceptions** represent programming errors (null pointers, array out of bounds, bad casts). They extend `RuntimeException` and do not require explicit handling. Fixing the code is the proper remedy, not catching them.

```java
// Checked: must handle or declare
public void readAccountFile(String path) throws java.io.IOException {
    java.io.BufferedReader reader = new java.io.BufferedReader(
        new java.io.FileReader(path)
    );
    // ...
}

// Unchecked: indicates a bug in the code
public void processAmount(double amount) {
    if (amount < 0) {
        throw new IllegalArgumentException("Amount cannot be negative: " + amount);
    }
}
```

### Try-Catch-Finally

The `try-catch-finally` block is the fundamental error handling structure. The `finally` block always executes, whether or not an exception occurs -- making it ideal for cleanup.

```java
public class ATMTransaction {
    public static void processWithdrawal(double balance, double amount) {
        try {
            System.out.println("Processing withdrawal of $" + amount);
            if (amount > balance) {
                throw new Exception("Insufficient funds");
            }
            balance -= amount;
            System.out.println("Success. Remaining balance: $" + balance);
        } catch (Exception e) {
            System.out.println("Transaction failed: " + e.getMessage());
        } finally {
            System.out.println("Transaction record saved to audit log.");
        }
    }
}
```

**Multi-catch blocks** (Java 7+) let you handle multiple exception types in one catch:

```java
try {
    // some banking operation
} catch (java.io.IOException | java.sql.SQLException e) {
    System.out.println("Data access error: " + e.getMessage());
}
```

### Try-With-Resources

When working with resources that must be closed (file handles, database connections, network sockets), `try-with-resources` guarantees they are closed automatically. The resource must implement `AutoCloseable`.

```java
// Old way -- manual close in finally
java.io.BufferedReader reader = null;
try {
    reader = new java.io.BufferedReader(new java.io.FileReader("accounts.csv"));
    String line = reader.readLine();
} catch (java.io.IOException e) {
    e.printStackTrace();
} finally {
    if (reader != null) {
        try { reader.close(); } catch (java.io.IOException e) { /* swallowed */ }
    }
}

// Modern way -- try-with-resources
try (java.io.BufferedReader br = new java.io.BufferedReader(
        new java.io.FileReader("accounts.csv"))) {
    String line = br.readLine();
} catch (java.io.IOException e) {
    e.printStackTrace();
}
// br is automatically closed, even if an exception occurs
```

### Creating Custom Exceptions

Banking applications need domain-specific exceptions that carry meaningful context. Custom exceptions make error handling clear and self-documenting.

```java
public class InsufficientFundsException extends Exception {
    private double attempted;
    private double available;

    public InsufficientFundsException(double attempted, double available) {
        super("Insufficient funds. Attempted: $" + attempted
              + ", Available: $" + available);
        this.attempted = attempted;
        this.available = available;
    }

    public double getAttempted() { return attempted; }
    public double getAvailable() { return available; }
}
```

Custom exceptions should:
- Extend `Exception` for checked (recoverable business errors like insufficient funds)
- Extend `RuntimeException` for unchecked (programming errors like invalid account format)
- Include relevant context (amounts, account IDs) as fields

### Exception Best Practices

Following best practices prevents the subtle bugs that can cause financial disasters:

```java
// BAD: Catching generic Exception hides specific problems
try {
    processTransaction();
} catch (Exception e) {
    // Which exception? NullPointer? InsufficientFunds? IOException?
}

// GOOD: Catch specific exception types
try {
    processTransaction();
} catch (InsufficientFundsException e) {
    notifyCustomer(e.getMessage());
} catch (java.io.IOException e) {
    retryTransaction();
}

// BAD: Swallowing exceptions (silent failure)
try {
    debitAccount(amount);
} catch (Exception e) {
    // empty catch -- money vanishes, nobody knows
}

// GOOD: Log, handle, or rethrow
try {
    debitAccount(amount);
} catch (InsufficientFundsException e) {
    System.err.println("Failed withdrawal: " + e.getMessage());
    throw e; // rethrow if caller should handle it
}
```

**Key rules:**
1. Never catch `Exception` or `Throwable` broadly
2. Never swallow exceptions with empty catch blocks
3. Use the most specific exception type available
4. Include context in exception messages (amounts, IDs, timestamps)
5. Prefer try-with-resources for any `AutoCloseable` resource

## Why It Matters

In banking, poor exception handling can lead to lost transactions, double charges, or security vulnerabilities. Interviewers will test whether you understand checked vs unchecked exceptions, can design custom exceptions for domain problems, and follow best practices that prevent silent failures. A developer who swallows exceptions or catches `Exception` broadly is a liability in financial software. Demonstrating disciplined error handling shows you are ready for production banking code.

## Challenge

Create an `InsufficientFundsException` class. Write a `BankAccount` class with a `withdraw` method that throws this exception when the withdrawal amount exceeds the balance. In `main`, start with a $1000 balance, make a successful withdrawal of $500, then attempt to withdraw $800 (which should fail). Catch and print the error message.

## Starter Code
```java
// Define InsufficientFundsException here

public class BankAccount {
    private double balance;

    public BankAccount(double balance) {
        this.balance = balance;
    }

    // Write the withdraw method here

    public static void main(String[] args) {
        BankAccount account = new BankAccount(1000.0);

        // Try withdrawing $500 (should succeed)

        // Try withdrawing $800 (should fail with InsufficientFundsException)
    }
}
```

## Expected Output
```
Withdrawal of $500.0 successful. Balance: $500.0
Error: Insufficient funds. Attempted: $800.0, Available: $500.0
```

## Hint

Make `InsufficientFundsException` extend `Exception` and accept `attempted` and `available` amounts in the constructor. The `withdraw` method should be declared with `throws InsufficientFundsException`. Use separate try-catch blocks for each withdrawal, or one block with both calls.

## Solution
```java
class InsufficientFundsException extends Exception {
    public InsufficientFundsException(double attempted, double available) {
        super("Insufficient funds. Attempted: $" + attempted + ", Available: $" + available);
    }
}

public class BankAccount {
    private double balance;

    public BankAccount(double balance) {
        this.balance = balance;
    }

    public void withdraw(double amount) throws InsufficientFundsException {
        if (amount > balance) {
            throw new InsufficientFundsException(amount, balance);
        }
        balance -= amount;
        System.out.println("Withdrawal of $" + amount + " successful. Balance: $" + balance);
    }

    public static void main(String[] args) {
        BankAccount account = new BankAccount(1000.0);

        try {
            account.withdraw(500.0);
            account.withdraw(800.0);
        } catch (InsufficientFundsException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }
}
```
