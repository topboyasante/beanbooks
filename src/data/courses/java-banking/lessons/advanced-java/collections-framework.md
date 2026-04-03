---
id: "collections-framework"
moduleId: "advanced-java"
title: "Collections Framework"
description: "Use ArrayList, HashSet, and HashMap to manage banking data efficiently."
order: 1
---

## Banking Scenario

Every bank manages thousands of accounts, transactions, and customer records simultaneously. When a teller searches for a customer, the system needs to retrieve that record instantly from potentially millions of entries. When the fraud department checks whether a transaction ID has already been processed, they need a data structure that guarantees uniqueness and fast lookup.

Choosing the wrong data structure can mean the difference between a system that responds in milliseconds and one that grinds to a halt during peak hours. In this lesson, you will learn the Java Collections Framework -- the backbone of how real banking applications organize and retrieve data at scale.

## Content

### The Collection Interface Hierarchy

Java's Collections Framework is built on a hierarchy of interfaces. At the top sits `Iterable`, which allows any collection to be used in a for-each loop. Below it is `Collection`, the root interface that defines common operations like `add()`, `remove()`, `size()`, and `contains()`.

From `Collection`, three major interfaces branch out:

- **List** -- an ordered collection that allows duplicates (e.g., a list of transactions in chronological order)
- **Set** -- an unordered collection that enforces uniqueness (e.g., a set of unique account numbers)
- **Map** -- a key-value pair structure (not technically under `Collection`, but part of the framework) for fast lookups (e.g., mapping account numbers to balances)

```java
// The hierarchy in action
List<String> transactionList = new ArrayList<>();
Set<String> uniqueAccountIds = new HashSet<>();
Map<String, Double> accountBalances = new HashMap<>();
```

### ArrayList vs LinkedList

Both implement the `List` interface, but their internal structures differ dramatically. `ArrayList` uses a resizable array internally. It provides O(1) random access by index, making it ideal when you frequently read data. However, inserting or removing elements in the middle requires shifting elements, which is O(n).

`LinkedList` uses a doubly-linked node structure. It provides O(1) insertion and removal at both ends, but O(n) access by index since it must traverse nodes sequentially.

```java
import java.util.ArrayList;
import java.util.LinkedList;

// ArrayList: great for reading account lists
ArrayList<String> accountList = new ArrayList<>();
accountList.add("ACC-1001");
accountList.add("ACC-1002");
accountList.add("ACC-1003");
String secondAccount = accountList.get(1); // O(1) access

// LinkedList: great for transaction queues
LinkedList<String> transactionQueue = new LinkedList<>();
transactionQueue.addFirst("TXN-HIGH-PRIORITY");
transactionQueue.addLast("TXN-NORMAL");
String next = transactionQueue.removeFirst(); // O(1) removal from ends
```

In banking, `ArrayList` is the go-to choice for most scenarios because random access is far more common than mid-list insertions.

### HashSet -- Uniqueness Without Order

`HashSet` stores elements using a hash table internally. It guarantees that no duplicates exist and provides O(1) average-time performance for `add()`, `remove()`, and `contains()`. However, it does not maintain insertion order.

```java
import java.util.HashSet;

HashSet<String> processedTransactions = new HashSet<>();
processedTransactions.add("TXN-5001");
processedTransactions.add("TXN-5002");
processedTransactions.add("TXN-5001"); // duplicate, ignored

System.out.println(processedTransactions.size()); // 2
System.out.println(processedTransactions.contains("TXN-5001")); // true
```

This is exactly how a fraud detection system might track already-processed transaction IDs -- you only care about whether it exists, not what position it was added in.

### HashMap -- Key-Value Lookups

`HashMap` is arguably the most important collection in banking software. It maps keys to values with O(1) average-time lookups. Each key must be unique, but values can repeat.

