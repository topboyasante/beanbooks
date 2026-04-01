---
id: "interfaces"
moduleId: "oop"
title: "Interfaces"
description: "Define contracts with interfaces and understand functional interfaces."
order: 5
---

## Banking Scenario

JavaBank is integrating with three different payment processors: domestic wire transfers, international SWIFT payments, and mobile wallet transactions. Each processor has completely different internal logic, but the bank's transaction engine needs to treat them uniformly. It should be able to call `process(amount)` on any processor without knowing which one it is.

Unlike inheritance, where you model an "is-a" relationship (a SavingsAccount is-a BankAccount), interfaces model a "can-do" relationship. A class that implements `Transactable` is declaring that it **can** perform deposits and withdrawals, regardless of what kind of class it is. This allows unrelated classes to share a common contract.

## Content

### Interface Declaration

An interface is a contract that defines method signatures without providing implementations (prior to Java 8). A class that implements an interface **must** provide concrete implementations of all its abstract methods.

```java
public interface Transactable {
    void deposit(double amount);
    void withdraw(double amount);
    double getBalance();
}
```

Interface methods are implicitly `public` and `abstract`, so you do not need to write those keywords (though you can). Fields in an interface are implicitly `public static final` — they are constants.

```java
public interface BankConstants {
    double MIN_BALANCE = 100.0;  // public static final by default
    int MAX_TRANSACTIONS_PER_DAY = 50;
}
```

### Implementing Multiple Interfaces

Unlike classes, where Java allows only single inheritance, a class can implement **multiple interfaces**. This is how Java achieves a form of multiple inheritance without the diamond problem.

```java
public interface Transactable {
    void deposit(double amount);
    void withdraw(double amount);
}

public interface Auditable {
    String getAuditLog();
}

public class BankAccount implements Transactable, Auditable {
    private double balance;
    private String lastAction;

    public BankAccount(double balance) {
        this.balance = balance;
        this.lastAction = "Account created";
    }

    @Override
    public void deposit(double amount) {
        this.balance += amount;
        this.lastAction = "Deposited " + amount;
    }

    @Override
    public void withdraw(double amount) {
        this.balance -= amount;
        this.lastAction = "Withdrew " + amount;
    }

    @Override
    public String getAuditLog() {
        return lastAction;
    }
}
```

When a class implements multiple interfaces, it must provide implementations for every abstract method from every interface. If it fails to do so, the class must be declared abstract.

### Default Methods (Java 8+)

Before Java 8, adding a new method to an interface would break every class that implements it. Default methods solve this by allowing interfaces to provide a method body. Implementing classes inherit the default behavior but can override it if needed.

```java
public interface Transactable {
    void deposit(double amount);
    void withdraw(double amount);

    default void transferTo(Transactable target, double amount) {
        this.withdraw(amount);
        target.deposit(amount);
        System.out.println("Transferred: " + amount);
    }
}
```

Default methods are a powerful tool for evolving interfaces without breaking backward compatibility. The Java standard library uses them extensively — for example, `List.sort()` and `Iterable.forEach()` were added as default methods in Java 8.

### Static Methods in Interfaces

Interfaces can also contain `static` methods, which belong to the interface itself rather than to any implementing class. These are useful for utility methods related to the interface's purpose.

```java
public interface Transactable {
    void deposit(double amount);

    static boolean isValidAmount(double amount) {
        return amount > 0;
    }
}

// Called on the interface, not on an instance
boolean valid = Transactable.isValidAmount(500.0);
```

### Functional Interfaces and `@FunctionalInterface`

A **functional interface** is an interface with exactly one abstract method. It can be used as the target for a lambda expression or method reference. The `@FunctionalInterface` annotation is optional but recommended — it tells the compiler to enforce the single-abstract-method rule.

```java
@FunctionalInterface
public interface TransactionValidator {
    boolean isValid(double amount);
}

// Used with a lambda
TransactionValidator validator = amount -> amount > 0 && amount < 1_000_000;
System.out.println(validator.isValid(500.0));  // true
```

