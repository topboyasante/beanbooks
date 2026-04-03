---
id: "classes-and-objects"
moduleId: "oop"
title: "Classes & Objects"
description: "Design a BankAccount class with fields, constructors, and methods."
order: 1
---

## Banking Scenario

Every banking system starts with a fundamental question: how do we represent a bank account in code? In a real bank, an account is not just a number in a spreadsheet. It has an account number, a holder's name, a balance, and behaviors like depositing and withdrawing money. Before object-oriented programming, developers used scattered variables and functions to manage this data, which quickly became unmanageable as the system grew.

At JavaBank, your team is building the core domain model from scratch. The architects have decided to use object-oriented design, where each bank account is represented as a self-contained **object** that bundles its data and behavior together. Your first task is to define what a BankAccount looks like and how it behaves.

## Content

### Classes vs Objects

A **class** is a blueprint or template. It defines what data an entity holds (fields) and what it can do (methods). An **object** is a specific instance created from that blueprint. Think of it this way: the class `BankAccount` is the architectural plan, while Alice's account with balance $2,500 is a concrete object built from that plan.

```java
// Class = blueprint
class BankAccount {
    int accountNumber;
    String holderName;
    double balance;
}

// Object = instance built from the blueprint
BankAccount aliceAccount = new BankAccount();
```

You can create as many objects as you need from a single class. Each object has its own copy of the fields, so changing Alice's balance does not affect Bob's balance.

### Fields (Instance Variables)

Fields are variables declared inside a class but outside any method. They represent the **state** of an object. Each object gets its own copy of these fields. In banking, fields map directly to the columns you would see in an `accounts` database table: account number, holder name, balance, and so on.

```java
class BankAccount {
    int accountNumber;
    String holderName;
    double balance;
}
```

Fields that are not explicitly initialized receive default values: `0` for numeric types, `null` for reference types, and `false` for booleans. In production code, you should always initialize fields explicitly through constructors to avoid bugs caused by relying on defaults.

### Constructors

A constructor is a special method that runs when you create a new object using the `new` keyword. Its job is to initialize the object's fields. If you do not write any constructor, Java provides a **default constructor** with no parameters that sets all fields to their default values.

A **parameterized constructor** lets you pass in values at creation time, ensuring every object starts in a valid state. In banking, you never want an account with a `null` holder name or a zero account number floating around in your system.

```java
class BankAccount {
    int accountNumber;
    String holderName;
    double balance;

    // Default constructor
    BankAccount() {
        this.accountNumber = 0;
        this.holderName = "Unknown";
        this.balance = 0.0;
    }

    // Parameterized constructor
    BankAccount(int accountNumber, String holderName, double balance) {
        this.accountNumber = accountNumber;
        this.holderName = holderName;
        this.balance = balance;
    }
}
```

### The `this` Keyword

The `this` keyword refers to the **current object** — the specific instance whose method or constructor is being called. It is most commonly used when a constructor parameter has the same name as a field. Without `this`, the compiler would think you are assigning the parameter to itself.

```java
BankAccount(int accountNumber, String holderName, double balance) {
    this.accountNumber = accountNumber;   // field = parameter
    this.holderName = holderName;
    this.balance = balance;
}
```

`this` can also be used to call one constructor from another, which is known as constructor chaining:

```java
BankAccount(int accountNumber, String holderName) {
    this(accountNumber, holderName, 0.0);  // calls the 3-param constructor
}
```

### The `new` Keyword, Object References, and Memory

When you write `new BankAccount(101, "Alice", 2500.0)`, two things happen in memory. First, Java allocates space on the **heap** to store the object's fields. Second, the variable `aliceAccount` on the **stack** stores a **reference** (essentially a memory address) pointing to that heap object.

```java
BankAccount aliceAccount = new BankAccount(101, "Alice", 2500.0);
```

This means that when you assign one object variable to another, you are copying the reference, not the object itself. Both variables now point to the same object on the heap:

```java
BankAccount backup = aliceAccount;  // both point to the same object
backup.balance = 9999.0;
System.out.println(aliceAccount.balance);  // prints 9999.0
```

Understanding this distinction is critical in banking systems. If you accidentally share references when you intended to create independent copies, one part of the code could modify an account balance that another part is still using for a transaction, leading to data corruption.

### Methods

Methods define the **behavior** of an object. In banking, typical behaviors include depositing funds, withdrawing funds, and checking the balance. A method has access to the object's fields through `this` (implicitly or explicitly).

```java
class BankAccount {
    int accountNumber;
    String holderName;
    double balance;

    BankAccount(int accountNumber, String holderName, double balance) {
        this.accountNumber = accountNumber;
        this.holderName = holderName;
        this.balance = balance;
    }

    void deposit(double amount) {
        this.balance += amount;
    }

    double getBalance() {
        return this.balance;
    }
}
```

A well-designed method does one thing and does it clearly. The `deposit` method modifies state, while `getBalance` only reads it. This separation makes your code easier to reason about and test.

## Why It Matters

Classes and objects are the backbone of every enterprise Java application. In a bank, the domain model — accounts, customers, transactions, loans — is built entirely from classes. When you sit down for a Java developer interview at a bank, you will be expected to design classes from scratch, explain how objects live in memory, and reason about what happens when references are shared. Mastering these fundamentals makes everything that follows in OOP — encapsulation, inheritance, polymorphism — click into place.

## Challenge

Create a `BankAccount` class with three fields: `accountNumber` (int), `holderName` (String), and `balance` (double). Write a parameterized constructor that accepts all three values. Add a `deposit(double amount)` method that increases the balance and a `getBalance()` method that returns the current balance. In your `main` method, create an account for "Alice Martin" with account number 1001 and an initial balance of 2500.0, deposit 500, then print the holder name and the balance after the deposit.

## Starter Code

```java
public class BankAccount {
    // TODO: Declare fields: accountNumber (int), holderName (String), balance (double)

    // TODO: Create a parameterized constructor

    // TODO: Add deposit() method

    // TODO: Add getBalance() method

    public static void main(String[] args) {
        // TODO: Create a BankAccount for "Alice Martin", account 1001, balance 2500.0
        // TODO: Deposit 500
        // TODO: Print holder name and balance
    }
}
```

## Expected Output

```
Account Holder: Alice Martin
Balance after deposit: 3000.0
```

## Hint

Remember that the constructor should use the `this` keyword to distinguish between the field names and the parameter names. The `deposit` method simply adds the amount to `this.balance`.

## Solution

```java
public class BankAccount {
    int accountNumber;
    String holderName;
    double balance;

    BankAccount(int accountNumber, String holderName, double balance) {
        this.accountNumber = accountNumber;
        this.holderName = holderName;
        this.balance = balance;
    }

    void deposit(double amount) {
        this.balance += amount;
    }

    double getBalance() {
        return this.balance;
    }

    public static void main(String[] args) {
        BankAccount account = new BankAccount(1001, "Alice Martin", 2500.0);
        account.deposit(500);
        System.out.println("Account Holder: " + account.holderName);
        System.out.println("Balance after deposit: " + account.getBalance());
    }
}
```
