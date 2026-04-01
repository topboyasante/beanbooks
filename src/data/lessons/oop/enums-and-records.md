---
id: "enums-and-records"
moduleId: "oop"
title: "Enums & Records"
description: "Use enums for type-safe constants and records for immutable data carriers."
order: 6
---

## Banking Scenario

JavaBank classifies every account into a type: SAVINGS, CHECKING, or BUSINESS. Each type has a different monthly maintenance fee. Early in the codebase's history, developers represented account types as plain strings — `"SAVINGS"`, `"CHECKING"`, `"BUSINESS"`. This led to bugs: someone typed `"Savings"` instead of `"SAVINGS"`, another developer used `"CHK"` as a shorthand, and the fee calculation silently defaulted to zero for unrecognized types. Millions of dollars in fees went uncollected before the bug was discovered.

The fix was to replace strings with **enums** — a type-safe way to represent a fixed set of constants. Meanwhile, the reporting team needed lightweight, immutable data objects to carry account summaries between services. Instead of writing boilerplate classes with fields, constructors, getters, `equals`, `hashCode`, and `toString`, they switched to **records**, a feature introduced in Java 16 that generates all of that automatically.

## Content

### Enum Basics

An **enum** (short for enumeration) is a special class that represents a fixed set of constants. Unlike strings or integers, enum values are type-checked by the compiler. You cannot pass an invalid value.

```java
public enum AccountType {
    SAVINGS,
    CHECKING,
    BUSINESS
}
```

Each value (`SAVINGS`, `CHECKING`, `BUSINESS`) is an instance of the `AccountType` class. Enums are implicitly `final` and extend `java.lang.Enum`. You reference them as `AccountType.SAVINGS`.

```java
AccountType type = AccountType.SAVINGS;
System.out.println(type);          // prints "SAVINGS"
System.out.println(type.name());   // prints "SAVINGS"
System.out.println(type.ordinal()); // prints 0 (position in declaration order)
```

You can iterate over all values using the `values()` method:

```java
for (AccountType t : AccountType.values()) {
    System.out.println(t);
}
```

### Enums with Fields and Methods

Enums become truly powerful when you add fields, constructors, and methods. Each constant can carry its own data. The constructor is always `private` (implicitly or explicitly) — you cannot create new enum instances at runtime.

```java
public enum AccountType {
    SAVINGS(0.0),
    CHECKING(12.5),
    BUSINESS(25.0);

    private final double monthlyFee;

    AccountType(double monthlyFee) {
        this.monthlyFee = monthlyFee;
    }

    public double getMonthlyFee() {
        return monthlyFee;
    }

    public String describe() {
        return this.name() + ": $" + monthlyFee + "/month";
    }
}
```

This pattern replaces scattered `if-else` chains or `switch` statements that map account types to fees. The fee is **embedded in the constant itself**, so you can never forget to handle a new type. Each enum value is a self-contained object with its own state and behavior.

### Enums in Switch Statements

Enums work naturally with `switch` statements (and the enhanced `switch` expression in Java 14+). The compiler will warn you if you miss a case, which is invaluable for ensuring exhaustive handling.

```java
AccountType type = AccountType.CHECKING;

switch (type) {
    case SAVINGS:
        System.out.println("No monthly fee");
        break;
    case CHECKING:
        System.out.println("Standard checking fee applies");
        break;
    case BUSINESS:
        System.out.println("Premium business fee applies");
        break;
}
```

With the enhanced switch expression:

```java
String message = switch (type) {
    case SAVINGS -> "No monthly fee";
    case CHECKING -> "Standard checking fee applies";
    case BUSINESS -> "Premium business fee applies";
};
```

The enhanced form is more concise, eliminates fall-through bugs (no `break` needed), and can return a value directly.

### Enum vs Constants

You might wonder why not just use `static final` constants:

```java
public static final int SAVINGS = 0;
public static final int CHECKING = 1;
public static final int BUSINESS = 2;
```

