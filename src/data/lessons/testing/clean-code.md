---
id: "clean-code"
moduleId: "testing"
title: "Clean Code & Design Patterns"
description: "Apply SOLID principles and essential design patterns to banking code."
order: 3
---

## Banking Scenario

JavaBank's codebase has grown from a small startup project to a system processing millions of transactions daily. Early shortcuts have become expensive: a single `TransactionService` class handles validation, processing, notification, and logging. Adding a new account type requires modifying five different classes. Interest calculation logic is duplicated across three modules.

Your tech lead has asked you to refactor the codebase using SOLID principles and design patterns. These are not academic exercises but practical tools that make banking code easier to maintain, extend, and test. Every enterprise Java developer is expected to recognize and apply these patterns.

## Content

### SOLID Principles

SOLID is an acronym for five design principles that guide object-oriented software toward maintainable, flexible code. In banking systems where requirements change frequently (new regulations, new account types, new compliance rules), SOLID principles prevent your codebase from becoming a tangled mess.

**Single Responsibility Principle (SRP):** A class should have only one reason to change. In banking, this means separating concerns. A `TransactionValidator` should only validate; a `TransactionProcessor` should only process. When the validation rules change, you modify only the validator. When the processing logic changes, you modify only the processor.

**Open/Closed Principle (OCP):** Classes should be open for extension but closed for modification. If you need to add a new transaction type, you should be able to add a new class without modifying existing code. This is achieved through interfaces and polymorphism.

```java
// BAD: Single class doing everything (violates SRP)
class TransactionService {
    void process(Transaction t) {
        // validates
        // processes
        // sends notification
        // logs to audit
    }
}

// GOOD: Separated responsibilities
class TransactionValidator {
    boolean isValid(Transaction t) {
        return t.getAmount() > 0 && t.getAccountId() != null;
    }
}

class TransactionProcessor {
    private TransactionValidator validator;

    void process(Transaction t) {
        if (validator.isValid(t)) {
            // only handles processing logic
        }
    }
}
```

### More SOLID Principles

**Liskov Substitution Principle (LSP):** Subtypes must be substitutable for their base types. If `SavingsAccount` extends `BankAccount`, any code that works with `BankAccount` must work correctly with `SavingsAccount`. Violating this leads to unexpected behavior and fragile code.

**Interface Segregation Principle (ISP):** Clients should not be forced to depend on interfaces they do not use. Instead of one massive `BankOperations` interface with 20 methods, create focused interfaces like `Depositable`, `Withdrawable`, and `InterestBearing`. A basic checking account should not need to implement `calculateCompoundInterest`.

**Dependency Inversion Principle (DIP):** High-level modules should not depend on low-level modules. Both should depend on abstractions. Your `TransactionProcessor` should depend on an `AccountRepository` interface, not a `MySQLAccountRepository` class. This makes swapping implementations easy and testing straightforward.

```java
// Interface Segregation
interface Depositable {
    void deposit(double amount);
}

interface Withdrawable {
    void withdraw(double amount);
}

interface InterestBearing {
    double calculateInterest();
}

// A savings account implements all three
class SavingsAccount implements Depositable, Withdrawable, InterestBearing {
    public void deposit(double amount) { /* ... */ }
    public void withdraw(double amount) { /* ... */ }
    public double calculateInterest() { /* ... */ return 0; }
}

// Dependency Inversion
class TransactionProcessor {
    private final AccountRepository repository; // depends on abstraction

    TransactionProcessor(AccountRepository repository) {
        this.repository = repository;
    }
}
```

### Builder Pattern

The Builder pattern constructs complex objects step by step. In banking, many objects have numerous fields: a loan application has applicant name, amount, term, type, credit score, employment status, collateral, and more. Constructors with many parameters are error-prone and hard to read.

The Builder pattern provides a fluent API where each method sets one field and returns the builder itself, allowing method chaining. The final `build()` method creates the immutable object. This pattern also lets you enforce validation rules -- the `build()` method can reject incomplete or invalid combinations.

Builders are especially common in banking for creating DTOs (Data Transfer Objects), configuration objects, and request/response models. They make the code self-documenting because each field is explicitly named at the call site.

```java
class LoanApplication {
    private final String applicant;
    private final double amount;
    private final int termYears;
    private final String type;

    private LoanApplication(Builder builder) {
        this.applicant = builder.applicant;
        this.amount = builder.amount;
        this.termYears = builder.termYears;
        this.type = builder.type;
    }

    public String toString() {
        return "Loan Application:\nApplicant: " + applicant
            + "\nAmount: $" + amount
            + "\nTerm: " + termYears + " years"
            + "\nType: " + type;
    }

    static class Builder {
        private String applicant;
        private double amount;
        private int termYears;
        private String type;

        Builder applicant(String applicant) { this.applicant = applicant; return this; }
        Builder amount(double amount) { this.amount = amount; return this; }
        Builder termYears(int years) { this.termYears = years; return this; }
        Builder type(String type) { this.type = type; return this; }

        LoanApplication build() { return new LoanApplication(this); }
    }
}
```

### Factory Pattern

The Factory pattern creates objects without exposing the creation logic. In banking, you often need to create different account types based on a parameter: "SAVINGS", "CHECKING", "BUSINESS". Instead of scattering `if/else` or `switch` statements throughout your code, a factory centralizes object creation.

This follows the Open/Closed Principle. When you add a new account type, you modify only the factory. All other code that uses accounts through the `BankAccount` interface remains unchanged. Factories are also useful for creating complex objects that require initialization steps or dependencies.

