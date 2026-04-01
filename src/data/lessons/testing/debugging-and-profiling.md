---
id: "debugging-and-profiling"
moduleId: "testing"
title: "Debugging & Profiling"
description: "Read stack traces, use logging effectively, and avoid common Java pitfalls."
order: 4
---

## Banking Scenario

It is 2 AM and the on-call pager goes off. JavaBank's nightly batch process for calculating interest has crashed. The error log shows a stack trace fifty lines long. Your job is to find the root cause, fix it, and get the system running before the markets open at 6 AM. This is not hypothetical -- it is a regular reality for Java developers in banking.

Debugging skills separate junior developers from senior ones. Knowing how to read a stack trace, use logging strategically, and recognize common pitfalls will save you hours of frustration and prevent production incidents. These skills are rarely taught in courses but are expected from day one on the job.

## Content

### Reading Stack Traces

A stack trace is Java's way of telling you what went wrong and where. It reads from top to bottom, with the actual error on the first line and the chain of method calls below it. The most important parts are the exception type, the message, and the line numbers pointing to your code.

The key skill is finding your code in the trace. Stack traces often include dozens of lines from framework code (Spring, Hibernate, Tomcat). You need to scan for your package name (e.g., `com.javabank`) to find where the error originates. The "Caused by" sections are critical -- the root cause is usually in the last "Caused by" block.

When multiple exceptions are chained, Java wraps the original exception in higher-level ones. A `DataAccessException` from Spring might wrap a `SQLException` which wraps a `NullPointerException` in your code. Always dig to the root cause.

```java
// Example stack trace
// Exception in thread "main" java.lang.NullPointerException:
//     Cannot invoke "String.length()" because "str" is null
//   at com.javabank.service.AccountService.findAccount(AccountService.java:42)
//   at com.javabank.controller.AccountController.getAccount(AccountController.java:28)
//   at sun.reflect.NativeMethodAccessorImpl.invoke(...)
//   ...
// Caused by: com.javabank.exception.AccountNotFoundException
//   at com.javabank.repository.AccountRepo.lookup(AccountRepo.java:15)

// Reading this: The root cause is at AccountRepo.java line 15
// The NullPointerException happens at AccountService.java line 42
// because the lookup returned null and the code didn't check for it
```

### Logging with SLF4J

Print statements are fine for learning, but production banking code uses structured logging. SLF4J (Simple Logging Facade for Java) with Logback is the standard combination. Logging lets you control verbosity without changing code, persist messages to files, and include metadata like timestamps and thread names.

Log levels control what gets recorded. `ERROR` is for failures requiring immediate attention (transaction failed, database unreachable). `WARN` is for potential problems (retry attempted, deprecated API used). `INFO` logs significant business events (account created, transfer completed). `DEBUG` provides detailed technical information for troubleshooting. `TRACE` is for very fine-grained diagnostics.

In production banking systems, you typically run at `INFO` level. When investigating a bug, you can temporarily lower it to `DEBUG` for a specific module without restarting the application. Never log sensitive data like account numbers, passwords, or full credit card numbers.

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class TransactionService {
    private static final Logger logger = LoggerFactory.getLogger(TransactionService.class);

    void processTransfer(String fromAccount, String toAccount, double amount) {
        logger.info("Transfer initiated: {} -> {}, amount: {}",
            fromAccount, toAccount, amount);

        try {
            // process transfer
            logger.debug("Validating accounts...");
            logger.debug("Checking sufficient funds...");
            logger.info("Transfer completed successfully");
        } catch (Exception e) {
            logger.error("Transfer failed from {} to {}: {}",
                fromAccount, toAccount, e.getMessage(), e);
        }
    }
}
```

### Common Java Pitfalls

**NullPointerException** is the most common Java error. It occurs when you call a method on a `null` reference. In banking code, this often happens when a database query returns no result and the code assumes it always will. The fix is defensive programming: check for null before using a value, or use `Optional` to make null-ability explicit.

**ConcurrentModificationException** occurs when you modify a collection while iterating over it. This happens in banking when processing a list of transactions and removing invalid ones during iteration. Use an `Iterator` with `remove()` or collect items to remove in a separate list.

**Off-by-one errors** are subtle bugs where a loop runs one time too many or too few. In banking, this might mean processing 11 monthly interest payments instead of 12, or skipping the last transaction in a batch. Always verify loop boundaries carefully.

```java
// NullPointerException
String accountHolder = accountRepository.findById("ACC-999"); // returns null
int nameLength = accountHolder.length(); // BOOM: NullPointerException

