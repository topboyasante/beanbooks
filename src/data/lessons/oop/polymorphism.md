---
id: "polymorphism"
moduleId: "oop"
title: "Polymorphism"
description: "Write flexible code with runtime polymorphism and abstract classes."
order: 4
---

## Banking Scenario

JavaBank's fee processing system needs to calculate monthly maintenance fees for every account. The problem is that different account types have different fee structures: savings accounts have no monthly fee, checking accounts charge a flat $12.50, and business accounts charge $25.00. The fee engine should not need to know the specific type of each account. It should simply ask each account "what is your fee?" and get the right answer.

This is the essence of polymorphism — writing code that works with a general type while the specific behavior is determined at runtime by the actual object. The fee engine processes a list of `Account` objects without caring whether each one is a savings, checking, or business account. The right `calculateFee()` method is called automatically.

## Content

### What Is Polymorphism?

Polymorphism means "many forms." In Java, it allows a single method call to behave differently depending on the actual type of the object. There are two kinds: **compile-time polymorphism** (method overloading) and **runtime polymorphism** (method overriding). Runtime polymorphism is the more powerful and more frequently tested concept.

The key mechanism is this: when you call a method on a reference of a parent type, Java looks at the **actual object** at runtime to decide which version of the method to execute. This is called **dynamic method dispatch**.

### Compile-Time Polymorphism (Method Overloading)

Method overloading means defining multiple methods with the same name but different parameter lists within the same class. The compiler decides which method to call based on the arguments you pass.

```java
public class TransactionProcessor {
    public void transfer(double amount) {
        System.out.println("Transferring $" + amount + " domestically");
    }

    public void transfer(double amount, String currency) {
        System.out.println("Transferring $" + amount + " internationally in " + currency);
    }

    public void transfer(double amount, String currency, double exchangeRate) {
        double converted = amount * exchangeRate;
        System.out.println("Transferring " + converted + " " + currency);
    }
}
```

Overloading is resolved at **compile time** based on the number and types of arguments. It is not true polymorphism in the OOP sense, but it is a form of polymorphism that makes APIs more convenient to use.

### Runtime Polymorphism (Method Overriding)

Runtime polymorphism happens when a child class overrides a method from its parent, and you call that method through a parent-type reference. The JVM determines at runtime which version of the method to execute based on the actual object type.

```java
Account account = new CheckingAccount(101, "Alice", 5000.0);
System.out.println(account.calculateFee());  // calls CheckingAccount's version
```

Even though the variable type is `Account`, the object is a `CheckingAccount`, so the overridden `calculateFee()` in `CheckingAccount` runs. This is the foundation of writing flexible, extensible code.

### Upcasting and Downcasting

**Upcasting** is assigning a child object to a parent-type variable. It is always safe and happens implicitly:

```java
Account account = new SavingsAccount(101, "Alice", 5000.0);  // upcast
```

**Downcasting** is converting a parent-type reference back to a child type. It requires an explicit cast and can throw a `ClassCastException` if the object is not actually of that type:

```java
if (account instanceof SavingsAccount) {
    SavingsAccount sa = (SavingsAccount) account;  // safe downcast
}
```

Upcasting is the key to polymorphism. When a method accepts an `Account` parameter, you can pass in any subclass. The method does not need to know or care about the specific type.

### Abstract Classes and Abstract Methods

An **abstract class** is a class that cannot be instantiated directly. It exists only to be extended by concrete subclasses. An **abstract method** is a method with no body — it declares the signature but forces subclasses to provide the implementation.

```java
public abstract class Account {
    protected int accountNumber;
    protected String holderName;
    protected double balance;

    public Account(int accountNumber, String holderName, double balance) {
        this.accountNumber = accountNumber;
        this.holderName = holderName;
        this.balance = balance;
    }

    public abstract double calculateFee();

    public void printSummary() {
        System.out.println("Account #" + accountNumber + " - " + holderName);
    }
}
```

Abstract classes can have both abstract methods (which subclasses must override) and concrete methods (which provide shared implementation). If a subclass does not implement all abstract methods, it must also be declared abstract.

### When to Use Abstract vs Concrete Classes

Use an abstract class when you have a concept that should never be instantiated on its own but provides shared state or behavior. In banking, you would never create a plain "Account" — it is always a savings account, checking account, or some other specific type. The abstract class provides the shared fields and methods, while forcing each subtype to implement its own fee calculation, interest logic, or transaction rules.

Use a concrete class when the class represents a complete, usable entity. A `TransactionRecord` with a date, amount, and description is fully formed and does not need specialization.

The power of coding to abstractions is that you can write methods like `processAllFees(Account[] accounts)` that work with any account type, existing or future. When a new account type is added next year, the fee processing code does not need to change at all.

```java
public static void processAllFees(Account[] accounts) {
    for (Account account : accounts) {
        System.out.println("Fee: " + account.calculateFee());
    }
}
```

## Why It Matters

Polymorphism is arguably the most important concept in OOP and a guaranteed interview topic at any Java bank role. Interviewers test whether you can design systems that are open for extension but closed for modification. In production banking systems, polymorphism enables fee engines, transaction processors, and reporting systems that handle dozens of account types without giant `if-else` chains. Understanding abstract classes gives you the ability to enforce contracts across your codebase, ensuring that every account type implements required business logic.

## Challenge

Create an abstract class `Account` with a protected `holderName` field, a constructor, and an abstract method `calculateFee()` that returns a `double`. Create two subclasses: `SavingsAccount` (fee returns 0.0) and `CheckingAccount` (fee returns 12.5). In `main`, create an array of `Account` objects containing one of each type, loop through the array, and print each account's fee.

## Starter Code

```java
abstract class Account {
    // TODO: protected holderName field

    // TODO: Constructor

    // TODO: Abstract calculateFee() method
}

class SavingsAccount extends Account {
    // TODO: Constructor and calculateFee()
}

class CheckingAccount extends Account {
    // TODO: Constructor and calculateFee()
}

public class Main {
    public static void main(String[] args) {
        // TODO: Create Account array, loop and print fees
    }
}
```

## Expected Output

```
Savings Fee: 0.0
Checking Fee: 12.5
```

## Hint

Declare the array as `Account[]` so it can hold both `SavingsAccount` and `CheckingAccount` objects. In the loop, calling `calculateFee()` on each element will invoke the correct overridden version thanks to runtime polymorphism.

## Solution

```java
abstract class Account {
    protected String holderName;

    public Account(String holderName) {
        this.holderName = holderName;
    }

    public abstract double calculateFee();
}

class SavingsAccount extends Account {
    public SavingsAccount(String holderName) {
        super(holderName);
    }

    @Override
    public double calculateFee() {
        return 0.0;
    }
}

class CheckingAccount extends Account {
    public CheckingAccount(String holderName) {
        super(holderName);
    }

    @Override
    public double calculateFee() {
        return 12.5;
    }
}

public class Main {
    public static void main(String[] args) {
        Account[] accounts = {
            new SavingsAccount("Alice"),
            new CheckingAccount("Bob")
        };

        for (Account account : accounts) {
            String type = account instanceof SavingsAccount ? "Savings" : "Checking";
            System.out.println(type + " Fee: " + account.calculateFee());
        }
    }
}
```
