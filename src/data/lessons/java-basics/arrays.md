---
id: "arrays"
moduleId: "java-basics"
title: "Arrays"
description: "Store and process transaction history using arrays to compute totals and summaries."
order: 5
---

## Banking Scenario

### The Scenario

At the end of each month, JavaBank generates a **transaction summary** for every customer. The system pulls all transactions from the database into an array, then computes the total deposits, total withdrawals, and net change in balance.

In this scenario, you have a customer's recent transaction history stored as an array of doubles. Positive values represent deposits (money in) and negative values represent withdrawals (money out). Your job is to iterate through the array, separate deposits from withdrawals, and produce a summary. This kind of data aggregation is one of the most common operations in backend development — whether you're summarizing orders, computing analytics, or generating reports.

## Content

## Arrays

An array is a fixed-size container that holds multiple values of the same type. Arrays are fundamental to programming — they're how you store lists of data like transactions, customer IDs, or monthly balances.

### Declaring and Initializing Arrays

You can create an array with a fixed size or initialize it with values directly:

```java
// Create an empty array of 5 doubles
double[] balances = new double[5];

// Create and initialize with values
double[] transactions = {150.0, -45.50, 200.0, -30.0, 500.0};
String[] accountTypes = {"Checking", "Savings", "Investment"};
```

### Accessing Elements

Array elements are accessed by index, starting at 0:

```java
double[] transactions = {150.0, -45.50, 200.0};
System.out.println(transactions[0]); // 150.0
System.out.println(transactions[2]); // 200.0

transactions[1] = -50.0; // modify the second element
```

### Array Length

Use `.length` (no parentheses) to get the number of elements:

```java
double[] transactions = {150.0, -45.50, 200.0, -30.0};
System.out.println("Count: " + transactions.length); // 4
```

### Iterating Over Arrays

Combine loops with arrays to process every element:

```java
double[] transactions = {150.0, -45.50, 200.0, -30.0, 500.0};
double total = 0.0;

for (int i = 0; i < transactions.length; i++) {
    total += transactions[i];
}
System.out.println("Net total: " + total); // 774.5
```

### Enhanced for Loop

Java's enhanced for loop (for-each) simplifies iteration when you don't need the index:

```java
double[] transactions = {150.0, -45.50, 200.0};
for (double amount : transactions) {
    System.out.println("Transaction: $" + amount);
}
```

## Why It Matters

Arrays (and their more flexible cousins, Lists) are the backbone of data processing in backend systems. Every API response containing a list, every database query returning rows, and every batch processing job works with collections of data. Knowing how to iterate, filter, and aggregate array data efficiently is a skill you'll use daily as a backend developer. In Java specifically, understanding arrays prepares you for the Collections framework (ArrayList, HashMap, etc.) that you'll use in production code.

## Challenge

Given an array of transactions, compute and print:

1. The **total deposits** (sum of positive values)
2. The **total withdrawals** (sum of negative values — print as a positive number)
3. The **net balance change** (sum of all values)

Use this transaction array:
`{500.0, -150.0, 200.0, -75.50, 1000.0, -320.0, 50.0}`

Print the results in this format:
- "Total Deposits: X"
- "Total Withdrawals: X"
- "Net Change: X"

## Starter Code

```java
public class TransactionSummary {
    public static void main(String[] args) {
        double[] transactions = {500.0, -150.0, 200.0, -75.50, 1000.0, -320.0, 50.0};

        double totalDeposits = 0.0;
        double totalWithdrawals = 0.0;

        // Loop through the transactions array
        // Add positive values to totalDeposits
        // Add negative values to totalWithdrawals


        double netChange = totalDeposits + totalWithdrawals;

        System.out.println("Total Deposits: " + totalDeposits);
        System.out.println("Total Withdrawals: " + (-totalWithdrawals));
        System.out.println("Net Change: " + netChange);
    }
}
```

## Expected Output

```
Total Deposits: 1750.0
Total Withdrawals: 545.5
Net Change: 1204.5
```

## Hint

Use a for loop (or enhanced for loop) to iterate through the array. Check each element with an if/else: if the value is greater than 0, add it to totalDeposits; otherwise, add it to totalWithdrawals. Since withdrawals are negative, totalWithdrawals will be negative — that's why we negate it when printing.

## Solution

```java
public class TransactionSummary {
    public static void main(String[] args) {
        double[] transactions = {500.0, -150.0, 200.0, -75.50, 1000.0, -320.0, 50.0};

        double totalDeposits = 0.0;
        double totalWithdrawals = 0.0;

        for (int i = 0; i < transactions.length; i++) {
            if (transactions[i] > 0) {
                totalDeposits += transactions[i];
            } else {
                totalWithdrawals += transactions[i];
            }
        }

        double netChange = totalDeposits + totalWithdrawals;

        System.out.println("Total Deposits: " + totalDeposits);
        System.out.println("Total Withdrawals: " + (-totalWithdrawals));
        System.out.println("Net Change: " + netChange);
    }
}
```