// Fix: null check
if (accountHolder != null) {
    int nameLength = accountHolder.length();
}

// ConcurrentModificationException
List<Transaction> transactions = new ArrayList<>(getTransactions());
for (Transaction t : transactions) {
    if (t.getAmount() < 0) {
        transactions.remove(t); // BOOM: ConcurrentModificationException
    }
}

// Fix: use Iterator
Iterator<Transaction> it = transactions.iterator();
while (it.hasNext()) {
    if (it.next().getAmount() < 0) {
        it.remove(); // safe removal
    }
}
```

### Debugging Strategies

When facing a bug, start with the stack trace. If there is no stack trace (the program produces wrong output), use binary search debugging: add print statements halfway through the suspect code. If the output is correct at that point, the bug is in the second half. Repeat until you isolate the exact line.

The rubber duck technique works surprisingly well. Explain the code line by line to an imaginary listener (or a real rubber duck). The act of verbalizing your assumptions often reveals the flaw. In banking, many bugs come from incorrect assumptions about data: an account that should always exist but does not, a balance that should never be negative but is, or a date format that changes between systems.

Breakpoints in an IDE let you pause execution and inspect variables at any point. You can step through code line by line, watching how values change. For production issues where you cannot attach a debugger, strategic logging is your best tool.

```java
// Binary search debugging
void processMonthlyStatements(List<Account> accounts) {
    System.out.println("Total accounts: " + accounts.size());

    for (int i = 0; i < accounts.size(); i++) {
        Account acc = accounts.get(i);
        System.out.println("Processing account " + i + ": " + acc.getId());

        double interest = calculateInterest(acc);
        System.out.println("  Interest calculated: " + interest);

        acc.applyInterest(interest);
        System.out.println("  New balance: " + acc.getBalance());
    }
}
```

### Memory Leaks Basics

Java has automatic garbage collection, but memory leaks still happen. A memory leak occurs when objects are no longer needed but cannot be garbage collected because something still references them. In long-running banking applications, this gradually consumes all available memory until the JVM crashes with `OutOfMemoryError`.

Common causes include static collections that grow indefinitely (like a cache with no eviction policy), unclosed resources (database connections, file streams), and listener registrations that are never removed. In banking systems, connection pool exhaustion is a frequent production issue caused by code that opens database connections but fails to close them in error paths.

Always close resources using try-with-resources. Monitor your application's memory usage with JVM flags like `-Xmx` (maximum heap size) and tools like JVisualVM or Grafana dashboards. If memory grows continuously over hours or days, you likely have a leak.

```java
// Memory leak: static list that grows forever
class AuditTrail {
    private static final List<String> logs = new ArrayList<>();

    static void log(String message) {
        logs.add(message); // never cleared, grows forever
    }
}

// Resource leak: connection not closed on exception
void queryAccount(String id) {
    Connection conn = dataSource.getConnection();
    // if exception occurs here, connection is never closed
    ResultSet rs = conn.createStatement().executeQuery("SELECT ...");
    conn.close(); // never reached if exception thrown above
}

// Fix: try-with-resources
void queryAccountSafe(String id) {
    try (Connection conn = dataSource.getConnection();
         Statement stmt = conn.createStatement();
         ResultSet rs = stmt.executeQuery("SELECT ...")) {
        // connection automatically closed, even on exception
    }
}
```

### Profiling Your Application

Profiling helps you find performance bottlenecks. In banking, a slow transaction processing pipeline can cause cascading delays across the entire system. The JDK includes tools like `jconsole` and `jvisualvm` for monitoring CPU usage, memory allocation, and thread activity.

The most important metrics for banking applications are response time (how long each transaction takes), throughput (transactions per second), and memory usage (are we leaking?). Start with the slowest operation and work your way through. Often, 80% of the time is spent in 20% of the code -- find that 20% and optimize it.

```java
// Simple profiling with System.nanoTime
long start = System.nanoTime();