Java provides built-in functional interfaces in `java.util.function`: `Predicate<T>`, `Function<T,R>`, `Consumer<T>`, and `Supplier<T>`. In banking, you might use a `Predicate<Transaction>` to filter suspicious transactions or a `Function<Account, Double>` to calculate fees.

### Comparable and Comparator

Two of the most important interfaces in Java are `Comparable` and `Comparator`. `Comparable` is implemented by a class to define its **natural ordering**. `Comparator` is a separate object that defines an **external ordering** strategy.

```java
public class BankAccount implements Comparable<BankAccount> {
    private int accountNumber;
    private double balance;

    @Override
    public int compareTo(BankAccount other) {
        return Integer.compare(this.accountNumber, other.accountNumber);
    }
}

// External comparator for sorting by balance
Comparator<BankAccount> byBalance = (a, b) -> Double.compare(a.getBalance(), b.getBalance());
```

In banking, `Comparable` might define the default sort by account number, while `Comparator` implementations sort by balance, holder name, or creation date depending on the report being generated.

### Interface vs Abstract Class

When should you use an interface versus an abstract class? Use an interface when you want to define a **contract** that unrelated classes can implement. Use an abstract class when you want to provide **shared state and behavior** to closely related classes.

| Feature             | Interface                    | Abstract Class               |
|---------------------|------------------------------|------------------------------|
| Multiple            | A class can implement many   | A class can extend only one  |
| Fields              | Only constants               | Instance variables allowed   |
| Constructors        | No                           | Yes                          |
| Method bodies       | Default/static only          | Any method can have a body   |
| Use case            | Capability contract          | Shared base implementation   |

In banking, `Transactable` is a good interface (any class might need transaction capability), while `Account` is a good abstract class (all account types share fields and core logic).

## Why It Matters

Interfaces are at the heart of Java's design philosophy and a staple of banking interviews. Interviewers will ask you to explain the difference between interfaces and abstract classes, design a system using interfaces for flexibility, or discuss how default methods changed interface evolution. In production banking code, interfaces enable dependency injection, testability (you can mock an interface), and loose coupling between modules. Understanding functional interfaces prepares you for lambdas and the Streams API, which are now standard in modern Java codebases.

## Challenge

Create a `Transactable` interface with two methods: `deposit(double amount)` and `withdraw(double amount)`. Create a `BankAccount` class that implements `Transactable`, with a private `balance` field initialized through the constructor and a `getBalance()` method. In `main`, create a `BankAccount` with balance 2500.0, deposit 1000.0, withdraw 250.0, and print each action and the final balance.

## Starter Code

```java
interface Transactable {
    // TODO: Declare deposit and withdraw methods
}

class BankAccount implements Transactable {
    // TODO: Private balance field, constructor, implement methods, getBalance()
}

public class Main {
    public static void main(String[] args) {
        // TODO: Create account, deposit, withdraw, print results
    }
}
```

## Expected Output

```
Deposited: 1000.0
Withdrew: 250.0
Final Balance: 3250.0
```

## Hint

The `deposit` method should add to the balance and print a confirmation. The `withdraw` method should subtract from the balance and print a confirmation. The final balance is the initial 2500.0 plus 1000.0 minus 250.0.

## Solution

```java
interface Transactable {
    void deposit(double amount);
    void withdraw(double amount);
}

class BankAccount implements Transactable {
    private double balance;

    public BankAccount(double balance) {
        this.balance = balance;
    }

    @Override
    public void deposit(double amount) {
        this.balance += amount;
        System.out.println("Deposited: " + amount);
    }

    @Override
    public void withdraw(double amount) {
        this.balance -= amount;
        System.out.println("Withdrew: " + amount);
    }

    public double getBalance() {
        return this.balance;
    }
}

public class Main {
    public static void main(String[] args) {
        BankAccount account = new BankAccount(2500.0);
        account.deposit(1000.0);
        account.withdraw(250.0);
        System.out.println("Final Balance: " + account.getBalance());
    }
}
```
