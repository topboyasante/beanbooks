---
id: "generics"
moduleId: "advanced-java"
title: "Generics"
description: "Write type-safe, reusable code with generic classes and methods."
order: 2
---

## Banking Scenario

A bank's software handles many different types of data -- transaction records, audit logs, account summaries, and compliance reports. Without generics, developers would either write separate classes for each type or resort to using `Object` everywhere, losing type safety and inviting runtime `ClassCastException` errors that could corrupt financial data.

Imagine a transaction logging system that needs to store different kinds of entries: strings describing actions, numeric amounts, or complex transaction objects. Generics let you build one flexible, type-safe class that works with any data type while catching errors at compile time -- before they ever reach production.

## Content

### Why Generics? Type Safety and Avoiding Casts

Before generics (pre-Java 5), collections stored everything as `Object`. This meant you had to cast on retrieval, and the compiler could not protect you from putting the wrong type in.

```java
import java.util.ArrayList;

// The old way -- no type safety
ArrayList accounts = new ArrayList();
accounts.add("ACC-1001");
accounts.add(12345); // no compile error, but logically wrong

String id = (String) accounts.get(1); // ClassCastException at runtime!
```

With generics, the compiler enforces types:

```java
import java.util.ArrayList;

// The generic way -- type-safe
ArrayList<String> accounts = new ArrayList<>();
accounts.add("ACC-1001");
// accounts.add(12345); // compile error! caught immediately

String id = accounts.get(0); // no cast needed
```

In banking, a `ClassCastException` in production could mean a failed transaction or corrupted data. Generics eliminate this entire category of bugs.

### Generic Classes

You can define your own generic classes using type parameters. The convention uses single uppercase letters: `T` (Type), `E` (Element), `K` (Key), `V` (Value).

```java
public class Vault<T> {
    private T contents;

    public void store(T item) {
        this.contents = item;
    }

    public T retrieve() {
        return contents;
    }
}

// Usage
Vault<String> documentVault = new Vault<>();
documentVault.store("Loan Agreement #4521");
String doc = documentVault.retrieve(); // type-safe, no casting

Vault<Double> cashVault = new Vault<>();
cashVault.store(1000000.0);
double cash = cashVault.retrieve();
```

The same `Vault` class works with any type, but once you declare `Vault<String>`, the compiler ensures only strings go in and come out.

### Generic Methods

Methods can have their own type parameters, independent of the class. This is useful for utility methods.

```java
public class BankUtils {
    // Generic method -- <T> declares the type parameter before return type
    public static <T> void printRecord(String label, T record) {
        System.out.println(label + ": " + record);
    }

    public static <T> T getFirst(java.util.List<T> items) {
        if (items.isEmpty()) return null;
        return items.get(0);
    }
}

// Usage -- type is inferred from arguments
BankUtils.printRecord("Account", "ACC-1001");
BankUtils.printRecord("Balance", 15000.0);
```

### Bounded Types

Sometimes you need to restrict what types can be used. Bounded type parameters let you specify that a type must extend a class or implement an interface.

```java
// T must be a subtype of Number (Integer, Double, etc.)
public class AccountSummary<T extends Number> {
    private T balance;

    public AccountSummary(T balance) {
        this.balance = balance;
    }

    public double getBalanceAsDouble() {
        return balance.doubleValue(); // safe because T extends Number
    }
}

// Valid
AccountSummary<Double> savings = new AccountSummary<>(5000.0);
AccountSummary<Integer> points = new AccountSummary<>(1200);

// Invalid -- compile error
// AccountSummary<String> invalid = new AccountSummary<>("nope");
```

### Wildcards: ?, ? extends, ? super

Wildcards add flexibility when you work with generic types in method parameters.

- `?` -- unbounded wildcard, accepts any type
- `? extends T` -- upper-bounded, accepts T or any subtype (for reading)
- `? super T` -- lower-bounded, accepts T or any supertype (for writing)

```java
import java.util.List;
import java.util.ArrayList;

// Read from a list of any Number subtype
public static double sumBalances(List<? extends Number> balances) {
    double total = 0;
    for (Number balance : balances) {
        total += balance.doubleValue();
    }
    return total;
}

// Works with List<Integer>, List<Double>, etc.
List<Integer> intBalances = List.of(1000, 2000, 3000);
List<Double> doubleBalances = List.of(1500.5, 2500.75);
double total1 = sumBalances(intBalances);   // works
double total2 = sumBalances(doubleBalances); // works
```

### Type Erasure and PECS

**Type erasure** is how Java implements generics. At compile time, the compiler checks all generic types for safety. At runtime, all generic type information is removed (erased) and replaced with `Object` or the bound type. This means `List<String>` and `List<Integer>` are the same class at runtime.

```java
List<String> names = new ArrayList<>();
List<Integer> numbers = new ArrayList<>();
// At runtime, both are just ArrayList -- type info is erased
System.out.println(names.getClass() == numbers.getClass()); // true
```

**The PECS principle** -- Producer Extends, Consumer Super -- guides wildcard usage:

- If you are **reading** (producing) from a generic structure, use `? extends T`
- If you are **writing** (consuming) into a generic structure, use `? super T`

```java
// Producer Extends -- reading transaction records
public static void printAll(List<? extends Object> items) {
    for (Object item : items) {
        System.out.println(item);
    }
}

// Consumer Super -- adding transactions to a collection
public static void addDefaults(List<? super String> list) {
    list.add("Opening Balance");
    list.add("Initial Deposit");
}
```

## Why It Matters

Banking systems are built on reusable components -- transaction processors, data validators, report generators -- that must handle different data types safely. Generics are the foundation of this reusability. In interviews, expect questions about type erasure, wildcard bounds, and when to use `extends` vs `super`. Understanding generics deeply shows you can write production-grade Java that is both flexible and safe.

## Challenge

Create a generic `TransactionLog<T>` class that stores a list of items internally. It should have an `add(T item)` method to add entries and a `getAll()` method that returns the list. In `main`, create a `TransactionLog<String>`, add three transaction descriptions, then print all of them.

## Starter Code
```java
import java.util.ArrayList;
import java.util.List;

// Define the generic TransactionLog<T> class here

public class TransactionLogApp {
    public static void main(String[] args) {
        // Create a TransactionLog<String>

        // Add three transactions: "Deposit $500", "Withdrawal $200", "Transfer $1000"

        // Print all transactions
        System.out.println("Transaction Log:");
    }
}
```

## Expected Output
```
Transaction Log:
Deposit $500
Withdrawal $200
Transfer $1000
```

## Hint

Define `TransactionLog<T>` with a private `ArrayList<T>` field. The `add()` method appends to this list, and `getAll()` returns it. Then iterate over `getAll()` in `main` to print each entry.

## Solution
```java
import java.util.ArrayList;
import java.util.List;

class TransactionLog<T> {
    private List<T> entries = new ArrayList<>();

    public void add(T item) {
        entries.add(item);
    }

    public List<T> getAll() {
        return entries;
    }
}

public class TransactionLogApp {
    public static void main(String[] args) {
        TransactionLog<String> log = new TransactionLog<>();

        log.add("Deposit $500");
        log.add("Withdrawal $200");
        log.add("Transfer $1000");

        System.out.println("Transaction Log:");
        for (String entry : log.getAll()) {
            System.out.println(entry);
        }
    }
}
```