processTransaction(transaction);

long elapsed = System.nanoTime() - start;
System.out.println("Transaction processed in " + (elapsed / 1_000_000) + " ms");

// Profiling a batch operation
long batchStart = System.nanoTime();
int count = 0;
for (Transaction t : transactions) {
    processTransaction(t);
    count++;
}
long batchElapsed = System.nanoTime() - batchStart;
System.out.println("Processed " + count + " transactions in "
    + (batchElapsed / 1_000_000) + " ms");
System.out.println("Average: " + (batchElapsed / count / 1_000_000) + " ms per transaction");
```

## Why It Matters

Debugging is the skill you use every day but rarely study formally. In banking, production issues have real financial consequences -- a bug that goes undetected for hours could affect thousands of customer accounts. Knowing how to quickly read stack traces, use logging effectively, recognize common pitfalls, and profile performance will make you the developer your team relies on when things go wrong.

## Challenge

Given a stack trace scenario, identify the bug and fix the code. An `AccountLookupService` crashes with a `NullPointerException` when looking up an account. Fix the null handling so it works correctly.

## Starter Code
```java
import java.util.HashMap;
import java.util.Map;

class AccountLookupService {
    private Map<String, String[]> accounts = new HashMap<>();

    public AccountLookupService() {
        accounts.put("ACC-001", new String[]{"Alice Martin", "5000.0"});
        accounts.put("ACC-002", new String[]{"Bob Jones", "3200.0"});
    }

    public String findHolder(String accountId) {
        // BUG: This crashes when accountId is not found
        String[] data = accounts.get(accountId);
        return data[0]; // NullPointerException if data is null
    }

    public double findBalance(String accountId) {
        String[] data = accounts.get(accountId);
        return Double.parseDouble(data[1]); // NullPointerException if data is null
    }
}

public class Main {
    public static void main(String[] args) {
        AccountLookupService service = new AccountLookupService();

        // TODO: Fix the findHolder and findBalance methods to handle null
        // Then look up account "ACC-001" and print holder name and balance

        String holder = service.findHolder("ACC-001");
        double balance = service.findBalance("ACC-001");
        System.out.println("Account found: " + holder);
        System.out.println("Balance: " + balance);
    }
}
```

## Expected Output
```
Account found: Alice Martin
Balance: 5000.0
```

## Hint

The bug is that `accounts.get(accountId)` returns `null` when the account ID is not in the map, and then `data[0]` throws a `NullPointerException`. Fix both `findHolder` and `findBalance` by adding a null check: `if (data == null)` return a sensible default or throw a descriptive exception. For this challenge, since we are looking up "ACC-001" which exists, the fix just needs to add the null guard so the methods are safe for any input.

## Solution
```java
import java.util.HashMap;
import java.util.Map;

class AccountLookupService {
    private Map<String, String[]> accounts = new HashMap<>();

    public AccountLookupService() {
        accounts.put("ACC-001", new String[]{"Alice Martin", "5000.0"});
        accounts.put("ACC-002", new String[]{"Bob Jones", "3200.0"});
    }

    public String findHolder(String accountId) {
        String[] data = accounts.get(accountId);
        if (data == null) {
            throw new IllegalArgumentException("Account not found: " + accountId);
        }
        return data[0];
    }

    public double findBalance(String accountId) {
        String[] data = accounts.get(accountId);
        if (data == null) {
            throw new IllegalArgumentException("Account not found: " + accountId);
        }
        return Double.parseDouble(data[1]);
    }
}

public class Main {
    public static void main(String[] args) {
        AccountLookupService service = new AccountLookupService();

        String holder = service.findHolder("ACC-001");
        double balance = service.findBalance("ACC-001");
        System.out.println("Account found: " + holder);
        System.out.println("Balance: " + balance);
    }
}
```
