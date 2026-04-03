---
id: "inheritance"
moduleId: "oop"
title: "Inheritance"
description: "Create specialized account types using extends and understand the Object class."
order: 3
---

## Banking Scenario

JavaBank offers multiple account types: savings accounts, checking accounts, business accounts, and more. Each one shares common properties — an account number, holder name, and balance — but also has unique features. A savings account earns interest. A checking account has an overdraft limit. A business account tracks a company tax ID.

Writing a completely separate class for each account type would mean duplicating all the shared code: the same fields, the same constructors, the same deposit and withdraw logic. When a bug is found in the deposit method, you would have to fix it in every single class. Inheritance solves this problem by letting you define the common behavior once in a parent class and then **extend** it with specialized behavior in child classes.

## Content

### The `extends` Keyword

In Java, a class can inherit from another class using the `extends` keyword. The child class (also called a subclass) automatically receives all non-private fields and methods from the parent class (also called a superclass). Java supports **single inheritance** only — a class can extend exactly one parent.

```java
public class BankAccount {
    protected int accountNumber;
    protected String holderName;
    protected double balance;

    public BankAccount(int accountNumber, String holderName, double balance) {
        this.accountNumber = accountNumber;
        this.holderName = holderName;
        this.balance = balance;
    }

    public String describe() {
        return "Account: General Account\nHolder: " + holderName + "\nBalance: " + balance;
    }
}

public class SavingsAccount extends BankAccount {
    private double interestRate;
    // SavingsAccount inherits accountNumber, holderName, balance, and describe()
}
```

What gets inherited: all `public` and `protected` members. `private` members exist in the child object but cannot be accessed directly — you must use the parent's public or protected methods. Default (package-private) members are inherited only if the child is in the same package.

### The `super` Keyword and Constructor Chaining

A child class constructor **must** call the parent constructor as its first statement using `super()`. If you do not write a `super()` call, Java automatically inserts a call to the parent's no-argument constructor. If the parent does not have a no-argument constructor, the compiler will throw an error.

```java
public class SavingsAccount extends BankAccount {
    private double interestRate;

    public SavingsAccount(int accountNumber, String holderName, double balance, double interestRate) {
        super(accountNumber, holderName, balance);  // must be first line
        this.interestRate = interestRate;
    }
}
```

This is called **constructor chaining**. The parent's constructor runs first, initializing the inherited fields, and then the child's constructor runs to initialize its own fields. This guarantees that the object is fully constructed from the top of the hierarchy down.

You can also use `super` to call parent methods from a child class, which is especially useful when you want to extend (not replace) the parent's behavior.

### Method Overriding and `@Override`

A child class can **override** a parent method by defining a method with the same name, return type, and parameters. This allows the child to provide its own specialized implementation.

```java
public class SavingsAccount extends BankAccount {
    private double interestRate;

    public SavingsAccount(int accountNumber, String holderName, double balance, double interestRate) {
        super(accountNumber, holderName, balance);
        this.interestRate = interestRate;
    }

    @Override
    public String describe() {
        return "Account: Savings Account\nHolder: " + holderName
                + "\nBalance: " + balance + "\nInterest Rate: " + interestRate + "%";
    }
}
```

The `@Override` annotation is not strictly required, but you should always use it. It tells the compiler to verify that you are actually overriding a parent method. If you accidentally misspell the method name or use the wrong parameters, the compiler will catch your mistake instead of silently creating a new method.

### The Object Class

Every class in Java implicitly extends `java.lang.Object`. This means every object you create has access to methods defined in `Object`, including:

- `toString()` — returns a string representation. By default it returns something like `BankAccount@1a2b3c`. Override it to provide meaningful output.
- `equals(Object obj)` — checks logical equality. By default it compares references (same as `==`). Override it to compare field values.
- `hashCode()` — returns a hash value. If you override `equals`, you must also override `hashCode` to maintain the contract that equal objects must have equal hash codes.