The problem is that these are just integers. A method accepting an `int` type parameter would happily accept `42` or `-1`. There is no compile-time safety. Enums restrict the value to exactly the declared constants and allow you to attach behavior and data to each one. In banking, where correctness is paramount, this kind of safety is worth the small amount of extra code.

### Java 16+ Records

A **record** is a concise way to declare a class whose main purpose is to carry data. When you declare a record, Java automatically generates the constructor, getters (named after the fields, without the `get` prefix), `equals()`, `hashCode()`, and `toString()`.

```java
public record AccountSummary(int accountNumber, String holderName, double balance) {}
```

This single line generates a class equivalent to roughly 50 lines of boilerplate code. The generated `toString()` produces output like `AccountSummary[accountNumber=101, holderName=Alice, balance=5000.0]`.

```java
AccountSummary summary = new AccountSummary(101, "Alice", 5000.0);
System.out.println(summary.holderName());   // "Alice" — no "get" prefix
System.out.println(summary.balance());      // 5000.0
System.out.println(summary);               // AccountSummary[accountNumber=101, ...]
```

Records are implicitly `final` and their fields are `private final`. You cannot extend a record or mutate its fields. They are immutable by design.

### Compact Constructors

Records support **compact constructors** for validation. The compact constructor does not list the parameters — they are implicit — and the field assignments happen automatically after the constructor body runs.

```java
public record Transaction(String id, double amount, String type) {
    public Transaction {
        if (amount <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }
        type = type.toUpperCase();  // normalize before automatic assignment
    }
}
```

In the compact constructor, you can validate and transform the incoming values. The actual assignment to `this.id`, `this.amount`, and `this.type` happens automatically after your code runs. This keeps validation logic clean and co-located with the data definition.

### When to Use Record vs Class

Use a record when your class is primarily a **data carrier** — it holds values, is compared by those values, and should be immutable. Transaction receipts, API response payloads, and event objects are ideal candidates.

Use a regular class when you need mutable state, inheritance, or complex behavior beyond simple data access. An `Account` with deposit and withdraw methods is better as a class. An `AccountSnapshot` sent to a reporting service is better as a record.

## Why It Matters

Enums and records demonstrate modern Java fluency, which interviewers at banks increasingly look for. Enums show you understand type safety and can eliminate entire categories of bugs caused by magic strings and integers. Records show you know how to write clean, concise code and understand immutability — a core principle in financial systems where audit trails and data integrity are non-negotiable. Together, they represent the shift toward more expressive, less error-prone Java code that banks are adopting in their modernization efforts.

## Challenge

Create an `AccountType` enum with three constants: `SAVINGS`, `CHECKING`, and `BUSINESS`. Each constant should have a `monthlyFee` field (double) set through the constructor: SAVINGS is 0.0, CHECKING is 12.5, and BUSINESS is 25.0. Add a `getMonthlyFee()` method. In `main`, loop through all values and print each type with its fee.

## Starter Code

```java
enum AccountType {
    // TODO: Declare constants with monthly fees

    // TODO: Private field, constructor, getter
}

public class Main {
    public static void main(String[] args) {
        // TODO: Loop through AccountType.values() and print each type's fee
    }
}
```

## Expected Output

```
SAVINGS: $0.0/month
CHECKING: $12.5/month
BUSINESS: $25.0/month
```

## Hint

Each enum constant is declared with its fee in parentheses, like `SAVINGS(0.0)`. The constructor receives this value and stores it in a `private final double monthlyFee` field. Use `AccountType.values()` to get an array of all constants, then call `name()` and `getMonthlyFee()` on each.

## Solution

```java
enum AccountType {
    SAVINGS(0.0),
    CHECKING(12.5),
    BUSINESS(25.0);

    private final double monthlyFee;

    AccountType(double monthlyFee) {
        this.monthlyFee = monthlyFee;
    }

    public double getMonthlyFee() {
        return monthlyFee;
    }
}

public class Main {
    public static void main(String[] args) {
        for (AccountType type : AccountType.values()) {
            System.out.println(type.name() + ": $" + type.getMonthlyFee() + "/month");
        }
    }
}
```
