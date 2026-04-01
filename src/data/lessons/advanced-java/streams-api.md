---
id: "streams-api"
moduleId: "advanced-java"
title: "Streams API"
description: "Process collections declaratively with filter, map, reduce, and collect."
order: 4
---

## Banking Scenario

At the end of each business day, a bank's batch processing system must analyze millions of transactions -- filtering out reversals, calculating totals by category, generating reports by branch, and flagging suspicious patterns. Writing nested loops with mutable accumulators for all of this is error-prone and hard to parallelize.

The Streams API lets you build declarative data pipelines that read like a description of what you want, not how to do it. Instead of "create a variable, loop through the list, check a condition, add to another list," you write "filter transactions where amount is positive, double each, sum them." This functional approach is how modern banking systems process data at scale.

## Content

### What Streams Are

A stream is a sequence of elements that supports functional-style operations. Critically, a stream is **not a data structure** -- it does not store data. It is a pipeline that processes data from a source (collection, array, or generator) through a series of operations.

Streams are also **lazy**: intermediate operations are not executed until a terminal operation is invoked. This allows the JVM to optimize the pipeline.

```java
import java.util.List;
import java.util.stream.Stream;

List<String> accounts = List.of("Alice", "Bob", "Charlie");

// This does NOTHING yet -- stream is lazy
Stream<String> stream = accounts.stream()
    .filter(name -> name.startsWith("A"));

// Terminal operation triggers the pipeline
stream.forEach(System.out::println); // NOW it executes: Alice

// Streams are single-use -- you cannot reuse a consumed stream
// stream.forEach(System.out::println); // IllegalStateException!
```

### Creating Streams

There are several ways to create streams:

```java
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

// From a collection
List<Double> balances = List.of(5000.0, 12000.0, 800.0);
Stream<Double> fromList = balances.stream();

// From an array
double[] amounts = {100.0, 200.0, 300.0};
java.util.stream.DoubleStream fromArray = Arrays.stream(amounts);

// From static factory
Stream<String> fromOf = Stream.of("Deposit", "Withdrawal", "Transfer");

// Generate or iterate
Stream<Double> zeros = Stream.generate(() -> 0.0).limit(5);
Stream<Integer> counting = Stream.iterate(1, n -> n + 1).limit(10);
```

### Intermediate Operations

Intermediate operations return a new stream and are lazy. They define transformations but do not execute until a terminal operation is called.

```java
import java.util.List;

List<Double> transactions = List.of(500.0, -200.0, 1000.0, -50.0, 750.0, 500.0);

// filter -- keep elements matching a condition
transactions.stream()
    .filter(amount -> amount > 0)  // only positive (deposits)
    .forEach(System.out::println); // 500.0, 1000.0, 750.0, 500.0

// map -- transform each element
transactions.stream()
    .map(amount -> Math.abs(amount))
    .forEach(System.out::println); // all positive values

// sorted -- sort elements
transactions.stream()
    .sorted()
    .forEach(System.out::println); // ascending order

// distinct -- remove duplicates
transactions.stream()
    .distinct()
    .forEach(System.out::println); // 500.0 appears once

// flatMap -- flatten nested structures
List<List<String>> branchAccounts = List.of(
    List.of("Alice", "Bob"),
    List.of("Charlie", "Diana")
);
branchAccounts.stream()
    .flatMap(List::stream)  // flatten to single stream
    .forEach(System.out::println); // Alice, Bob, Charlie, Diana
```

### Terminal Operations

Terminal operations trigger the pipeline and produce a result. Once a terminal operation executes, the stream is consumed.

```java
import java.util.List;
import java.util.Optional;

List<Double> balances = List.of(5000.0, 12000.0, 800.0, 25000.0);

// collect -- gather results into a collection
List<Double> highBalances = balances.stream()
    .filter(b -> b > 10000)
    .collect(java.util.stream.Collectors.toList());
// [12000.0, 25000.0]

// reduce -- combine elements into a single result
double totalBalance = balances.stream()
    .reduce(0.0, Double::sum);
// 42800.0

// count -- count elements
long premiumCount = balances.stream()
    .filter(b -> b > 10000)
    .count();
// 2

// findFirst -- get the first element (returns Optional)
Optional<Double> first = balances.stream()
    .filter(b -> b > 10000)
    .findFirst();
first.ifPresent(b -> System.out.println("First premium: " + b));
// First premium: 12000.0

// forEach -- perform action on each element
balances.stream().forEach(System.out::println);
```