```java
import java.util.HashMap;

HashMap<String, Double> balances = new HashMap<>();
balances.put("Alice", 15000.0);
balances.put("Bob", 8200.0);
balances.put("Charlie", 25000.0);

// Instant lookup by key
double aliceBalance = balances.get("Alice"); // 15000.0

// Check if account exists before accessing
if (balances.containsKey("Diana")) {
    System.out.println(balances.get("Diana"));
} else {
    System.out.println("Account not found");
}
```

### Iterating Collections

Java provides multiple ways to traverse collections. The enhanced for-each loop is the simplest and most readable. For maps, you iterate over the `entrySet()`.

```java
import java.util.HashMap;
import java.util.Map;

Map<String, Double> accounts = new HashMap<>();
accounts.put("Alice", 5000.0);
accounts.put("Bob", 3000.0);

// For-each over map entries
for (Map.Entry<String, Double> entry : accounts.entrySet()) {
    System.out.println(entry.getKey() + ": $" + entry.getValue());
}

// Using Iterator for safe removal during iteration
var iterator = accounts.entrySet().iterator();
while (iterator.hasNext()) {
    Map.Entry<String, Double> entry = iterator.next();
    if (entry.getValue() < 1000) {
        iterator.remove(); // safe removal during iteration
    }
}
```

### Collections Utility Class and Choosing the Right Collection

The `Collections` class provides static utility methods for sorting, searching, and creating unmodifiable views of collections.

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

List<Double> transactions = new ArrayList<>();
transactions.add(500.0);
transactions.add(150.0);
transactions.add(1200.0);

Collections.sort(transactions); // [150.0, 500.0, 1200.0]

// Create an unmodifiable list (good for security-sensitive data)
List<Double> readOnlyTransactions = Collections.unmodifiableList(transactions);
// readOnlyTransactions.add(100.0); // throws UnsupportedOperationException
```

**Choosing the right collection:**

| Need | Use | Why |
|------|-----|-----|
| Ordered, allows duplicates | `ArrayList` | Fast index access |
| Unique elements, no order needed | `HashSet` | O(1) contains check |
| Key-value lookup | `HashMap` | O(1) get by key |
| Ordered unique elements | `TreeSet` | Sorted iteration |
| Ordered key-value pairs | `TreeMap` | Sorted by key |

## Why It Matters

In banking interviews, collections questions are among the most common. Interviewers want to know that you can choose the right data structure for a given problem -- using a `HashMap` for account lookups instead of iterating through a `List`, or using a `HashSet` to detect duplicate transactions in constant time. Mastering the Collections Framework is not just about knowing the API; it is about understanding the performance trade-offs that keep banking systems fast and reliable under heavy load.

## Challenge

Use a `HashMap` to store account balances for three customers: Alice ($5000.0), Bob ($3500.0), and Charlie ($10000.0). Look up and print Alice's balance, then calculate and print the total balance across all accounts.

## Starter Code
```java
import java.util.HashMap;
import java.util.Map;

public class BankBalances {
    public static void main(String[] args) {
        // Create a HashMap to store account balances

        // Add three accounts: Alice (5000.0), Bob (3500.0), Charlie (10000.0)

        // Look up and print Alice's balance

        // Calculate and print the total balance across all accounts
    }
}
```

## Expected Output
```
Alice's Balance: 5000.0
Total Bank Balance: 18500.0
```

## Hint

Use `map.get("Alice")` to look up a specific balance. To calculate the total, iterate over `map.values()` and sum them using a loop or the `values()` collection.

## Solution
```java
import java.util.HashMap;
import java.util.Map;

public class BankBalances {
    public static void main(String[] args) {
        HashMap<String, Double> balances = new HashMap<>();

        balances.put("Alice", 5000.0);
        balances.put("Bob", 3500.0);
        balances.put("Charlie", 10000.0);

        System.out.println("Alice's Balance: " + balances.get("Alice"));

        double total = 0;
        for (double balance : balances.values()) {
            total += balance;
        }
        System.out.println("Total Bank Balance: " + total);
    }
}
```
