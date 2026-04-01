---
id: "encapsulation"
moduleId: "oop"
title: "Encapsulation"
description: "Protect data with access modifiers and understand why String is immutable."
order: 2
---

## Banking Scenario

Imagine a junior developer on your team writes code that directly sets an account balance to a negative number: `account.balance = -5000.0`. There is no validation, no audit trail, and the system happily processes a withdrawal against a balance that should never exist. In a real bank, this kind of unrestricted access to internal state has caused costly bugs and even security breaches.

At JavaBank, the architecture team has mandated that all domain classes must **encapsulate** their data. No external code should be able to read or modify an object's fields directly. Instead, all access must go through controlled methods that enforce business rules. Your task is to refactor the `BankAccount` class to follow this principle.

## Content

### What Is Encapsulation?

Encapsulation is the practice of **hiding an object's internal state** and requiring all interaction to happen through well-defined methods. It is one of the four pillars of OOP. The goal is to protect the integrity of an object's data by preventing external code from putting it into an invalid state. You control what gets in and what gets out.

In banking, encapsulation means that the balance field cannot be set to a negative number by accident, an account number cannot be changed after creation, and sensitive data like a PIN is never exposed through a public getter.

### Access Modifiers

Java provides four access levels that control visibility:

| Modifier    | Class | Package | Subclass | World |
|-------------|-------|---------|----------|-------|
| `private`   | Yes   | No      | No       | No    |
| (default)   | Yes   | Yes     | No       | No    |
| `protected` | Yes   | Yes     | Yes      | No    |
| `public`    | Yes   | Yes     | Yes      | Yes   |

The most common pattern is to make fields `private` and provide `public` getter and setter methods. This gives you a chokepoint where you can add validation, logging, or access control.

```java
public class BankAccount {
    private int accountNumber;
    private String holderName;
    private double balance;

    public int getAccountNumber() {
        return accountNumber;
    }

    public double getBalance() {
        return balance;
    }
}
```

With `private` fields, any attempt to write `account.balance = -5000.0` from outside the class will result in a compile-time error. The compiler becomes your first line of defense.

### Getters and Setters with Validation

A getter simply returns the field value. A setter is where encapsulation earns its keep. Instead of blindly assigning a value, the setter can **validate** the input and reject anything that violates business rules.

```java
public void setBalance(double balance) {
    if (balance < 0) {
        System.out.println("Error: Balance cannot be negative");
        return;
    }
    this.balance = balance;
}
```

In a production banking system, the setter might throw an `IllegalArgumentException` instead of printing an error, and it might also log the attempt for audit purposes. The key insight is that all of this logic lives in one place, so you never have to hunt through the entire codebase to find where validation should happen.

### Why We Hide Internal State

Encapsulation is not about being secretive. It is about **controlling change**. When a field is private, you can change how it is stored internally without breaking any external code. For example, you might decide to store the balance in cents (as a `long`) instead of dollars (as a `double`) to avoid floating-point rounding errors. If the field is private and accessed only through `getBalance()`, you can make this change in one place and convert cents to dollars inside the getter. No other class needs to know.

This is especially important in large banking codebases with hundreds of developers. If a field is public, any of them could depend on its exact type and representation. Making it private gives you the freedom to evolve your design.

### Immutability and Why String Is Immutable

An **immutable** object is one whose state cannot change after construction. Java's `String` class is the most famous example. When you write `String name = "Alice"` and then `name = "Bob"`, you are not changing the original String object. You are creating a new String and pointing the variable at it. The original `"Alice"` still exists in memory (in the String pool) until garbage collected.

Why did Java's designers make String immutable? Three critical reasons:

1. **Security**: Strings are used for class loading, network connections, and database URLs. If a String could be modified after a security check, an attacker could swap in a malicious value.
2. **Caching**: Because Strings never change, Java can safely cache them in the **String pool**, saving memory when the same literal appears many times.
3. **Thread safety**: Immutable objects are inherently thread-safe. Multiple threads can read the same String without synchronization.

### Creating Immutable Classes

You can apply the same principle to your own classes. An immutable class has `private final` fields, no setters, and a constructor that sets all values:

```java
public final class AccountSummary {
    private final int accountNumber;
    private final String holderName;
    private final double balance;

    public AccountSummary(int accountNumber, String holderName, double balance) {
        this.accountNumber = accountNumber;
        this.holderName = holderName;
        this.balance = balance;
    }

    public int getAccountNumber() { return accountNumber; }
    public String getHolderName() { return holderName; }
    public double getBalance() { return balance; }
}
```

The `final` keyword on the class prevents subclassing (which could override methods and break immutability), and `final` on the fields ensures they can only be assigned once. In banking, immutable objects are ideal for transaction records, receipts, and audit logs — data that should never change after it is created.

## Why It Matters

In a banking interview, encapsulation questions test whether you understand how to build robust, maintainable systems. Interviewers will ask you to explain access modifiers, design a class with proper validation, or discuss why String is immutable. Beyond interviews, encapsulation is the difference between a codebase that gracefully handles change and one that breaks every time someone modifies a field. In financial systems where correctness is non-negotiable, encapsulation is your first and most important line of defense.

## Challenge

Create a `SecureBankAccount` class with private fields: `accountNumber` (int), `holderName` (String), and `balance` (double). Write a constructor that initializes all three fields. Add a `setBalance(double balance)` method that rejects negative values by printing an error message, and a `getBalance()` method. In your `main` method, create an account, successfully set the balance to 5000.0, then attempt to set it to -200.0.

## Starter Code

```java
public class SecureBankAccount {
    // TODO: Declare private fields

    // TODO: Constructor

    // TODO: setBalance with validation

    // TODO: getBalance

    public static void main(String[] args) {
        // TODO: Create account, set valid balance, set invalid balance
    }
}
```

## Expected Output

```
Balance set to: 5000.0
Error: Balance cannot be negative
```

## Hint

In the `setBalance` method, check if the incoming value is less than zero before assigning it. If it is negative, print the error message and return without modifying the field. If it is valid, update `this.balance` and print a confirmation.

## Solution

```java
public class SecureBankAccount {
    private int accountNumber;
    private String holderName;
    private double balance;

    public SecureBankAccount(int accountNumber, String holderName, double balance) {
        this.accountNumber = accountNumber;
        this.holderName = holderName;
        this.balance = balance;
    }

    public void setBalance(double balance) {
        if (balance < 0) {
            System.out.println("Error: Balance cannot be negative");
            return;
        }
        this.balance = balance;
        System.out.println("Balance set to: " + this.balance);
    }

    public double getBalance() {
        return this.balance;
    }

    public static void main(String[] args) {
        SecureBankAccount account = new SecureBankAccount(2001, "Jane Doe", 1000.0);
        account.setBalance(5000.0);
        account.setBalance(-200.0);
    }
}
```
