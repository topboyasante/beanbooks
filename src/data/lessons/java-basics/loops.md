---
id: "loops"
moduleId: "java-basics"
title: "Loops"
description: "Use for loops to generate monthly bank statements and compute compound interest growth."
order: 4
---

## Banking Scenario

### The Scenario

JavaBank wants to give customers a **12-month projection** of their savings growth. When a customer opens a savings account, the system should show how their initial deposit grows each month with compound interest.

The bank's savings account pays a monthly interest rate of **0.4%** (roughly 4.8% annually). Each month, interest is calculated on the current balance (not just the original deposit), and then added to the balance. This is compound interest — the balance grows faster over time because you earn interest on previously earned interest. Your job is to write the code that generates this projection for any given starting balance.

## Content

## Loops

Loops let you repeat a block of code multiple times. They're essential when you need to process collections of data, generate reports, or perform iterative calculations.

### The for Loop

The most common loop in Java. It has three parts: initialization, condition, and update.

```java
for (int i = 1; i <= 5; i++) {
    System.out.println("Month " + i);
}
```

This prints "Month 1" through "Month 5". The variable `i` starts at 1, the loop continues while `i <= 5`, and `i++` increments it after each iteration.

### Using Loops for Calculations

Loops are powerful for iterative computations like compound interest, where each step depends on the previous result:

```java
double balance = 1000.0;
double monthlyRate = 0.005; // 0.5% per month

for (int month = 1; month <= 6; month++) {
    double interest = balance * monthlyRate;
    balance += interest;
    System.out.println("Month " + month + ": $" + balance);
}
```

### The while Loop

Use `while` when you don't know in advance how many iterations you need:

```java
double balance = 1000.0;
double target = 2000.0;
double annualRate = 0.07;
int years = 0;

while (balance < target) {
    balance *= (1 + annualRate);
    years++;
}
System.out.println("Years to double: " + years);
```

### Loop Control: break and continue

Use `break` to exit a loop early and `continue` to skip to the next iteration:

```java
for (int i = 1; i <= 100; i++) {
    if (i % 10 != 0) continue; // skip non-multiples of 10
    System.out.println("Processing batch " + i);
    if (i == 50) break; // stop at 50
}
```

## Why It Matters

Backend systems are full of loops: iterating over database result sets, processing message queues, generating reports, running batch jobs, and paginating API responses. Understanding loops — especially how to accumulate values and track state across iterations — is critical. In financial systems, compound interest calculations and amortization schedules are some of the most common iterative computations you'll implement.

## Challenge

Write a program that projects **12 months of compound interest** growth.

- Starting balance: **10000.0**
- Monthly interest rate: **0.004** (0.4%)

For each month (1 through 12):
1. Calculate the interest for that month: `balance * monthlyRate`
2. Add the interest to the balance
3. Print the month number and new balance, formatted as: `"Month X: $Y"`

Use `Math.round(balance * 100.0) / 100.0` to round to 2 decimal places before printing.

## Starter Code

```java
public class SavingsProjection {
    public static void main(String[] args) {
        double balance = 10000.0;
        double monthlyRate = 0.004;

        // Write a for loop for months 1 through 12


    }
}
```

## Expected Output

```
Month 1: $10040.0
Month 2: $10080.16
Month 3: $10120.48
Month 4: $10160.96
Month 5: $10201.61
Month 6: $10242.42
Month 7: $10283.39
Month 8: $10324.52
Month 9: $10365.82
Month 10: $10407.28
Month 11: $10448.91
Month 12: $10490.7
```

## Hint

Inside the loop, first compute interest = balance * monthlyRate, then update balance += interest. Before printing, round with Math.round(balance * 100.0) / 100.0. The key thing is that each month's interest is calculated on the updated balance, not the original.

## Solution

```java
public class SavingsProjection {
    public static void main(String[] args) {
        double balance = 10000.0;
        double monthlyRate = 0.004;

        for (int month = 1; month <= 12; month++) {
            double interest = balance * monthlyRate;
            balance += interest;
            balance = Math.round(balance * 100.0) / 100.0;
            System.out.println("Month " + month + ": $" + balance);
        }
    }
}
```
