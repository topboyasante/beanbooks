---
id: "layered-architecture"
moduleId: "spring"
title: "Layered Architecture & DTOs"
description: "Structure your application with Controller, Service, and Repository layers using DTOs for clean separation."
order: 5
---

## Banking Scenario

In a real banking application, you never expose your database entities directly in API responses. An Account entity might contain internal fields like `passwordHash`, `internalNotes`, or audit timestamps such as `createdBy` and `lastModifiedAt` that clients should never see. Leaking these fields is both a security risk and a maintenance burden, because any change to your database schema would break every API consumer.

The layered architecture pattern (Controller, Service, Repository) with Data Transfer Objects ensures clean separation between your API contract, your business logic, and your data access. Every professional banking team enforces this pattern because it keeps each layer focused on a single responsibility and makes the codebase easier to test, maintain, and evolve.

## Content

### Three-Layer Architecture

Spring applications are organized into three distinct layers, each with a clear responsibility:

- **Controller layer** handles HTTP requests and responses. It receives input, delegates work to the service layer, and returns results.
- **Service layer** contains business logic. Rules like "a withdrawal cannot exceed the account balance" or "new accounts start with a zero balance" live here.
- **Repository layer** talks to the database. It saves, retrieves, updates, and deletes entities.

Why not skip layers? You might think the controller could call the repository directly. But then your business rules end up scattered across controllers, making them impossible to reuse and difficult to test. The service layer acts as a single place where all business logic lives, regardless of whether it is triggered by an HTTP request, a scheduled job, or a message queue.

```java
// The flow of a request through the layers
// HTTP Request → Controller → Service → Repository → Database
// HTTP Response ← Controller ← Service ← Repository ← Database
```

### Controller Layer

The controller receives incoming HTTP requests, validates basic input, delegates to the service, and returns a response. It should contain no business logic whatsoever. Its only job is translating between HTTP and Java.

```java
@RestController
@RequestMapping("/api/accounts")
class AccountController {

    private final AccountService accountService;

    AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PostMapping
    AccountResponse createAccount(@RequestBody AccountCreateRequest request) {
        return accountService.createAccount(request);
    }
}
```

Notice the controller does not know how accounts are stored, what validation rules apply, or how entities map to responses. It simply passes the request to the service and returns whatever the service gives back.

### Service Layer

The service layer is where the real work happens. It enforces business rules, orchestrates calls to one or more repositories, and handles transactional boundaries. In a banking app, this is the most critical layer.

```java
@Service
class AccountService {

    private final AccountRepository accountRepository;

    AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    AccountResponse createAccount(AccountCreateRequest request) {
        // Business validation
        if (request.getHolderName() == null || request.getHolderName().isBlank()) {
            throw new IllegalArgumentException("Account holder name is required");
        }

        // Create entity from request
        Account account = new Account();
        account.setHolderName(request.getHolderName());
        account.setBalance(0.0);

        // Save through repository
        Account saved = accountRepository.save(account);

        // Map entity to response DTO
        return new AccountResponse(saved.getId(), saved.getHolderName(), saved.getBalance());
    }
}
```

### Repository Layer

The repository handles all database interactions. In Spring Data JPA, you typically extend `JpaRepository`, which provides standard CRUD methods out of the box. The repository returns entities, never DTOs.

```java
@Repository
interface AccountRepository extends JpaRepository<Account, Long> {
    // Spring Data JPA provides save(), findById(), findAll(), delete() automatically
    // You only add custom query methods here
    List<Account> findByHolderName(String holderName);
}
```

No business logic belongs in the repository. It should not validate data, enforce rules, or transform objects. Its sole purpose is translating between Java objects and database rows.

### DTOs (Data Transfer Objects)

DTOs are simple objects that define the shape of data crossing layer boundaries, particularly between your API and your service layer. You create separate DTOs for requests and responses.

```java
// What the client sends to create an account
class AccountCreateRequest {
    private String holderName;

    public String getHolderName() { return holderName; }
    public void setHolderName(String holderName) { this.holderName = holderName; }
}

// What the client receives back
class AccountResponse {
    private long id;
    private String holderName;
    private double balance;

    AccountResponse(long id, String holderName, double balance) {
        this.id = id;
        this.holderName = holderName;
        this.balance = balance;
    }

    public String toString() {
        return "AccountResponse{id=" + id + ", holderName=" + holderName + ", balance=" + balance + "}";
    }
}
```

Why use DTOs instead of entities? **Security**: your Account entity might have a `passwordHash` field that should never appear in an API response. **Flexibility**: you can change your database schema without breaking your API contract. **Validation**: create and update operations often require different fields, so `AccountCreateRequest` and `AccountUpdateRequest` can have different validation rules.

