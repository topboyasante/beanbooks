---
id: "operators-and-expressions"
moduleId: "java-basics"
title: "Operators & Expressions"
description: "Use arithmetic and assignment operators to perform interest calculations on bank accounts."
order: 2
---

## Banking Scenario

### The Scenario

A customer at JavaBank wants to know how much interest they'll earn on a fixed deposit. The bank offers a **simple interest** product: the customer deposits a principal amount, and after a set number of years at a fixed annual rate, they receive the interest earned.

The formula is straightforward: **Interest = Principal x Rate x Time**. But your manager also wants the program to display the total amount the customer will receive (principal + interest). This is a routine calculation that runs thousands of times daily in the bank's backend systems whenever customers check projected earnings on their deposits.

## Content

## Operators & Expressions

Operators are symbols that perform operations on variables and values. In Java, you'll use them constantly to calculate balances, apply fees, compute interest, and transform data.

### Arithmetic Operators

The basic arithmetic operators work exactly as you'd expect:

```java
double balance = 1000.0;
double deposit = 250.0;
double newBalance = balance + deposit;  // 1250.0

double fee = 15.0;
double afterFee = newBalance - fee;     // 1235.0

double interestRate = 0.05;
double interest = balance * interestRate; // 50.0
```

The modulus operator `%` returns the remainder of a division, which is useful for determining if values are even/odd or for cycling through options:

```java
int months = 14;
int extraMonths = months % 12; // 2 (the remainder after full years)
```

### Assignment Operators

Java provides shorthand operators that combine arithmetic with assignment:

```java
double balance = 5000.0;
balance += 200.0;  // same as balance = balance + 200.0 → 5200.0
balance -= 50.0;   // same as balance = balance - 50.0  → 5150.0
balance *= 1.05;   // same as balance = balance * 1.05  → 5407.5
```

### Order of Operations

Java follows standard mathematical precedence (PEMDAS). Use parentheses to make your intent clear:

```java
// Simple interest formula: I = P * R * T
double principal = 10000.0;
double rate = 0.06;
int time = 3;
double interest = principal * rate * time; // 1800.0
```

### Type Casting

When you mix types, Java automatically promotes to the wider type. But sometimes you need explicit casting:

```java
int totalCents = 1599;
double dollars = totalCents / 100.0; // 15.99 (100.0 forces double division)
```

## Why It Matters

Financial calculations are at the heart of every banking backend. Whether you're computing loan payments, foreign exchange conversions, or investment returns, you need to write expressions that are mathematically correct and precise. A misplaced operator or incorrect order of operations can mean charging a customer the wrong interest — a compliance violation that can cost a bank millions in fines.

## Challenge

Write a program that calculates **simple interest** and the **total amount** for a fixed deposit.

Use these values:
- Principal: **25000.0**
- Annual rate: **0.065** (6.5%)
- Time: **4** years

Calculate the interest using the formula `I = P * R * T`, then compute the total amount (`principal + interest`). Print both results.

## Starter Code

```java
public class InterestCalculator {
    public static void main(String[] args) {
        // Declare principal, rate, and time
        double principal = 25000.0;
        double rate = 0.065;
        int time = 4;

        // Calculate simple interest: I = P * R * T
        double interest;

        // Calculate total amount: principal + interest
        double totalAmount;

        // Print the results
        System.out.println("Interest Earned: " + interest);
        System.out.println("Total Amount: " + totalAmount);
    }
}
```

## Expected Output

```
Interest Earned: 6500.0
Total Amount: 31500.0
```

## Hint

Simple interest is just multiplication: principal * rate * time. Make sure you assign the result to the interest variable, then add it to the principal for the total amount.

## Solution

```java
public class InterestCalculator {
    public static void main(String[] args) {
        double principal = 25000.0;
        double rate = 0.065;
        int time = 4;

        double interest = principal * rate * time;
        double totalAmount = principal + interest;

        System.out.println("Interest Earned: " + interest);
        System.out.println("Total Amount: " + totalAmount);
    }
}
```
