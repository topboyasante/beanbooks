---
id: "message-queues"
moduleId: "backend-patterns"
title: "Message Queues & Pub/Sub"
description: "Build asynchronous systems with message queues, producers, consumers, and dead letter queues."
order: 5
---

## Banking Scenario

When a customer makes a transfer, the bank does not send an email, update analytics, notify fraud detection, and generate a receipt synchronously. Instead, it publishes a "TransferCompleted" event to a message queue, and independent consumers handle each downstream action. This decoupling makes the system faster, more resilient, and easier to extend.

If the email service is down, the transfer still succeeds. If fraud detection is slow, the customer does not wait. If a new compliance requirement appears, you add a new consumer without touching the transfer code. Message queues are the backbone of modern banking architecture.

## Content

### Synchronous vs Asynchronous Processing

In a synchronous system, every step must complete before the next one starts. A transfer that sends an email, logs an audit record, updates analytics, and notifies fraud detection takes the sum of all those operations:

```java
// Synchronous: 50ms + 200ms + 100ms + 150ms = 500ms total
transferFunds(from, to, amount);    // 50ms
sendEmail(to, receipt);              // 200ms
logAuditRecord(transfer);           // 100ms
notifyFraudDetection(transfer);     // 150ms
// Customer waits 500ms
```

With a message queue, the transfer completes in 50ms. Everything else happens asynchronously:

```java
// Asynchronous: 50ms + 5ms publish = 55ms total
transferFunds(from, to, amount);    // 50ms
messageQueue.publish(transferEvent); // 5ms
// Customer waits 55ms, consumers process independently
```

### Message Queue Concepts

A **producer** sends messages to a queue. A **consumer** reads messages from the queue and processes them. The queue acts as a buffer between the two.

Key concepts:
- **Messages** carry data (the transfer event with amount, accounts, timestamp).
- **Acknowledgments** tell the queue a message was successfully processed. Unacknowledged messages can be redelivered.
- **Ordering**: Some queues guarantee order (Kafka partitions), others do not (basic RabbitMQ queues).

### Point-to-Point vs Pub/Sub

**Point-to-point (Queue)**: One message is consumed by exactly one consumer. Use for work distribution, like processing transactions across multiple workers.

**Pub/Sub (Topic)**: One message is delivered to all subscribers. Use when multiple services need to react to the same event, like a transfer triggering notifications, audit, and analytics simultaneously.

```java
// Point-to-point: transaction processing
// Message -> [Queue] -> ONE of Worker A, B, or C

// Pub/Sub: event broadcasting
// Message -> [Topic] -> Notification Service
//                    -> Audit Service
//                    -> Analytics Service
```

### Apache Kafka Overview

Kafka is a distributed log-based message broker. Banks favor it for several reasons:

- **Topics** are streams of records organized into **partitions**. Partitions enable parallelism.
- **Consumer groups** allow scaling: each partition is consumed by one consumer in the group.
- **Offsets** track each consumer's position. Consumers can replay from any offset, making debugging and reprocessing possible.
- **Durability**: Messages are persisted to disk with configurable retention (days or weeks).
- **Ordering**: Messages within a partition are strictly ordered. Use account ID as the partition key to guarantee per-account ordering.

```java
// Spring Kafka producer
// kafkaTemplate.send("transfers", accountId, transferEvent);

// Spring Kafka consumer
// @KafkaListener(topics = "transfers", groupId = "audit-service")
// public void handleTransfer(TransferEvent event) { ... }
```

### RabbitMQ Overview

RabbitMQ is a traditional message broker using the AMQP protocol. It routes messages through **exchanges** to **queues** via **bindings** and **routing keys**:

- **Direct exchange**: Routes to queues whose binding key exactly matches the routing key.
- **Fanout exchange**: Broadcasts to all bound queues (pub/sub).
- **Topic exchange**: Routes based on pattern matching (e.g., `transfer.completed.*`).

Choose RabbitMQ for complex routing, low-latency delivery, and when you do not need message replay. Choose Kafka for high throughput, event sourcing, and when consumers need to reprocess historical events.

### Dead Letter Queues and Retry Strategies

When a consumer fails to process a message, it should not be lost. A **dead letter queue (DLQ)** captures messages that repeatedly fail processing:

```java
// Processing flow with retries
// 1. Consumer receives message
// 2. Processing fails -> message goes back to queue
// 3. After 3 retries -> message moves to DLQ
// 4. Operations team investigates DLQ messages

// Poison messages: messages that can never be processed
// (e.g., malformed data, referencing deleted accounts)
// DLQ prevents them from blocking the main queue forever
```

Retry strategies include immediate retry, exponential backoff (wait 1s, 2s, 4s, 8s), and scheduled retry with a delay queue.

### Idempotency

Network failures can cause duplicate message delivery. If a consumer processes a transfer notification twice, the customer might get two emails. Idempotency ensures processing a message multiple times has the same effect as processing it once:

```java
// Idempotent consumer using a processed-message store
Set<String> processedIds = new HashSet<>();

public void handleEvent(TransferEvent event) {
    if (processedIds.contains(event.getEventId())) {
        System.out.println("Duplicate detected, skipping: " + event.getEventId());
        return;
    }
    processEvent(event);
    processedIds.add(event.getEventId());
}
```

In production, store processed event IDs in a database or Redis with a TTL, not an in-memory set.

## Why It Matters

Message queues transform brittle, slow, tightly coupled systems into resilient, fast, loosely coupled architectures. In banking, this is not a nice-to-have -- it is how modern systems are built. Every major bank uses Kafka or RabbitMQ (or both) to decouple transaction processing from downstream operations. Understanding producers, consumers, pub/sub, dead letter queues, and idempotency is fundamental to building and maintaining banking backend systems at scale.