### Mapping Between Entities and DTOs

Mapping between entities and DTOs means copying fields from one object to another. In simple cases, you do this manually in the service layer. For a banking app with dozens of entities, manual mapping becomes tedious. Libraries like MapStruct (compile-time code generation) and ModelMapper (reflection-based) can automate this, but understanding manual mapping first is essential.

```java
// Manual mapping: Entity → DTO
AccountResponse toResponse(Account account) {
    return new AccountResponse(
        account.getId(),
        account.getHolderName(),
        account.getBalance()
    );
}
```

### Package Structure for a Complete Feature

A single banking feature like "accounts" spans across multiple packages. This is what a well-organized codebase looks like:

```java
// com.javabank.controller.AccountController   - handles /api/accounts endpoints
// com.javabank.service.AccountService          - business logic for accounts
// com.javabank.repository.AccountRepository    - database access for accounts
// com.javabank.model.Account                   - JPA entity
// com.javabank.dto.AccountCreateRequest        - request DTO
// com.javabank.dto.AccountResponse             - response DTO
```

Every feature follows this same structure. When you add a "transfers" feature, you create `TransferController`, `TransferService`, `TransferRepository`, `Transfer`, `TransferRequest`, and `TransferResponse` in their respective packages. The pattern is consistent and predictable.

## Why It Matters

The layered architecture is not optional in professional banking software. Regulatory audits often require clear separation of concerns so that business logic can be reviewed independently from data access code. When your service layer is the single source of truth for business rules, you can unit test those rules without a database, swap out your repository implementation without touching business logic, and add new entry points (like a message queue consumer) that reuse the same service layer. DTOs protect your API consumers from internal changes and prevent sensitive data from leaking through your endpoints.

## Challenge

Build a complete layered flow for creating a bank account. Create an `Account` entity, an `AccountResponse` DTO, and simulate the Controller calling the Service calling the Repository. The service should validate the input, the repository should simulate saving, and the controller should return the DTO.

## Starter Code
```java
public class LayeredArchitectureDemo {

    public static void main(String[] args) {
        // Simulate the controller receiving a request
        String holderName = "Alice Martin";
        System.out.println("Request: Create account for " + holderName);

        // TODO: Create a service and call it
        // TODO: Inside the service, validate and create an Account
        // TODO: Simulate saving with a repository (just assign id = 1)
        // TODO: Map the Account to an AccountResponse and print it
    }
}

class Account {
    private long id;
    private String holderName;
    private double balance;

    // TODO: Add getters and setters
}

class AccountResponse {
    // TODO: Add fields, constructor, and toString
}
```

## Expected Output
```
Request: Create account for Alice Martin
Service: Validating... OK
Repository: Saved Account{id=1}
Response: AccountResponse{id=1, holderName=Alice Martin, balance=0.0}
```

## Hint

Start by completing the `Account` class with getters, setters, and a `toString` method. Then build `AccountResponse` with a constructor that takes `id`, `holderName`, and `balance`. In `main`, simulate the service by printing the validation message, create an `Account` object, set its id to 1, print the repository save message, then create an `AccountResponse` from the account and print it.

## Solution
```java
public class LayeredArchitectureDemo {

    public static void main(String[] args) {
        // Simulate the controller receiving a request
        String holderName = "Alice Martin";
        System.out.println("Request: Create account for " + holderName);

        // Service layer: validate
        System.out.println("Service: Validating... OK");

        // Create entity
        Account account = new Account();
        account.setId(1);
        account.setHolderName(holderName);
        account.setBalance(0.0);

        // Repository layer: save
        System.out.println("Repository: Saved Account{id=" + account.getId() + "}");

        // Map to DTO and return
        AccountResponse response = new AccountResponse(
            account.getId(),
            account.getHolderName(),
            account.getBalance()
        );
        System.out.println("Response: " + response);
    }
}

class Account {
    private long id;
    private String holderName;
    private double balance;

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public String getHolderName() { return holderName; }
    public void setHolderName(String holderName) { this.holderName = holderName; }
    public double getBalance() { return balance; }
    public void setBalance(double balance) { this.balance = balance; }
}

class AccountResponse {
    private long id;
    private String holderName;
    private double balance;

    AccountResponse(long id, String holderName, double balance) {
        this.id = id;
        this.holderName = holderName;
        this.balance = balance;
    }

    public String toString() {
        return "AccountResponse{id=" + id + ", holderName=" + holderName + ", balance=" + balance + "}";
    }
}
```
