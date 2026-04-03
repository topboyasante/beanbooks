---
id: "lambda-expressions"
moduleId: "advanced-java"
title: "Lambda Expressions"
description: "Write concise code with lambda expressions, functional interfaces, and method references."
order: 3
---

## Banking Scenario

A bank's account management dashboard needs to filter, transform, and display account data in many different ways. The compliance team wants to see only high-value accounts. The marketing team wants to format balances for promotional materials. The risk department wants to flag accounts that meet certain criteria. Each team needs different logic applied to the same data.

Before Java 8, implementing these varied behaviors meant writing verbose anonymous inner classes for every callback and filter. Lambda expressions changed everything -- they let you pass behavior as data, making your code dramatically more concise and readable. This is the foundation of modern Java programming in the financial industry.

## Content

### Anonymous Classes -- The Old Way

Before lambdas, when you needed to pass behavior (like a sorting strategy or an event handler), you used anonymous inner classes. They work, but they are verbose.

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

List<String> accounts = new ArrayList<>(List.of("Charlie", "Alice", "Bob"));

// Anonymous inner class -- verbose
Collections.sort(accounts, new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return a.compareTo(b);
    }
});

System.out.println(accounts); // [Alice, Bob, Charlie]
```

That is 6 lines of boilerplate just to say "compare two strings alphabetically." Lambda expressions reduce this to one line.

### Lambda Syntax

A lambda expression is an anonymous function. The syntax is: `(parameters) -> body`.

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

List<String> accounts = new ArrayList<>(List.of("Charlie", "Alice", "Bob"));

// Lambda -- concise and clear
Collections.sort(accounts, (a, b) -> a.compareTo(b));

System.out.println(accounts); // [Alice, Bob, Charlie]
```

Lambda variations:

```java
// No parameters
Runnable task = () -> System.out.println("Processing batch...");

// Single parameter (parentheses optional)
java.util.function.Consumer<String> printer = name -> System.out.println(name);

// Multiple parameters
java.util.function.BiFunction<Double, Double, Double> add = (a, b) -> a + b;

// Multi-line body (requires braces and return)
java.util.function.Function<Double, String> formatBalance = balance -> {
    String formatted = String.format("$%.2f", balance);
    return formatted;
};
```

### Functional Interfaces

A lambda can only be used where a **functional interface** is expected -- an interface with exactly one abstract method. Java provides the `@FunctionalInterface` annotation to enforce this.

The four most important built-in functional interfaces live in `java.util.function`:

```java
import java.util.function.*;

// Predicate<T> -- takes T, returns boolean (testing/filtering)
Predicate<Double> isHighValue = balance -> balance > 10000;
System.out.println(isHighValue.test(15000.0)); // true

// Function<T, R> -- takes T, returns R (transforming)
Function<Double, String> formatBalance = bal -> "$" + bal;
System.out.println(formatBalance.apply(5000.0)); // $5000.0

// Consumer<T> -- takes T, returns nothing (performing action)
Consumer<String> logTransaction = txn -> System.out.println("LOG: " + txn);
logTransaction.accept("Deposit $500"); // LOG: Deposit $500

// Supplier<T> -- takes nothing, returns T (producing value)
Supplier<String> accountIdGenerator = () -> "ACC-" + System.currentTimeMillis();
System.out.println(accountIdGenerator.get()); // ACC-1711900000000
```

### Method References

When a lambda simply calls an existing method, you can replace it with a method reference using the `::` operator. There are four types:

```java
import java.util.List;
import java.util.function.Function;

List<String> names = List.of("Alice", "Bob", "Charlie");

// 1. Reference to a static method: ClassName::staticMethod
Function<String, Integer> parser = Integer::parseInt;

// 2. Reference to an instance method of a particular object
String prefix = "BANK";
java.util.function.Supplier<Integer> lengthGetter = prefix::length;

// 3. Reference to an instance method of an arbitrary object
// String::toUpperCase is called on each element
names.stream().map(String::toUpperCase).forEach(System.out::println);

// 4. Reference to a constructor: ClassName::new
Function<String, StringBuilder> sbCreator = StringBuilder::new;
```