## Challenge

Simulate a pub/sub system where a "TransferCompleted" event is published and consumed by three independent subscribers: a notification service, an audit service, and an analytics service.

## Starter Code

```java
import java.util.ArrayList;
import java.util.List;

public class MessageQueues {

    // TODO: Create a TransferEvent class with fields: eventId, fromAccount, toAccount, amount

    // TODO: Create a Subscriber interface with a method: void onEvent(TransferEvent event)

    // TODO: Create an EventBus class with:
    // - A list of subscribers
    // - subscribe(Subscriber s) method
    // - publish(TransferEvent event) method that notifies all subscribers

    public static void main(String[] args) {
        System.out.println("=== Pub/Sub Banking Event System ===\n");

        // TODO: Create an EventBus
        // TODO: Subscribe NotificationService, AuditService, AnalyticsService
        // TODO: Publish a TransferCompleted event
        // TODO: Publish a second event to show idempotency handling
    }
}
```

## Expected Output

```
=== Pub/Sub Banking Event System ===

Publishing event: TXN-001 | Transfer $2500.00 from ACC-101 to ACC-205

[NotificationService] Sending email: "Transfer of $2500.00 to ACC-205 completed"
[AuditService] Logging: TXN-001 | ACC-101 -> ACC-205 | $2500.00 | 2026-04-01
[AnalyticsService] Recording: transfer_completed | amount=$2500.00

Publishing event: TXN-001 | Transfer $2500.00 from ACC-101 to ACC-205 (duplicate)

[NotificationService] Duplicate TXN-001 detected, skipping.
[AuditService] Duplicate TXN-001 detected, skipping.
[AnalyticsService] Duplicate TXN-001 detected, skipping.

Event processing complete. 2 events published, 3 subscribers notified.
```

## Hint

Create a `Subscriber` interface with an `onEvent(TransferEvent)` method. Each service implements this interface. The `EventBus` maintains a `List<Subscriber>` and its `publish` method loops through subscribers calling `onEvent`. For idempotency, each subscriber keeps a `Set<String>` of processed event IDs and checks before processing.

## Solution

```java
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MessageQueues {

    static class TransferEvent {
        String eventId;
        String fromAccount;
        String toAccount;
        double amount;

        TransferEvent(String eventId, String fromAccount, String toAccount, double amount) {
            this.eventId = eventId;
            this.fromAccount = fromAccount;
            this.toAccount = toAccount;
            this.amount = amount;
        }
    }

    interface Subscriber {
        void onEvent(TransferEvent event);
    }

    static class EventBus {
        private List<Subscriber> subscribers = new ArrayList<>();
        private int publishCount = 0;

        void subscribe(Subscriber s) {
            subscribers.add(s);
        }

        void publish(TransferEvent event) {
            publishCount++;
            for (Subscriber s : subscribers) {
                s.onEvent(event);
            }
        }

        int getPublishCount() { return publishCount; }
        int getSubscriberCount() { return subscribers.size(); }
    }

    static class NotificationService implements Subscriber {
        private Set<String> processed = new HashSet<>();

        public void onEvent(TransferEvent event) {
            if (processed.contains(event.eventId)) {
                System.out.println("[NotificationService] Duplicate " + event.eventId + " detected, skipping.");
                return;
            }
            processed.add(event.eventId);
            System.out.printf("[NotificationService] Sending email: \"Transfer of $%.2f to %s completed\"%n",
                    event.amount, event.toAccount);
        }
    }

    static class AuditService implements Subscriber {
        private Set<String> processed = new HashSet<>();

        public void onEvent(TransferEvent event) {
            if (processed.contains(event.eventId)) {
                System.out.println("[AuditService] Duplicate " + event.eventId + " detected, skipping.");
                return;
            }
            processed.add(event.eventId);
            System.out.printf("[AuditService] Logging: %s | %s -> %s | $%.2f | 2026-04-01%n",
                    event.eventId, event.fromAccount, event.toAccount, event.amount);
        }
    }

    static class AnalyticsService implements Subscriber {
        private Set<String> processed = new HashSet<>();

        public void onEvent(TransferEvent event) {
            if (processed.contains(event.eventId)) {
                System.out.println("[AnalyticsService] Duplicate " + event.eventId + " detected, skipping.");
                return;
            }
            processed.add(event.eventId);
            System.out.printf("[AnalyticsService] Recording: transfer_completed | amount=$%.2f%n", event.amount);
        }
    }

    public static void main(String[] args) {
        System.out.println("=== Pub/Sub Banking Event System ===\n");

        EventBus bus = new EventBus();
        bus.subscribe(new NotificationService());
        bus.subscribe(new AuditService());
        bus.subscribe(new AnalyticsService());

        TransferEvent event1 = new TransferEvent("TXN-001", "ACC-101", "ACC-205", 2500.00);

        System.out.printf("Publishing event: %s | Transfer $%.2f from %s to %s%n%n",
                event1.eventId, event1.amount, event1.fromAccount, event1.toAccount);
        bus.publish(event1);

        System.out.printf("%nPublishing event: %s | Transfer $%.2f from %s to %s (duplicate)%n%n",
                event1.eventId, event1.amount, event1.fromAccount, event1.toAccount);
        bus.publish(event1);

        System.out.printf("%nEvent processing complete. %d events published, %d subscribers notified.%n",
                bus.getPublishCount(), bus.getSubscriberCount());
    }
}
```
