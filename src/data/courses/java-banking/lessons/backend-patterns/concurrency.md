---
id: "concurrency"
moduleId: "backend-patterns"
title: "Concurrency & Thread Safety"
description: "Handle concurrent operations safely with threads, locks, and CompletableFuture."
order: 3
---

## Banking Scenario

A bank processes thousands of transactions per second. Multiple threads handle ATM withdrawals, online transfers, and batch jobs simultaneously. Without proper concurrency control, two threads could read the same balance, both approve a withdrawal, and overdraw the account.

Concurrency bugs are among the most dangerous in banking software because they are intermittent and hard to reproduce. A race condition might only appear under heavy load, silently corrupting account balances for weeks before anyone notices. Understanding Java's concurrency primitives is essential for building systems that handle real money.

## Content

### Threads Basics

A thread is an independent path of execution within a program. Java provides two ways to create threads:

```java
// Extending Thread
class TransactionProcessor extends Thread {
    public void run() {
        System.out.println("Processing transaction on " + getName());
    }
}

// Implementing Runnable (preferred)
Runnable task = () -> System.out.println("Processing on " + Thread.currentThread().getName());
Thread t = new Thread(task);
t.start(); // start(), not run()
```

Calling `start()` creates a new OS thread. Calling `run()` directly just executes the method on the current thread. This is a common mistake.

### Race Conditions: The Bank Account Problem

A race condition occurs when multiple threads access shared data and the outcome depends on timing. Consider two threads withdrawing from the same account:

```java
// UNSAFE: Race condition
class UnsafeAccount {
    private long balance = 1000;

    public void withdraw(long amount) {
        if (balance >= amount) {       // Thread A reads 1000
            // Thread B also reads 1000 here
            balance -= amount;         // Both subtract, balance goes negative
        }
    }
}
```

Both threads read balance as 1000, both see the withdrawal is allowed, and both subtract. The result: a balance of -600 instead of 200.

### The synchronized Keyword

Java's `synchronized` keyword provides mutual exclusion. Only one thread can hold the lock at a time:

```java
class SafeAccount {
    private long balance = 1000;

    public synchronized void withdraw(long amount) {
        if (balance >= amount) {
            balance -= amount;
            System.out.println("Withdrew " + amount + ", balance: " + balance);
        } else {
            System.out.println("Insufficient funds for " + amount);
        }
    }

    public synchronized long getBalance() {
        return balance;
    }
}
```

You can also synchronize on a specific block for finer-grained locking:

```java
public void transfer(SafeAccount from, SafeAccount to, long amount) {
    synchronized (from) {
        synchronized (to) {
            from.withdraw(amount);
            to.deposit(amount);
        }
    }
}
```

### ExecutorService and Thread Pools

Creating threads manually is expensive and hard to manage. `ExecutorService` provides thread pools that reuse threads:

```java
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

ExecutorService pool = Executors.newFixedThreadPool(4);
for (int i = 0; i < 100; i++) {
    pool.submit(() -> processTransaction());
}
pool.shutdown();
```

- `FixedThreadPool(n)`: Exactly n threads. Use for predictable load.
- `CachedThreadPool()`: Creates threads as needed, reuses idle ones. Use for bursty short-lived tasks.
- `SingleThreadExecutor()`: One thread, tasks execute sequentially. Use for ordered processing.

### CompletableFuture: Async Operations

`CompletableFuture` lets you chain asynchronous operations without blocking. Perfect for banking workflows:

```java
import java.util.concurrent.CompletableFuture;

CompletableFuture.supplyAsync(() -> validateAccount(accountId))
    .thenApply(account -> debitAccount(account, amount))
    .thenApply(debitResult -> creditAccount(targetId, amount))
    .thenAccept(result -> sendNotification(result))
    .exceptionally(ex -> {
        logFailure(ex);
        return null;
    });
```

`thenCombine` merges two independent futures. Use it when you need results from two parallel operations, like checking both accounts before a transfer.

### Concurrent Collections and Atomics

Java provides thread-safe data structures in `java.util.concurrent`:

- **ConcurrentHashMap**: Thread-safe map without locking the entire structure. Use for shared caches.
- **CopyOnWriteArrayList**: Safe for rare writes, frequent reads. Use for listener lists.
- **BlockingQueue**: Threads block when the queue is empty (consumers) or full (producers). Ideal for producer-consumer patterns.
- **AtomicLong / AtomicInteger**: Lock-free thread-safe numeric operations using compare-and-swap (CAS).

