---
id: "control-flow"
moduleId: "java-basics"
title: "Control Flow"
description: "Use if/else statements to approve or deny bank transactions based on account balance."
order: 3
---

## Banking Scenario

### The Scenario

You're building the **transaction processing engine** at JavaBank. Every time a customer initiates a withdrawal — whether at an ATM, online, or through mobile banking — your system must decide whether to approve or deny the transaction.

The rules are simple but critical: if the customer's balance is greater than or equal to the withdrawal amount, approve it and deduct the funds. Otherwise, deny the transaction and show the current balance. In a production system, this logic runs inside a database transaction to prevent race conditions, but the core decision is a straightforward if/else check. Getting this wrong could mean allowing overdrafts or incorrectly blocking legitimate transactions.

## Content

## Control Flow

Control flow statements let your program make decisions. Instead of executing every line top to bottom, your code can branch based on conditions — this is what makes software intelligent.

### The if Statement

The simplest form of control flow checks a single condition:

```java
double balance = 3000.0;

if (balance > 0) {
    System.out.println("Account is in good standing.");
}
```

### if-else

When you need to handle two cases — the condition being true or false:

```java
double withdrawalAmount = 500.0;
double balance = 300.0;

if (balance >= withdrawalAmount) {
    System.out.println("Withdrawal approved.");
} else {
    System.out.println("Insufficient funds.");
}
```

### if-else if-else Chains

For multiple conditions, chain them together. Java evaluates each condition in order and executes the first block that matches:

```java
double balance = 15000.0;

if (balance >= 50000) {
    System.out.println("Tier: Platinum");
} else if (balance >= 10000) {
    System.out.println("Tier: Gold");
} else if (balance >= 1000) {
    System.out.println("Tier: Silver");
} else {
    System.out.println("Tier: Basic");
}
```

### Comparison & Logical Operators

Build conditions using comparison operators (`==`, `!=`, `>`, `<`, `>=`, `<=`) and combine them with logical operators:

```java
boolean isActive = true;
double balance = 5000.0;

if (isActive && balance >= 1000.0) {
    System.out.println("Eligible for rewards program.");
}

if (balance < 0 || !isActive) {
    System.out.println("Account requires review.");
}
```

## Why It Matters

Virtually every backend endpoint includes conditional logic. Authentication checks ("is the token valid?"), authorization ("does this user have permission?"), validation ("is the input within acceptable bounds?"), and business rules ("does the account qualify?") all rely on control flow. Mastering if/else is the first step toward writing backend services that enforce real business rules reliably.

## Challenge

Write a program that processes a bank withdrawal. Given:

- Balance: **2500.0**
- Withdrawal amount: **1800.0**

If the balance is **greater than or equal to** the withdrawal amount:
1. Print "Transaction Approved"
2. Subtract the amount from the balance
3. Print the new balance as "New Balance: X"

Otherwise:
1. Print "Transaction Denied"
2. Print "Current Balance: X"

## Starter Code

```java
public class TransactionProcessor {
    public static void main(String[] args) {
        double balance = 2500.0;
        double withdrawalAmount = 1800.0;

        // Write your if/else logic here


    }
}
```

## Expected Output

```
Transaction Approved
New Balance: 700.0
```

## Hint

Use >= to check if the balance covers the withdrawal. Inside the if block, update the balance with balance = balance - withdrawalAmount (or balance -= withdrawalAmount) before printing it.

## Solution

```java
public class TransactionProcessor {
    public static void main(String[] args) {
        double balance = 2500.0;
        double withdrawalAmount = 1800.0;

        if (balance >= withdrawalAmount) {
            System.out.println("Transaction Approved");
            balance -= withdrawalAmount;
            System.out.println("New Balance: " + balance);
        } else {
            System.out.println("Transaction Denied");
            System.out.println("Current Balance: " + balance);
        }
    }
}
```
