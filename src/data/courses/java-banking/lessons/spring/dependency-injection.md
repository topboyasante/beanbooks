---
id: "dependency-injection"
moduleId: "spring"
title: "Dependency Injection"
description: "Understand IoC, the Spring container, and how beans are wired together."
order: 1
---

## Banking Scenario

When building JavaBank's account management system, the `AccountService` class needs an `AccountRepository` to access the database. Without a framework, you would write `new JpaAccountRepository()` directly inside `AccountService`. This creates tight coupling: if you want to switch to a different repository implementation for testing or migration, you must modify `AccountService` itself.

Spring Framework solves this through Dependency Injection (DI). Instead of creating its own dependencies, `AccountService` declares what it needs, and Spring provides it. This makes your banking application modular, testable, and easy to reconfigure without changing business logic.

## Content

### The Tight Coupling Problem

Tight coupling occurs when a class creates its own dependencies using `new`. This seems harmless in small programs but becomes a serious problem in enterprise systems. Every time you use `new JpaAccountRepository()` inside a service, you hardcode a specific implementation. Changing the database, adding a caching layer, or using a mock for testing all require modifying the service class.

In banking, this matters because systems evolve constantly. You might start with an in-memory repository for development, use H2 for testing, and PostgreSQL for production. The business logic in `AccountService` should not care which database is behind the repository. Tight coupling forces it to care.

The deeper issue is that tight coupling makes unit testing nearly impossible. If `AccountService` internally creates a `JpaAccountRepository`, every test of `AccountService` requires a real database. Tests become slow, fragile, and dependent on external infrastructure.

```java
// TIGHT COUPLING: AccountService controls its dependency
class AccountService {
    private JpaAccountRepository repository = new JpaAccountRepository();
    // Cannot swap implementation without modifying this class
    // Cannot test without a real database

    public String findAccount(String id) {
        return repository.findById(id);
    }
}

// LOOSE COUPLING: Dependency is injected
class AccountService {
    private final AccountRepository repository; // interface, not concrete class

    AccountService(AccountRepository repository) {
        this.repository = repository; // injected from outside
    }

    public String findAccount(String id) {
        return repository.findById(id);
    }
}
```

### Inversion of Control

Inversion of Control (IoC) is the principle behind dependency injection. In traditional programming, your code controls the flow: it creates objects, calls methods, and manages lifecycles. With IoC, a container (Spring) controls object creation and wiring. Your code simply declares its dependencies, and the container provides them.

The Spring IoC container reads your configuration (annotations, Java config, or XML), creates all the required objects (called beans), and wires them together. When your application starts, the container builds a complete object graph. `AccountService` gets its `AccountRepository`, `TransactionProcessor` gets its `AccountService` and `NotificationService`, and so on.

This is called "inversion" because the control of object creation is inverted from the application code to the framework. Your code becomes simpler because it focuses only on business logic, not on object management.

```java
// Without IoC: You manage everything
AccountRepository repo = new JpaAccountRepository();
NotificationService notifier = new EmailNotificationService();
AccountService service = new AccountService(repo);
TransactionProcessor processor = new TransactionProcessor(service, notifier);

// With Spring IoC: The container manages everything
// You just declare components with annotations
// Spring creates and wires them automatically
```

### Spring ApplicationContext

The `ApplicationContext` is Spring's IoC container. It reads your configuration, creates beans, resolves dependencies, and manages bean lifecycles. When your Spring application starts, the `ApplicationContext` scans for annotated classes, creates instances, and injects dependencies.

You rarely interact with `ApplicationContext` directly. Instead, you annotate your classes and let Spring do the work. However, understanding what happens behind the scenes helps you debug configuration issues and understand error messages about missing beans or circular dependencies.

Spring creates beans in the correct order based on their dependencies. If `AccountService` depends on `AccountRepository`, Spring creates the repository first, then injects it into the service. If there is a circular dependency (A depends on B, B depends on A), Spring will throw an error at startup rather than failing at runtime.

```java
// Spring scans for these annotations and creates beans
@Repository
class JpaAccountRepository implements AccountRepository {
    public String findById(String id) {
        return "Account: " + id;
    }
}

@Service
class AccountService {
    private final AccountRepository repository;

    @Autowired
    AccountService(AccountRepository repository) {
        this.repository = repository;
    }
}

// ApplicationContext builds the complete object graph at startup
// ApplicationContext ctx = SpringApplication.run(App.class, args);
// AccountService service = ctx.getBean(AccountService.class);
```

### Component Stereotypes

Spring provides stereotype annotations to mark classes as beans. `@Component` is the generic annotation. `@Service` marks business logic classes. `@Repository` marks data access classes. `@Controller` marks web controllers. Functionally, they all register the class as a Spring bean, but they convey intent and enable specific features.

`@Repository` automatically translates database exceptions into Spring's `DataAccessException` hierarchy, making error handling consistent across different databases. `@Service` clearly marks where business rules live. Using the right stereotype makes your codebase self-documenting and helps new team members navigate the architecture.

