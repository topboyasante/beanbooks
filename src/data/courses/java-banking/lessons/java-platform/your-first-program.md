---
id: "your-first-program"
moduleId: "java-platform"
title: "Your First Program"
description: "Write, compile, and run your first Java program. Understand the main method and console output."
order: 2
---

## Banking Scenario

Every banking application starts the same way — a `main()` entry point that bootstraps the system. Whether it is a batch job processing overnight settlements or a Spring Boot microservice handling API requests, Java always begins with `main()`. Before you can build account management systems or transaction engines, you need to understand how Java programs are structured, how they produce output, and how to compile and run them.

The receipt you get from an ATM, the confirmation email after a transfer, the audit log entries regulators review — all of these begin as formatted text output from Java code.

## Content

### Anatomy of a Java Program

Every Java program lives inside a **class**. The file name must match the class name exactly, including capitalization. Here is the simplest possible Java program:

```java
public class HelloBank {
    public static void main(String[] args) {
        System.out.println("Welcome to JavaBank");
    }
}
```

This file must be saved as `HelloBank.java` — not `hellobank.java`, not `HelloBank.txt`. Java is strict about this.

### Breaking Down `public static void main(String[] args)`

Every word in the main method signature has a purpose:

- **`public`** — The method is accessible from anywhere. The JVM needs to call it from outside your class, so it must be public.
- **`static`** — The method belongs to the class itself, not to an instance of the class. The JVM calls `main` before any objects exist, so it cannot be an instance method.
- **`void`** — The method does not return a value. It just runs.
- **`main`** — The exact name the JVM looks for as the entry point. Not `Main`, not `start` — it must be `main`.
- **`String[] args`** — An array of command-line arguments passed to the program. Even if you do not use them, this parameter is required.

If any part of this signature is wrong, Java will compile your code but refuse to run it, giving you a `Main method not found` error.

### System.out.println vs System.out.print

Java provides two primary methods for console output:

```java
System.out.println("First line");   // Prints text AND moves to the next line
System.out.println("Second line");

System.out.print("Same ");          // Prints text WITHOUT a newline
System.out.print("line");           // This continues on the same line
```

Output:
```
First line
Second line
Same line
```

`println` adds a line break at the end. `print` does not. Use `println` when each output should be on its own line, and `print` when you want to build up a line in pieces.

### String Literals and Escape Characters

Strings in Java are enclosed in double quotes. To include special characters within a string, use **escape sequences**:

```java
System.out.println("Account Holder:\tJohn Doe");    // \t = tab
System.out.println("Line 1\nLine 2");                // \n = newline
System.out.println("Path: C:\\Users\\bank");          // \\ = literal backslash
System.out.println("She said \"Hello\"");             // \" = literal double quote
```

These escape characters are essential for formatting output — aligning columns in reports, creating multi-line messages, and including special characters in strings.

### Comments: Documenting Your Code

Java supports three types of comments:

```java
// Single-line comment — for brief explanations

/* Multi-line comment
   for longer explanations
   that span several lines */

/**
 * Javadoc comment — used to generate documentation.
 * These describe classes, methods, and fields.
 * @param amount the deposit amount
 * @return the new balance
 */
```

In banking codebases, comments are critical for compliance. Regulators may review your code, and clear comments explaining business logic can be the difference between passing and failing an audit.

### Compiling and Running

Java is a two-step process. First you compile, then you run:

```bash
javac HelloBank.java    # Compiles to HelloBank.class
java HelloBank          # Runs the program (no .class extension!)
```

Notice that you use `javac` with the file name (including `.java`) but you use `java` with just the class name (no extension). This is because `java` is looking for a class, not a file.

### Common Errors Beginners Hit

**Missing semicolon** — Every statement must end with `;`. Java will point to the line after the missing semicolon, which can be confusing.

**Wrong file name** — If your class is `HelloBank` but the file is `hellobank.java`, the compiler will complain. Class name and file name must match exactly.

**Case sensitivity** — `System.out.Println` will not compile. It is `println` with a lowercase `p`. Java is case-sensitive everywhere: variable names, method names, class names, and keywords.

**Using `java HelloBank.class`** — A common mistake. The `java` command takes a class name, not a file name. Drop the `.class`.

## Why It Matters

Formatted text output is the backbone of banking operations. Transaction receipts, daily settlement reports, regulatory filings, and audit logs all start as carefully formatted strings. Understanding how `println`, escape characters, and string formatting work is not just about passing a tutorial — it is the foundation for every piece of human-readable output your banking applications will ever produce. Master this now, and methods like `String.format()` and logging frameworks will come naturally later.

## Challenge

Print a formatted bank receipt that displays the bank name, date, transaction type, amount, and a separator line. Use `println` and escape characters to format the output neatly.

## Starter Code

```java
public class BankReceipt {
    public static void main(String[] args) {
        // TODO: Print a separator line using = characters
        // TODO: Print the bank name centered or prominent
        // TODO: Print another separator line
        // TODO: Print the date, transaction type, and amount
        // TODO: Print a final separator line
    }
}
```

## Expected Output

```
=== JavaBank ===
Date: 2024-01-15
Transaction: Deposit
Amount: $1,500.00
================
```

## Hint

Use `System.out.println()` for each line. You do not need escape characters for this challenge — simple string literals will do. Just make sure each line matches the expected output exactly, including spacing and special characters like `$` and commas.

## Solution

```java
public class BankReceipt {
    public static void main(String[] args) {
        System.out.println("=== JavaBank ===");
        System.out.println("Date: 2024-01-15");
        System.out.println("Transaction: Deposit");
        System.out.println("Amount: $1,500.00");
        System.out.println("================");
    }
}
```
