---
id: "mockito"
moduleId: "testing"
title: "Mockito"
description: "Mock dependencies to test components in isolation."
order: 2
---

## Banking Scenario

The `TransactionProcessor` at JavaBank does not work alone. It depends on an `AccountRepository` to look up accounts, a `NotificationService` to send alerts, and an `AuditLogger` to record every action. When you write a unit test for `TransactionProcessor`, you do not want to send real emails or write to a real database. You need to isolate the component and test only its logic.

Mockito is the most popular mocking framework in Java. It lets you create fake implementations of dependencies that behave exactly how you tell them to. This way, you can test that your `TransactionProcessor` calls the notification service after a successful withdrawal without actually sending a notification.

## Content

### Why Mocking Matters

Unit tests should test one class in isolation. If your test fails, you want to know immediately that the bug is in the class under test, not in some dependency. Real dependencies introduce problems: databases may be unavailable, network calls are slow, external services have rate limits, and side effects like sending emails are irreversible.

Mocking solves these problems by replacing real dependencies with controlled substitutes. A mock object looks like the real thing to the class under test but does nothing unless you tell it to. You can configure mocks to return specific values, throw exceptions, or simply record that they were called. This gives you complete control over the test environment.

In banking applications, mocking is essential for testing transaction flows without touching real accounts or payment gateways. You can simulate scenarios like network timeouts, insufficient funds responses from external systems, or compliance service rejections, all without any infrastructure.

```java
// Without mocking: real dependencies, slow, fragile
TransactionProcessor processor = new TransactionProcessor(
    new DatabaseAccountRepo(),    // needs database
    new EmailNotificationService(), // sends real emails
    new FileAuditLogger()          // writes to disk
);

// With mocking: isolated, fast, reliable
AccountRepository mockRepo = Mockito.mock(AccountRepository.class);
NotificationService mockNotifier = Mockito.mock(NotificationService.class);
AuditLogger mockLogger = Mockito.mock(AuditLogger.class);
TransactionProcessor processor = new TransactionProcessor(mockRepo, mockNotifier, mockLogger);
```

### Creating Mocks

Mockito provides two ways to create mocks. The `Mockito.mock()` method creates a mock inline, while the `@Mock` annotation combined with `MockitoAnnotations.openMocks()` sets up mocks declaratively. The annotation approach is cleaner when you have multiple mocks.

By default, mock methods return sensible defaults: `null` for objects, `0` for numbers, `false` for booleans, and empty collections for collection types. You override these defaults with stubbing to make the mock behave as your test requires.

```java
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

class TransactionProcessorTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private NotificationService notificationService;

    private TransactionProcessor processor;

    void setUp() {
        MockitoAnnotations.openMocks(this);
        processor = new TransactionProcessor(accountRepository, notificationService);
    }
}
```

The `@InjectMocks` annotation goes one step further. It creates an instance of the class under test and automatically injects the mocks into it, either through constructor injection, setter injection, or field injection. This reduces boilerplate when the class has multiple dependencies.

```java
@Mock private AccountRepository accountRepository;
@Mock private NotificationService notificationService;

@InjectMocks
private TransactionProcessor processor; // mocks injected automatically
```

### When/ThenReturn Stubbing

The `when(...).thenReturn(...)` pattern tells a mock what to return when a specific method is called. This is called stubbing. You set up the mock's behavior before calling the method under test, ensuring the class under test receives the data it needs.

You can chain multiple `thenReturn` calls for consecutive invocations. The first call returns the first value, the second call returns the second value, and so on. You can also use `thenThrow` to simulate error conditions, which is critical for testing error handling in banking code.

```java
// Stub a method to return a specific value
when(accountRepository.findById("ACC-001"))
    .thenReturn(new Account("ACC-001", "Alice", 5000.0));

// Stub to throw an exception
when(accountRepository.findById("INVALID"))
    .thenThrow(new AccountNotFoundException("Account not found"));

// Consecutive returns
when(accountRepository.getNextTransactionId())
    .thenReturn("TXN-001")
    .thenReturn("TXN-002")
    .thenReturn("TXN-003");
```

### Verify Interactions

Stubbing controls what mocks return. Verification checks that mocks were called correctly. The `verify()` method asserts that a specific method was called on a mock, optionally checking how many times and with what arguments. This is crucial when the method under test has side effects.

In banking, you often need to verify that notifications were sent, audit logs were written, or compliance checks were performed. The return value might not tell you this, but verification will. You can also use `never()` to assert that something was not called.

```java
// Verify a method was called exactly once
verify(notificationService).sendAlert("ACC-001", "Withdrawal: $500.0");

// Verify called exactly N times
verify(auditLogger, times(2)).log(any(String.class));

// Verify never called
verify(notificationService, never()).sendAlert(eq("ACC-002"), any());

// Verify call order
InOrder inOrder = Mockito.inOrder(accountRepository, notificationService);
inOrder.verify(accountRepository).updateBalance(any(), any());
inOrder.verify(notificationService).sendAlert(any(), any());
```

### Argument Captors

Sometimes you need to inspect the exact arguments passed to a mock. Argument captors capture the values for later assertion. This is useful when the argument is constructed inside the method under test and you cannot predict its exact form.

