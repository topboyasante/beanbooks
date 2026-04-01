---
id: "event-driven-architecture"
moduleId: "backend-patterns"
title: "Event-Driven Architecture"
description: "Design loosely coupled systems with events, event sourcing, and CQRS."
order: 6
---

## Banking Scenario

Traditional banking systems update a single database row when a transfer happens — the balance changes, and the previous state is lost. If a regulator asks "what happened to this account on March 15th?", you're left digging through fragmented logs and hoping for the best.

Modern banks use event sourcing: every state change is stored as an immutable event ("DepositMade $500", "WithdrawalMade $200"). The current balance is computed by replaying all events. This gives you a complete audit trail — regulators love it, and developers gain the ability to debug by traveling through time.

## Content

### Events vs Commands

A command is a request to do something: "TransferRequested" or "DepositFunds." It can be accepted or rejected. An event is a fact that already happened: "TransferCompleted" or "FundsDeposited." Events are past tense and immutable — you never delete or update them.

```java
// Command — a request, may be rejected
public record TransferCommand(String fromAccount, String toAccount, double amount) {}

// Event — an immutable fact
public record FundsDeposited(String accountId, double amount, long timestamp) {}
public record FundsWithdrawn(String accountId, double amount, long timestamp) {}
public record TransferCompleted(String fromAccount, String toAccount, double amount, long timestamp) {}
```

### Event-Driven Architecture Overview

In an event-driven system, components communicate through events rather than direct calls. Producers publish events to an event bus (Kafka, RabbitMQ, or even an in-memory bus). Consumers subscribe to events they care about. This creates loose coupling — the account service doesn't need to know the notification service exists.

```java
// Producer publishes an event
eventBus.publish(new FundsDeposited("ACC-001", 500.0, System.currentTimeMillis()));

// Consumer reacts independently
@EventListener
public void onDeposit(FundsDeposited event) {
    notificationService.sendDepositAlert(event.accountId(), event.amount());
}
```

### Event Sourcing

Instead of storing current state ("balance = $1,300"), you store the sequence of events that led to it. The current state is derived by replaying all events from the beginning.

```java
public class EventSourcedAccount {
    private final String accountId;
    private final List<AccountEvent> events = new ArrayList<>();

    public double getBalance() {
        double balance = 0;
        for (AccountEvent event : events) {
            if (event instanceof FundsDeposited d) balance += d.amount();
            if (event instanceof FundsWithdrawn w) balance -= w.amount();
        }
        return balance;
    }
}
```

### CQRS — Command Query Responsibility Segregation

CQRS separates the write model (handling commands, producing events) from the read model (materialized views optimized for queries). The write side stores events; the read side projects them into denormalized tables. This lets you optimize reads and writes independently — your transaction ledger can use append-only storage while your balance query hits a fast cache.

```java
// Write side — handles commands, stores events
public void handleDeposit(DepositCommand cmd) {
    FundsDeposited event = new FundsDeposited(cmd.accountId(), cmd.amount(), System.currentTimeMillis());
    eventStore.append(event);
    eventBus.publish(event);
}

// Read side — updates a materialized view
public void onFundsDeposited(FundsDeposited event) {
    accountSummaryRepository.updateBalance(event.accountId(), event.amount());
}
```

### Eventual Consistency and Compensating Transactions

In distributed event-driven systems, the read model may lag behind the write model. This is eventual consistency — your bank statement might be a few seconds behind your latest transaction. This is acceptable because the system guarantees that the data will converge. When something fails mid-process, compensating transactions undo partial work — if a credit fails after a debit, the system issues a compensating credit back to the source.

### The Saga Pattern

A saga coordinates multi-step processes across services. For a bank transfer: (1) debit the source account, (2) credit the destination account. If step 2 fails, a compensation step reverses step 1. Each step publishes an event that triggers the next.

```java
// Saga steps
// Step 1: Debit source → publishes "SourceDebited"
// Step 2: Credit destination → publishes "TransferCompleted"
// Compensation: If step 2 fails → publishes "DebitReversed"
```

### Domain Events in Spring

Spring provides built-in event support via `ApplicationEventPublisher` and `@EventListener`. Use `@TransactionalEventListener` to ensure events fire only after a transaction commits — critical for banking systems.

```java
@Service
public class TransferService {
    @Autowired
    private ApplicationEventPublisher publisher;

    @Transactional
    public void transfer(String from, String to, double amount) {
        // perform transfer logic...
        publisher.publishEvent(new TransferCompleted(from, to, amount, System.currentTimeMillis()));
    }
}
```

## Why It Matters

Event-driven architecture is the backbone of modern banking systems. Event sourcing gives you a complete, immutable audit trail that satisfies regulators and simplifies debugging. CQRS lets you scale reads and writes independently — essential when millions of customers check balances while thousands of transactions process per second. Understanding these patterns signals to interviewers that you can design systems that are both resilient and compliant.

