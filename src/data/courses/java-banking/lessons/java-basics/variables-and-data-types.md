---
id: "variables-and-data-types"
moduleId: "java-basics"
title: "Variables & Data Types"
description: "Learn how to declare and use variables by modeling a bank account with different data types."
order: 1
---

## Banking Scenario

### The Scenario

You've just been hired as a junior developer at **JavaBank**, a modern digital bank. Your first task is to build the data model for a customer's bank account.

Every bank account needs to store key information: an account number to uniquely identify it, the holder's name, the current balance, and whether the account is active. In a real banking system, these fields map directly to columns in a database table. Getting the data types right is critical — using an `int` where you need a `double` could mean losing cents on every transaction, which adds up to millions of dollars across thousands of customers.

## Content

## Variables & Data Types

In Java, every piece of data you work with must be stored in a **variable**. A variable is a named container that holds a value of a specific type. Java is a **statically typed** language, which means you must declare the type of a variable before you use it.

### Primitive Data Types

Java has eight primitive data types, but the ones you'll use most often in banking applications are:

- `int` — whole numbers (e.g., account number, transaction count)
- `double` — decimal numbers (e.g., balance, interest rate)
- `boolean` — true/false (e.g., is the account active?)
- `char` — a single character

```java
int accountNumber = 100234;
double balance = 5250.75;
boolean isActive = true;
```

### Reference Types

Beyond primitives, Java has **reference types** like `String`. A `String` represents a sequence of characters and is used for text data such as names, addresses, and descriptions.

```java
String accountHolder = "Jane Doe";
String accountType = "Savings";
```

### Declaring vs. Initializing

You can declare a variable without giving it a value, then assign one later. However, local variables must be initialized before use or the compiler will throw an error.

```java
double interestRate;          // declaration
interestRate = 0.045;         // initialization
String branch = "Downtown";  // declaration + initialization
```

### Printing Variables

Use `System.out.println()` to print values to the console. You can concatenate strings and variables using the `+` operator.

```java
System.out.println("Account: " + accountNumber);
System.out.println("Balance: $" + balance);
```

## Why It Matters

Understanding data types is the foundation of every backend system. In banking, choosing the wrong type can lead to rounding errors in financial calculations, data corruption, or security vulnerabilities. As a backend developer, you'll define database schemas, API request/response objects, and business logic — all of which start with knowing how to model data correctly in your programming language.

## Questions

Q: Which data type should you use for a bank account balance?
A) int
B) float
C) double
D) String
Correct: C

Q: What happens if you try to use a local variable before initializing it?
A) It defaults to 0
B) It defaults to null
C) The compiler throws an error
D) It runs but produces unexpected results
Correct: C

Q: What does "statically typed" mean in Java?
A) Variables cannot be reassigned
B) Variable types must be declared at compile time
C) Variables are stored in static memory
D) Types are determined at runtime
Correct: B

## Challenge

Declare variables for a bank account with the following details:

- Account number: **204871** (whole number)
- Account holder: **"Alice Martin"** (text)
- Balance: **12450.50** (decimal number)
- Active status: **true** (boolean)

Then print each variable on its own line using `System.out.println()`, prefixed with a label (e.g., "Account Number: 204871").

## Starter Code

```java
public class BankAccount {
    public static void main(String[] args) {
        // Declare your variables below
        int accountNumber;
        String accountHolder;
        double balance;
        boolean isActive;

        // Assign values to the variables


        // Print each variable with a label

    }
}
```

## Expected Output

```
Account Number: 204871
Account Holder: Alice Martin
Balance: 12450.5
Active: true
```

## Hint

Remember that String values need double quotes, and double values don't need any special suffix. Use the + operator to concatenate a label string with your variable, like: System.out.println("Label: " + variable);

## Solution

```java
public class BankAccount {
    public static void main(String[] args) {
        int accountNumber = 204871;
        String accountHolder = "Alice Martin";
        double balance = 12450.50;
        boolean isActive = true;

        System.out.println("Account Number: " + accountNumber);
        System.out.println("Account Holder: " + accountHolder);
        System.out.println("Balance: " + balance);
        System.out.println("Active: " + isActive);
    }
}
```