```java
import java.util.concurrent.atomic.AtomicLong;

AtomicLong atomicBalance = new AtomicLong(1000);
atomicBalance.addAndGet(-200); // Thread-safe subtraction
```

### Thread Safety Patterns

Several patterns help you write thread-safe code:

- **Immutable objects**: Objects whose state cannot change after construction are inherently thread-safe. Use `final` fields and no setters.
- **ThreadLocal**: Each thread gets its own copy of a variable. Use for per-request context like transaction IDs.
- **volatile**: Guarantees visibility of changes across threads, but does not provide atomicity. Use for flags like `volatile boolean running = true`.

## Why It Matters

Banking systems must be both concurrent (handling many requests simultaneously) and correct (never losing or duplicating money). Java's concurrency toolkit gives you the building blocks, but using them incorrectly leads to bugs that cost real money. Understanding race conditions, choosing the right synchronization strategy, and knowing when to use atomics versus locks are skills that separate junior developers from senior backend engineers.

## Challenge

Simulate concurrent deposits using a regular `long` variable versus `AtomicLong`. Run 1000 deposits of $1 each across 10 threads and compare the final totals.

## Starter Code

```java
import java.util.concurrent.atomic.AtomicLong;

public class Concurrency {
    static long unsafeBalance = 0;
    static AtomicLong safeBalance = new AtomicLong(0);

    public static void main(String[] args) throws InterruptedException {
        int threadCount = 10;
        int depositsPerThread = 1000;

        System.out.println("=== Concurrent Deposit Simulation ===");
        System.out.println("Threads: " + threadCount + ", Deposits per thread: " + depositsPerThread);
        System.out.println("Expected total: $" + (threadCount * depositsPerThread));

        // TODO: Create threads that increment both unsafeBalance and safeBalance
        // Each thread should deposit $1 depositsPerThread times
        // Start all threads, then join all threads

        System.out.println("\n--- Results ---");
        System.out.println("Unsafe (long) balance: $" + unsafeBalance);
        System.out.println("Safe (AtomicLong) balance: $" + safeBalance.get());
    }
}
```

## Expected Output

```
=== Concurrent Deposit Simulation ===
Threads: 10, Deposits per thread: 1000
Expected total: $10000

--- Results ---
Unsafe (long) balance: $9672
Safe (AtomicLong) balance: $10000

Race condition detected! Unsafe balance lost $328
AtomicLong preserved all deposits correctly.
```

## Hint

Create an array of Thread objects. In each thread's Runnable, loop `depositsPerThread` times and increment both `unsafeBalance++` and `safeBalance.incrementAndGet()`. Start all threads first, then call `join()` on each to wait for completion. The unsafe balance will likely be less than 10000 due to lost updates.

## Solution

```java
import java.util.concurrent.atomic.AtomicLong;

public class Concurrency {
    static long unsafeBalance = 0;
    static AtomicLong safeBalance = new AtomicLong(0);

    public static void main(String[] args) throws InterruptedException {
        int threadCount = 10;
        int depositsPerThread = 1000;

        System.out.println("=== Concurrent Deposit Simulation ===");
        System.out.println("Threads: " + threadCount + ", Deposits per thread: " + depositsPerThread);
        long expected = (long) threadCount * depositsPerThread;
        System.out.println("Expected total: $" + expected);

        Thread[] threads = new Thread[threadCount];
        for (int i = 0; i < threadCount; i++) {
            threads[i] = new Thread(() -> {
                for (int j = 0; j < depositsPerThread; j++) {
                    unsafeBalance++;
                    safeBalance.incrementAndGet();
                }
            });
        }

        for (Thread t : threads) {
            t.start();
        }
        for (Thread t : threads) {
            t.join();
        }

        System.out.println("\n--- Results ---");
        System.out.println("Unsafe (long) balance: $" + unsafeBalance);
        System.out.println("Safe (AtomicLong) balance: $" + safeBalance.get());

        if (unsafeBalance < expected) {
            System.out.println("\nRace condition detected! Unsafe balance lost $" + (expected - unsafeBalance));
        }
        System.out.println("AtomicLong preserved all deposits correctly.");
    }
}
```