The most common method reference you will see in banking code is `System.out::println`, which replaces `x -> System.out.println(x)`.

### Effectively Final Variables in Lambdas

Lambdas can access local variables from the enclosing scope, but those variables must be **effectively final** -- assigned once and never modified.

```java
String bankName = "National Bank"; // effectively final

Runnable printBanner = () -> {
    System.out.println("Welcome to " + bankName); // OK
};

// bankName = "Other Bank"; // if you uncomment this, the lambda above won't compile
```

This restriction exists because lambdas may execute on a different thread. Allowing mutable shared state would create race conditions -- a serious concern in banking systems processing concurrent transactions.

### Common Built-In Functional Interfaces

Java provides specialized variants for primitives and multi-argument operations to avoid boxing overhead:

```java
import java.util.function.*;

// Primitive specializations (avoid autoboxing overhead)
IntPredicate isPositive = amount -> amount > 0;
DoubleUnaryOperator addInterest = balance -> balance * 1.05;
LongSupplier timestampGenerator = System::currentTimeMillis;

// Two-argument variants
BiPredicate<String, Double> isEligible =
    (type, balance) -> type.equals("Premium") && balance > 50000;

BiFunction<Double, Double, Double> calculateInterest =
    (principal, rate) -> principal * rate;

BiConsumer<String, Double> printAccount =
    (name, balance) -> System.out.println(name + ": $" + balance);

printAccount.accept("Alice", 15000.0); // Alice: $15000.0
```

## Why It Matters

Lambda expressions are the gateway to modern Java. Every banking application built in the last decade uses them extensively -- for stream processing, event handling, Spring framework callbacks, and reactive programming. In interviews, you will be expected to read and write lambdas fluently, understand functional interfaces, and know when method references improve readability. They are not just syntactic sugar; they represent a fundamental shift toward functional thinking in Java.

## Challenge

Create a list of accounts with names and balances (use a `Map<String, Double>`). Use a `Predicate` to filter accounts with balances greater than $10,000. Use a `Consumer` to print each high-value account. Format the output using a `Function` to convert the balance to a display string.

## Starter Code
```java
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;

public class LambdaBank {
    public static void main(String[] args) {
        Map<String, Double> accounts = new HashMap<>();
        accounts.put("Alice", 15000.0);
        accounts.put("Bob", 8000.0);
        accounts.put("Charlie", 25000.0);
        accounts.put("Diana", 3000.0);

        // Define a Predicate to check if balance > 10000

        // Define a Function to format balance as "$" + balance

        // Define a Consumer to print name + formatted balance

        // Filter and print high-value accounts
        System.out.println("High-value accounts:");
    }
}
```

## Expected Output
```
High-value accounts:
Alice: $15000.0
Charlie: $25000.0
```

## Hint

Define `Predicate<Double> isHighValue`, `Function<Double, String> format`, and `Consumer<String> printer`. Then iterate over the map entries, test each balance with the predicate, format it with the function, and print with the consumer.

## Solution
```java
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;

public class LambdaBank {
    public static void main(String[] args) {
        Map<String, Double> accounts = new HashMap<>();
        accounts.put("Alice", 15000.0);
        accounts.put("Bob", 8000.0);
        accounts.put("Charlie", 25000.0);
        accounts.put("Diana", 3000.0);

        Predicate<Double> isHighValue = balance -> balance > 10000;
        Function<Double, String> formatBalance = balance -> "$" + balance;
        Consumer<String> printer = System.out::println;

        System.out.println("High-value accounts:");
        for (Map.Entry<String, Double> entry : accounts.entrySet()) {
            if (isHighValue.test(entry.getValue())) {
                printer.accept(entry.getKey() + ": " + formatBalance.apply(entry.getValue()));
            }
        }
    }
}
```