### Collectors -- Powerful Result Gathering

The `Collectors` class provides advanced ways to gather stream results:

```java
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

List<String> transactions = List.of(
    "DEPOSIT", "WITHDRAWAL", "DEPOSIT", "TRANSFER", "DEPOSIT"
);

// groupingBy -- group elements by a classifier
Map<String, Long> countByType = transactions.stream()
    .collect(Collectors.groupingBy(t -> t, Collectors.counting()));
// {DEPOSIT=3, WITHDRAWAL=1, TRANSFER=1}

// joining -- concatenate strings
String summary = transactions.stream()
    .distinct()
    .collect(Collectors.joining(", "));
// "DEPOSIT, WITHDRAWAL, TRANSFER"

// toList (Java 16+) -- simplified collection
List<String> deposits = transactions.stream()
    .filter(t -> t.equals("DEPOSIT"))
    .collect(Collectors.toList());
```

### Parallel Streams

Parallel streams split the workload across multiple CPU cores. They can dramatically speed up processing of large datasets -- but they are not always faster and can introduce bugs with shared mutable state.

```java
import java.util.List;

List<Double> millionsOfTransactions = List.of(100.0, 200.0, 300.0, 400.0, 500.0);

// Sequential -- single thread
double seqTotal = millionsOfTransactions.stream()
    .reduce(0.0, Double::sum);

// Parallel -- multiple threads
double parTotal = millionsOfTransactions.parallelStream()
    .reduce(0.0, Double::sum);

// Both produce the same result: 1500.0
```

**When to use parallel streams:**
- Large datasets (10,000+ elements) with CPU-intensive operations
- Stateless, independent operations (no shared mutable state)
- When order does not matter

**When NOT to use them:**
- Small datasets (overhead of thread management exceeds the benefit)
- I/O-bound operations (database calls, file reads)
- When operations have side effects or depend on order

## Why It Matters

The Streams API is the modern standard for data processing in Java. Banking applications use streams for everything from real-time transaction filtering to end-of-day batch reporting. In interviews, you will be asked to solve problems using streams instead of loops -- demonstrating that you can write clean, declarative, and potentially parallelizable code. Understanding when to use parallel streams versus sequential ones shows maturity in performance reasoning.

## Challenge

Given a list of transaction amounts (positive for deposits, negative for withdrawals), use streams to: filter only the deposits (positive amounts), double each one (simulating a bonus promotion), and sum the result. Print the original list and the bonus deposit total.

## Starter Code
```java
import java.util.List;

public class StreamBank {
    public static void main(String[] args) {
        List<Double> transactions = List.of(500.0, -200.0, 1000.0, -50.0, 750.0);

        System.out.println("Original transactions: " + transactions);

        // Use streams to:
        // 1. Filter deposits (positive amounts)
        // 2. Double each deposit (bonus promotion)
        // 3. Sum the doubled deposits

        // Print the result
    }
}
```

## Expected Output
```
Original transactions: [500.0, -200.0, 1000.0, -50.0, 750.0]
Bonus deposit total: 4500.0
```

## Hint

Chain `.filter()` to keep positive values, `.map()` to double them, and `.reduce()` to sum them. The reduce identity value is `0.0` and the accumulator is `Double::sum`.

## Solution
```java
import java.util.List;

public class StreamBank {
    public static void main(String[] args) {
        List<Double> transactions = List.of(500.0, -200.0, 1000.0, -50.0, 750.0);

        System.out.println("Original transactions: " + transactions);

        double bonusTotal = transactions.stream()
            .filter(amount -> amount > 0)
            .map(amount -> amount * 2)
            .reduce(0.0, Double::sum);

        System.out.println("Bonus deposit total: " + bonusTotal);
    }
}
```