Constructor injection is the preferred approach in modern Spring. You declare dependencies as constructor parameters, and Spring automatically provides them. With a single constructor, you do not even need `@Autowired`. This makes the dependency requirements explicit and ensures the object is fully initialized before use.

```java
@Component   // generic Spring bean
class CurrencyConverter { }

@Service     // business logic bean
class TransferService { }

@Repository  // data access bean, translates SQL exceptions
class AccountRepository { }

@Controller  // web layer bean
class AccountController { }

// Constructor injection (preferred)
@Service
class TransferService {
    private final AccountRepository accountRepo;
    private final AuditService auditService;

    // Single constructor: @Autowired is optional
    TransferService(AccountRepository accountRepo, AuditService auditService) {
        this.accountRepo = accountRepo;
        this.auditService = auditService;
    }
}
```

### Bean Scopes

By default, Spring beans are singletons: one instance per application context, shared across the entire application. This is efficient for stateless services like `AccountService` or `TransactionValidator` that do not hold per-request data.

The `prototype` scope creates a new instance every time the bean is requested. Use this for stateful objects that should not be shared, like a `TransactionBuilder` that accumulates data for a single transaction. Other scopes include `request` (one per HTTP request) and `session` (one per user session), which are useful in web applications.

Choosing the correct scope is important for correctness and thread safety. A singleton `AccountService` must be thread-safe because multiple requests will use it simultaneously. If it held mutable state per transaction, concurrent requests would corrupt each other's data.

```java
@Service
@Scope("singleton") // default, one instance for the whole app
class AccountService {
    // stateless, safe to share across threads
}

@Component
@Scope("prototype") // new instance each time
class TransactionBuilder {
    private String fromAccount;
    private String toAccount;
    private double amount;
    // stateful, should not be shared
}
```

### Why DI Matters for Testing

Dependency injection transforms testing from painful to trivial. When dependencies are injected through constructors, you can pass mock implementations in your tests without any framework magic. This is the single biggest practical benefit of DI in banking applications.

Without DI, testing `AccountService` means testing it with a real database, real network connections, and real notification services. With DI, you inject test doubles that return predefined data and verify interactions. Tests run in milliseconds instead of seconds, need no external infrastructure, and are completely deterministic.

```java
// Testing with DI: inject a fake repository
class AccountServiceTest {
    void testFindAccount() {
        // Create a simple test implementation
        AccountRepository testRepo = new AccountRepository() {
            public String findById(String id) {
                return "Test Account: " + id;
            }
        };

        // Inject the test implementation
        AccountService service = new AccountService(testRepo);

        String result = service.findAccount("ACC-001");
        assert result.equals("Test Account: ACC-001");
    }
}
```

## Why It Matters

Dependency injection is the foundation of the entire Spring ecosystem. Every Spring application uses DI to wire components together. Understanding IoC, stereotypes, and constructor injection is essential for any Java developer working with Spring. In banking, DI enables the modularity and testability that large-scale financial systems require. It is one of the first topics covered in Spring interviews and one of the concepts you will use every single day on the job.

## Challenge

Demonstrate the constructor injection pattern. Create an `AccountService` that depends on an `AccountRepository` interface. Implement the repository and inject it into the service, then use the service to look up an account.

## Starter Code
```java
interface AccountRepository {
    String findById(String id);
}

public class Main {
    public static void main(String[] args) {
        // TODO: Create a JpaAccountRepository class that implements AccountRepository
        //       findById should return "Alice Martin" for id "ACC-001"
        // TODO: Create an AccountService class that takes AccountRepository via constructor
        // TODO: Print that service is initialized with repository class name
        // TODO: Look up account "ACC-001" and print the result
    }
}
```

## Expected Output
```
AccountService initialized with: JpaAccountRepository
Account lookup: Alice Martin
```

## Hint

Create a `JpaAccountRepository` class implementing `AccountRepository` with a `findById` method that returns "Alice Martin". Create an `AccountService` class with a constructor that takes `AccountRepository` and stores it. Use `repository.getClass().getSimpleName()` to print the class name in the initialization message.

## Solution
```java
interface AccountRepository {
    String findById(String id);
}

class JpaAccountRepository implements AccountRepository {
    public String findById(String id) {
        if ("ACC-001".equals(id)) {
            return "Alice Martin";
        }
        return "Unknown";
    }
}

class AccountService {
    private final AccountRepository repository;

    AccountService(AccountRepository repository) {
        this.repository = repository;
        System.out.println("AccountService initialized with: "
            + repository.getClass().getSimpleName());
    }

    String lookupAccount(String id) {
        return repository.findById(id);
    }
}

public class Main {
    public static void main(String[] args) {
        AccountRepository repo = new JpaAccountRepository();
        AccountService service = new AccountService(repo);

        String holder = service.lookupAccount("ACC-001");
        System.out.println("Account lookup: " + holder);
    }
}
```