```java
interface BankAccount {
    String getType();
    double getInterestRate();
}

class SavingsAccount implements BankAccount {
    public String getType() { return "SAVINGS"; }
    public double getInterestRate() { return 0.025; }
}

class CheckingAccount implements BankAccount {
    public String getType() { return "CHECKING"; }
    public double getInterestRate() { return 0.001; }
}

class BusinessAccount implements BankAccount {
    public String getType() { return "BUSINESS"; }
    public double getInterestRate() { return 0.015; }
}

class AccountFactory {
    static BankAccount createAccount(String type) {
        switch (type.toUpperCase()) {
            case "SAVINGS": return new SavingsAccount();
            case "CHECKING": return new CheckingAccount();
            case "BUSINESS": return new BusinessAccount();
            default: throw new IllegalArgumentException("Unknown account type: " + type);
        }
    }
}
```

### Strategy Pattern

The Strategy pattern defines a family of algorithms, encapsulates each one, and makes them interchangeable. In banking, interest calculation varies by account type, customer tier, and market conditions. Instead of hardcoding these calculations, you define an `InterestStrategy` interface and swap implementations at runtime.

This pattern is powerful because it eliminates complex conditional logic. Instead of a method with ten `if/else` branches for different interest rules, you inject the appropriate strategy. Adding a new calculation method means creating a new strategy class without touching existing code. The Strategy pattern is frequently used in banking for fee calculation, risk assessment, and transaction routing.

```java
interface InterestStrategy {
    double calculate(double balance);
    String getName();
}

class StandardInterest implements InterestStrategy {
    public double calculate(double balance) { return balance * 0.02; }
    public String getName() { return "Standard (2%)"; }
}

class PremiumInterest implements InterestStrategy {
    public double calculate(double balance) { return balance * 0.05; }
    public String getName() { return "Premium (5%)"; }
}

class Account {
    private double balance;
    private InterestStrategy strategy;

    Account(double balance, InterestStrategy strategy) {
        this.balance = balance;
        this.strategy = strategy;
    }

    double applyInterest() {
        double interest = strategy.calculate(balance);
        balance += interest;
        return interest;
    }
}
```

### Why Patterns Matter in Enterprise Java

Design patterns are the shared vocabulary of professional developers. When you say "we should use a Builder here" or "this calls for a Strategy pattern," your entire team understands the approach without lengthy explanations. In banking, where teams are large and codebases are complex, this shared language accelerates development and reduces miscommunication.

Patterns also make code more testable. A `TransactionProcessor` that accepts an `InterestStrategy` interface can be tested with any strategy implementation, including test-specific ones. A factory-created account can be replaced with a mock for unit testing. SOLID principles and design patterns work together to create code that is modular, extensible, and easy to verify.

```java
// Patterns make testing easy
class TransactionProcessorTest {
    void testWithCustomStrategy() {
        InterestStrategy testStrategy = new InterestStrategy() {
            public double calculate(double balance) { return 100.0; }
            public String getName() { return "Test Strategy"; }
        };
        // Now you control exactly what interest is calculated
    }
}
```

## Why It Matters

Clean code and design patterns are the foundation of maintainable enterprise software. In banking, where systems operate for decades and are modified by hundreds of developers, writing clean, well-structured code is not a luxury but a necessity. SOLID principles prevent your codebase from decaying, and patterns like Builder, Factory, and Strategy solve recurring problems in proven ways. Interviewers at banking firms regularly test for these concepts.

## Challenge

Use the Builder pattern to construct a `LoanApplication` with multiple fields. Print the completed application details.

## Starter Code
```java
public class Main {
    public static void main(String[] args) {
        // TODO: Create a LoanApplication class with a Builder
        // Fields: applicant (String), amount (double), termYears (int), type (String)
        // Use the builder to create a loan application for:
        //   - Applicant: Jane Smith
        //   - Amount: 250000.0
        //   - Term: 30 years
        //   - Type: MORTGAGE
        // Print the result
    }
}
```

## Expected Output
```
Loan Application:
Applicant: Jane Smith
Amount: $250000.0
Term: 30 years
Type: MORTGAGE
```

## Hint

Create a `LoanApplication` class with a static inner `Builder` class. Each setter method in the Builder should set a field and return `this` for chaining. The `build()` method returns a new `LoanApplication`. Override `toString()` in `LoanApplication` to format the output. Then call `new LoanApplication.Builder().applicant("Jane Smith").amount(250000.0)...build()`.

## Solution
```java
class LoanApplication {
    private final String applicant;
    private final double amount;
    private final int termYears;
    private final String type;

    private LoanApplication(Builder builder) {
        this.applicant = builder.applicant;
        this.amount = builder.amount;
        this.termYears = builder.termYears;
        this.type = builder.type;
    }

    public String toString() {
        return "Loan Application:"
            + "\nApplicant: " + applicant
            + "\nAmount: $" + amount
            + "\nTerm: " + termYears + " years"
            + "\nType: " + type;
    }

    static class Builder {
        private String applicant;
        private double amount;
        private int termYears;
        private String type;

        Builder applicant(String applicant) { this.applicant = applicant; return this; }
        Builder amount(double amount) { this.amount = amount; return this; }
        Builder termYears(int years) { this.termYears = years; return this; }
        Builder type(String type) { this.type = type; return this; }

        LoanApplication build() { return new LoanApplication(this); }
    }
}

public class Main {
    public static void main(String[] args) {
        LoanApplication application = new LoanApplication.Builder()
            .applicant("Jane Smith")
            .amount(250000.0)
            .termYears(30)
            .type("MORTGAGE")
            .build();

        System.out.println(application);
    }
}
```