## Challenge

Implement a simple event-sourced `BankAccount` that stores events (deposits and withdrawals) in a list and computes the current balance by replaying all events. Create several transactions and print the event log alongside the computed balance.

## Starter Code
```java
import java.util.ArrayList;
import java.util.List;

public class EventSourcedBank {

    sealed interface AccountEvent permits DepositEvent, WithdrawalEvent {}

    record DepositEvent(String accountId, double amount, String description) implements AccountEvent {}
    record WithdrawalEvent(String accountId, double amount, String description) implements AccountEvent {}

    static class BankAccount {
        private final String accountId;
        private final List<AccountEvent> eventLog = new ArrayList<>();

        public BankAccount(String accountId) {
            this.accountId = accountId;
        }

        public void deposit(double amount, String description) {
            // TODO: Create a DepositEvent and add it to the event log
        }

        public void withdraw(double amount, String description) {
            // TODO: Create a WithdrawalEvent and add it to the event log
            // TODO: Check if sufficient funds by computing current balance first
        }

        public double getBalance() {
            // TODO: Replay all events to compute the current balance
            return 0;
        }

        public void printEventLog() {
            // TODO: Print each event in the log with its type and amount
        }
    }

    public static void main(String[] args) {
        BankAccount account = new BankAccount("ACC-1001");

        account.deposit(1000.00, "Initial deposit");
        account.deposit(500.00, "Payroll deposit");
        account.withdraw(200.00, "ATM withdrawal");
        account.withdraw(150.00, "Bill payment");
        account.deposit(75.00, "Refund");

        System.out.println("=== Event Log ===");
        account.printEventLog();

        System.out.println("\n=== Current State ===");
        System.out.println("Balance (computed from events): $" + account.getBalance());
        System.out.println("Total events: " + account.eventLog.size());
    }
}
```

## Expected Output
```
=== Event Log ===
Event 1: DEPOSIT +$1000.0 (Initial deposit)
Event 2: DEPOSIT +$500.0 (Payroll deposit)
Event 3: WITHDRAWAL -$200.0 (ATM withdrawal)
Event 4: WITHDRAWAL -$150.0 (Bill payment)
Event 5: DEPOSIT +$75.0 (Refund)

=== Current State ===
Balance (computed from events): $1225.0
Total events: 5
```

## Hint

In `getBalance()`, loop through `eventLog` and add for `DepositEvent`, subtract for `WithdrawalEvent`. Use `instanceof` pattern matching to check the event type. For `withdraw()`, compute the current balance first and only add the event if there are sufficient funds.

## Solution
```java
import java.util.ArrayList;
import java.util.List;

public class EventSourcedBank {

    sealed interface AccountEvent permits DepositEvent, WithdrawalEvent {}

    record DepositEvent(String accountId, double amount, String description) implements AccountEvent {}
    record WithdrawalEvent(String accountId, double amount, String description) implements AccountEvent {}

    static class BankAccount {
        private final String accountId;
        private final List<AccountEvent> eventLog = new ArrayList<>();

        public BankAccount(String accountId) {
            this.accountId = accountId;
        }

        public void deposit(double amount, String description) {
            eventLog.add(new DepositEvent(accountId, amount, description));
        }

        public void withdraw(double amount, String description) {
            if (getBalance() >= amount) {
                eventLog.add(new WithdrawalEvent(accountId, amount, description));
            } else {
                System.out.println("Insufficient funds for: " + description);
            }
        }

        public double getBalance() {
            double balance = 0;
            for (AccountEvent event : eventLog) {
                if (event instanceof DepositEvent d) {
                    balance += d.amount();
                } else if (event instanceof WithdrawalEvent w) {
                    balance -= w.amount();
                }
            }
            return balance;
        }

        public void printEventLog() {
            for (int i = 0; i < eventLog.size(); i++) {
                AccountEvent event = eventLog.get(i);
                if (event instanceof DepositEvent d) {
                    System.out.println("Event " + (i + 1) + ": DEPOSIT +$" + d.amount() + " (" + d.description() + ")");
                } else if (event instanceof WithdrawalEvent w) {
                    System.out.println("Event " + (i + 1) + ": WITHDRAWAL -$" + w.amount() + " (" + w.description() + ")");
                }
            }
        }
    }

    public static void main(String[] args) {
        BankAccount account = new BankAccount("ACC-1001");

        account.deposit(1000.00, "Initial deposit");
        account.deposit(500.00, "Payroll deposit");
        account.withdraw(200.00, "ATM withdrawal");
        account.withdraw(150.00, "Bill payment");
        account.deposit(75.00, "Refund");

        System.out.println("=== Event Log ===");
        account.printEventLog();

        System.out.println("\n=== Current State ===");
        System.out.println("Balance (computed from events): $" + account.getBalance());
        System.out.println("Total events: " + account.eventLog.size());
    }
}
```