For example, if your `TransactionProcessor` creates a `TransactionRecord` internally and passes it to the audit logger, you can capture that record and verify its fields individually. This gives you fine-grained control over your assertions.

```java
import org.mockito.ArgumentCaptor;

@Test
void shouldLogTransactionDetails() {
    ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);

    processor.processWithdrawal("ACC-001", 500.0);

    verify(auditLogger).log(messageCaptor.capture());

    String loggedMessage = messageCaptor.getValue();
    assertTrue(loggedMessage.contains("ACC-001"));
    assertTrue(loggedMessage.contains("500.0"));
    assertTrue(loggedMessage.contains("WITHDRAWAL"));
}
```

### BDD Style Testing

Behavior-Driven Development (BDD) uses `given`/`when`/`then` language to make tests read like specifications. Mockito supports this through `BDDMockito`, which provides `given()` as an alias for `when()` and `then()` for `verify()`. This style is popular in banking teams that work closely with business analysts.

BDD-style tests clearly communicate the business scenario being tested. Instead of technical mock setup, the test reads as a business requirement: given an account exists, when a withdrawal is made, then a notification should be sent.

```java
import static org.mockito.BDDMockito.*;

@Test
void shouldNotifyAfterSuccessfulWithdrawal() {
    // Given
    Account account = new Account("ACC-001", "Alice", 5000.0);
    given(accountRepository.findById("ACC-001")).willReturn(account);

    // When
    processor.processWithdrawal("ACC-001", 500.0);

    // Then
    then(notificationService).should().sendAlert("ACC-001", "Withdrawal: $500.0");
    then(accountRepository).should().updateBalance("ACC-001", 4500.0);
}
```

## Why It Matters

In enterprise banking systems, classes rarely work in isolation. They depend on repositories, services, gateways, and external APIs. Mockito lets you test your business logic without spinning up databases or calling third-party services. This makes your tests fast, reliable, and focused. Every banking Java team uses Mockito or a similar mocking framework, and interviewers will expect you to understand mocking concepts and demonstrate them confidently.

## Challenge

Mock a `NotificationService` and verify that `TransactionProcessor` calls it after a successful withdrawal. Simulate the interaction and print verification results.

## Starter Code
```java
interface NotificationService {
    void sendNotification(String accountId, String message);
}

interface AccountRepository {
    double getBalance(String accountId);
    void updateBalance(String accountId, double newBalance);
}

class TransactionProcessor {
    private AccountRepository repository;
    private NotificationService notificationService;

    public TransactionProcessor(AccountRepository repo, NotificationService notifier) {
        this.repository = repo;
        this.notificationService = notifier;
    }

    public void processWithdrawal(String accountId, double amount) {
        double balance = repository.getBalance(accountId);
        if (balance >= amount) {
            repository.updateBalance(accountId, balance - amount);
            notificationService.sendNotification(accountId,
                "Withdrawn: $" + amount);
            System.out.println("Transaction processed successfully");
        }
    }
}

public class Main {
    public static void main(String[] args) {
        // TODO: Create mock implementations of AccountRepository and NotificationService
        // TODO: Set up the mock repository to return 5000.0 for account "ACC-001"
        // TODO: Create TransactionProcessor with mocks
        // TODO: Process a withdrawal of 500.0
        // TODO: Verify notification was sent and print confirmation
    }
}
```

## Expected Output
```
Transaction processed successfully
Notification sent: verified
```

## Hint

Since we cannot use Mockito directly without a build tool, create simple anonymous inner classes or local classes that implement the interfaces. The `AccountRepository` mock should return 5000.0 from `getBalance`. The `NotificationService` mock should set a boolean flag when `sendNotification` is called. After processing the withdrawal, check the flag to verify the notification was sent.

## Solution
```java
interface NotificationService {
    void sendNotification(String accountId, String message);
}

interface AccountRepository {
    double getBalance(String accountId);
    void updateBalance(String accountId, double newBalance);
}

class TransactionProcessor {
    private AccountRepository repository;
    private NotificationService notificationService;

    public TransactionProcessor(AccountRepository repo, NotificationService notifier) {
        this.repository = repo;
        this.notificationService = notifier;
    }

    public void processWithdrawal(String accountId, double amount) {
        double balance = repository.getBalance(accountId);
        if (balance >= amount) {
            repository.updateBalance(accountId, balance - amount);
            notificationService.sendNotification(accountId,
                "Withdrawn: $" + amount);
            System.out.println("Transaction processed successfully");
        }
    }
}

public class Main {
    public static void main(String[] args) {
        final boolean[] notified = {false};

        AccountRepository mockRepo = new AccountRepository() {
            public double getBalance(String accountId) { return 5000.0; }
            public void updateBalance(String accountId, double newBalance) { }
        };

        NotificationService mockNotifier = new NotificationService() {
            public void sendNotification(String accountId, String message) {
                notified[0] = true;
            }
        };

        TransactionProcessor processor = new TransactionProcessor(mockRepo, mockNotifier);
        processor.processWithdrawal("ACC-001", 500.0);

        System.out.println("Notification sent: " + (notified[0] ? "verified" : "failed"));
    }
}
```