```java
@Override
public String toString() {
    return "BankAccount{number=" + accountNumber + ", holder='" + holderName + "', balance=" + balance + "}";
}

@Override
public boolean equals(Object obj) {
    if (this == obj) return true;
    if (obj == null || getClass() != obj.getClass()) return false;
    BankAccount that = (BankAccount) obj;
    return accountNumber == that.accountNumber;
}

@Override
public int hashCode() {
    return Integer.hashCode(accountNumber);
}
```

In banking systems, overriding `equals` is critical when you need to look up accounts in collections like `HashMap` or `HashSet`. Two accounts with the same account number should be treated as the same entity.

### The `instanceof` Operator

The `instanceof` operator checks whether an object is an instance of a specific class or its subclass. It is commonly used before casting an object to a more specific type.

```java
BankAccount account = new SavingsAccount(101, "Alice", 5000.0, 3.5);

if (account instanceof SavingsAccount) {
    SavingsAccount sa = (SavingsAccount) account;
    System.out.println("Interest rate: " + sa.getInterestRate());
}
```

Since Java 16, you can use **pattern matching** with `instanceof` to combine the check and the cast in one step:

```java
if (account instanceof SavingsAccount sa) {
    System.out.println("Interest rate: " + sa.getInterestRate());
}
```

In banking applications, `instanceof` appears when processing mixed lists of accounts — for example, applying interest only to savings accounts within a list of general accounts.

## Why It Matters

Inheritance is one of the most commonly tested OOP concepts in Java interviews. You will be asked to design class hierarchies, explain how constructor chaining works, and discuss when to override `toString` and `equals`. Beyond interviews, inheritance lets banking teams build extensible systems where new account types can be added without modifying existing code. Understanding the Object class and its contract is essential for working with Java collections, which are at the heart of any data-heavy financial application.

## Challenge

Create a `BankAccount` class with `protected` fields for `accountNumber` (int), `holderName` (String), and `balance` (double), plus a constructor and a `describe()` method that returns a generic description. Then create a `SavingsAccount` class that extends `BankAccount`, adds an `interestRate` (double) field, and overrides `describe()` to include the interest rate. In your `main` method, create a `SavingsAccount` for "Bob Chen" with account 3001, balance 10000.0, and interest rate 3.5, then print the result of `describe()`.

## Starter Code

```java
class BankAccount {
    // TODO: Declare protected fields

    // TODO: Constructor

    // TODO: describe() method
}

class SavingsAccount extends BankAccount {
    // TODO: Add interestRate field

    // TODO: Constructor using super()

    // TODO: Override describe()
}

public class Main {
    public static void main(String[] args) {
        // TODO: Create SavingsAccount and print describe()
    }
}
```

## Expected Output

```
Account: Savings Account
Holder: Bob Chen
Balance: 10000.0
Interest Rate: 3.5%
```

## Hint

The `SavingsAccount` constructor should call `super(accountNumber, holderName, balance)` as its first line to initialize the inherited fields, then set `this.interestRate`. In the overridden `describe()` method, build a string that includes all four pieces of information.

## Solution

```java
class BankAccount {
    protected int accountNumber;
    protected String holderName;
    protected double balance;

    public BankAccount(int accountNumber, String holderName, double balance) {
        this.accountNumber = accountNumber;
        this.holderName = holderName;
        this.balance = balance;
    }

    public String describe() {
        return "Account: General Account\nHolder: " + holderName + "\nBalance: " + balance;
    }
}

class SavingsAccount extends BankAccount {
    private double interestRate;

    public SavingsAccount(int accountNumber, String holderName, double balance, double interestRate) {
        super(accountNumber, holderName, balance);
        this.interestRate = interestRate;
    }

    @Override
    public String describe() {
        return "Account: Savings Account\nHolder: " + holderName
                + "\nBalance: " + balance + "\nInterest Rate: " + interestRate + "%";
    }
}

public class Main {
    public static void main(String[] args) {
        SavingsAccount account = new SavingsAccount(3001, "Bob Chen", 10000.0, 3.5);
        System.out.println(account.describe());
    }
}
```
