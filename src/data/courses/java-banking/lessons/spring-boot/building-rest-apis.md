---
id: "building-rest-apis"
moduleId: "spring-boot"
title: "Building REST APIs"
description: "Build CRUD REST endpoints with validation and structured error handling."
order: 2
---

## Banking Scenario

JavaBank's mobile app and web portal both need to create accounts, view balances, update customer information, and close accounts. These operations map directly to HTTP methods: POST for creating, GET for reading, PUT for updating, and DELETE for removing. Your task is to build a complete REST API that handles all four operations with proper validation and error handling.

The API must reject invalid input (negative balances, missing names), return appropriate HTTP status codes (201 for created, 404 for not found), and provide structured error messages that frontend developers can display to users. A well-designed REST API is the backbone of every modern banking system.

## Content

### REST Principles

REST (Representational State Transfer) is an architectural style for designing networked applications. Resources are the core concept: an account, a transaction, or a customer is a resource. Each resource has a unique URL (e.g., `/api/accounts/1001`), and you interact with it using standard HTTP methods.

The key REST constraints are: statelessness (each request contains all information needed to process it), uniform interface (standard HTTP methods and status codes), and resource-based URLs (nouns, not verbs). Instead of `/api/getAccount?id=1001`, you use `GET /api/accounts/1001`. Instead of `/api/createAccount`, you use `POST /api/accounts`.

HTTP status codes communicate the result. `200 OK` means success. `201 Created` means a new resource was created. `204 No Content` means successful deletion. `400 Bad Request` means invalid input. `404 Not Found` means the resource does not exist. `500 Internal Server Error` means something went wrong on the server.

```java
// REST resource mapping for banking:
// Resource: Account
// POST   /api/accounts          -> Create account    -> 201 Created
// GET    /api/accounts           -> List accounts     -> 200 OK
// GET    /api/accounts/{id}      -> Get one account   -> 200 OK
// PUT    /api/accounts/{id}      -> Update account    -> 200 OK
// DELETE /api/accounts/{id}      -> Delete account    -> 204 No Content

// Resource: Transaction
// POST   /api/transactions       -> Create transaction -> 201 Created
// GET    /api/transactions/{id}  -> Get transaction    -> 200 OK
// GET    /api/accounts/{id}/transactions -> List by account -> 200 OK
```

### CRUD Mapping

Each CRUD operation maps to an HTTP method and returns a specific status code. `POST` creates a resource and returns `201 Created` with the created resource in the body and a `Location` header pointing to the new resource. `GET` retrieves a resource and returns `200 OK`. `PUT` replaces a resource entirely and returns `200 OK`. `DELETE` removes a resource and returns `204 No Content` with an empty body.

In Spring Boot, you implement this with `@RestController` and mapping annotations. Each method receives the appropriate parameters: `@RequestBody` for POST/PUT payloads, `@PathVariable` for resource IDs, and `@RequestParam` for query filters. `ResponseEntity` wraps the response with the correct status code.

The controller delegates all business logic to service classes. Controllers should be thin: receive the request, call the service, return the response. This keeps your API layer focused on HTTP concerns while business rules live in the service layer.

```java
@RestController
@RequestMapping("/api/accounts")
class AccountController {

    private final AccountService service;

    AccountController(AccountService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<Account> create(@RequestBody Account account) {
        Account saved = service.create(account);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/{id}")
    ResponseEntity<Account> getById(@PathVariable Long id) {
        return service.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    ResponseEntity<Account> update(@PathVariable Long id, @RequestBody Account account) {
        Account updated = service.update(id, account);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

### Request Validation

Invalid data must never reach your business logic. Spring Boot integrates with Jakarta Bean Validation (formerly javax.validation) to validate request bodies using annotations. `@Valid` on a `@RequestBody` parameter triggers validation. If validation fails, Spring returns `400 Bad Request` automatically.

Common validation annotations include `@NotNull` (field must not be null), `@NotBlank` (string must not be null or empty), `@Size(min, max)` (string or collection length), `@Min` and `@Max` (numeric bounds), `@Email` (valid email format), and `@Pattern` (regex match). You can combine them and create custom validators for domain-specific rules.

In banking, validation is critical. An account with a negative balance, a transfer with zero amount, or a customer with no name should be rejected immediately with a clear error message. Validation annotations make these rules declarative and self-documenting.

```java
class CreateAccountRequest {

    @NotBlank(message = "Holder name is required")
    @Size(min = 2, max = 100, message = "Name must be 2-100 characters")
    private String holderName;

    @NotNull(message = "Initial balance is required")
    @Min(value = 0, message = "Balance cannot be negative")
    private Double initialBalance;

    @NotBlank(message = "Account type is required")
    @Pattern(regexp = "SAVINGS|CHECKING|BUSINESS",
             message = "Type must be SAVINGS, CHECKING, or BUSINESS")
    private String accountType;

    // getters and setters
}

@PostMapping
ResponseEntity<Account> create(@Valid @RequestBody CreateAccountRequest request) {
    // If validation fails, Spring returns 400 before this executes
    Account account = service.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(account);
}
```

### DTO Pattern

The DTO (Data Transfer Object) pattern separates your API representation from your domain model. Your `Account` entity maps to the database. A `CreateAccountRequest` DTO defines what the client sends. An `AccountResponse` DTO defines what the client receives. This separation provides several benefits.

First, security: the entity might have fields like `passwordHash` or `internalNotes` that should never be exposed in the API. DTOs let you control exactly what is sent and received. Second, flexibility: you can change the database schema without changing the API, and vice versa. Third, validation: DTOs carry validation annotations specific to each operation (creation might require fields that updates do not).

In banking, DTOs are essential for compliance. You can ensure that sensitive fields like Social Security numbers or account PINs are never accidentally included in API responses. The conversion between DTOs and entities happens in the service layer using mappers.

```java
// Request DTO: what the client sends
class CreateAccountRequest {
    @NotBlank private String holderName;
    @Min(0) private double initialBalance;
    private String accountType;
    // getters, setters
}

// Response DTO: what the client receives
class AccountResponse {
    private Long id;
    private String holderName;
    private double balance;
    private String accountType;
    private String createdAt;
    // NO passwordHash, NO internalNotes
    // getters, setters
}

// Conversion in service layer
@Service
class AccountService {
    Account create(CreateAccountRequest request) {
        Account account = new Account();
        account.setHolderName(request.getHolderName());
        account.setBalance(request.getInitialBalance());
        return accountRepository.save(account);
    }

    AccountResponse toResponse(Account entity) {
        AccountResponse response = new AccountResponse();
        response.setId(entity.getId());
        response.setHolderName(entity.getHolderName());
        response.setBalance(entity.getBalance());
        return response;
    }
}
```

### Global Error Handling

`@ControllerAdvice` with `@ExceptionHandler` creates a centralized error handling mechanism. Instead of try-catch blocks in every controller method, you define handler methods for specific exception types. Spring routes thrown exceptions to the matching handler, which returns a structured error response.

A standard error response includes an error code, a human-readable message, a timestamp, and optionally the request path. For validation errors, include the specific field errors. This structure helps frontend developers display meaningful error messages and helps backend developers debug issues.

In banking, consistent error responses are part of the API contract. Partners integrating with your API expect predictable error formats. Inconsistent error handling (sometimes plain text, sometimes JSON, sometimes HTML) makes integration painful and unreliable.

```java
class ErrorResponse {
    private String code;
    private String message;
    private String timestamp;
    private List<String> details;

    // constructor, getters
}

@ControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList();

        ErrorResponse response = new ErrorResponse(
            "VALIDATION_FAILED", "Invalid request data",
            LocalDateTime.now().toString(), errors);
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(AccountNotFoundException.class)
    ResponseEntity<ErrorResponse> handleNotFound(AccountNotFoundException ex) {
        ErrorResponse response = new ErrorResponse(
            "NOT_FOUND", ex.getMessage(),
            LocalDateTime.now().toString(), null);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }
}
```

### Pagination

When listing resources, returning all records at once is impractical. A banking system might have millions of accounts. Spring Data provides `Pageable` and `Page` abstractions for paginated queries. Clients specify `page` (zero-based page number) and `size` (items per page) as query parameters.

Spring automatically creates a `Pageable` object from request parameters and passes it to your repository. The repository returns a `Page` object containing the data, total elements, total pages, and navigation information. This metadata helps clients build pagination controls.

For banking APIs, always paginate list endpoints. Default page sizes of 20-50 are common. Set a maximum page size to prevent clients from requesting all records. Include pagination metadata (total pages, total elements, current page) in the response.

```java
@GetMapping
ResponseEntity<Page<AccountResponse>> listAccounts(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {

    Pageable pageable = PageRequest.of(page, Math.min(size, 100));
    Page<Account> accounts = accountRepository.findAll(pageable);

    Page<AccountResponse> response = accounts.map(this::toResponse);
    return ResponseEntity.ok(response);
}

// GET /api/accounts?page=0&size=20
// Response:
// {
//   "content": [{...}, {...}, ...],
//   "totalElements": 1523,
//   "totalPages": 77,
//   "number": 0,
//   "size": 20
// }
```

## Why It Matters

Building REST APIs is the primary task for backend Java developers in banking. Every mobile app feature, every web portal screen, and every partner integration depends on well-designed endpoints. Understanding CRUD mapping, validation, error handling, and pagination is not optional -- it is the core of your daily work. Interviewers will ask you to design API endpoints, and your team will expect you to build them correctly from day one.

## Challenge

Design a complete Account REST API. Simulate all four CRUD operations and print the HTTP method, path, and status code for each.

## Starter Code
```java
public class Main {
    public static void main(String[] args) {
        // TODO: Create a simulated AccountApi class with CRUD methods
        // TODO: Simulate POST (create), GET (read), PUT (update), DELETE operations
        // TODO: Print HTTP method, path, and status code for each
    }
}
```

## Expected Output
```
POST /api/accounts - Created: 201
GET /api/accounts/1 - Found: 200
PUT /api/accounts/1 - Updated: 200
DELETE /api/accounts/1 - Deleted: 204
```

## Hint

Create an `AccountApi` class with methods for each CRUD operation. Each method should print the HTTP method, path, and result. For example, `create()` prints "POST /api/accounts - Created: 201". You do not need an actual HTTP server -- just simulate the endpoints and their responses.

## Solution
```java
class Account {
    private long id;
    private String holder;
    private double balance;

    Account(long id, String holder, double balance) {
        this.id = id;
        this.holder = holder;
        this.balance = balance;
    }

    public long getId() { return id; }
    public String getHolder() { return holder; }
    public double getBalance() { return balance; }
}

class AccountApi {
    private Account storedAccount;

    String create(String holder, double balance) {
        storedAccount = new Account(1, holder, balance);
        return "POST /api/accounts - Created: 201";
    }

    String getById(long id) {
        return "GET /api/accounts/" + id + " - Found: 200";
    }

    String update(long id, String holder, double balance) {
        storedAccount = new Account(id, holder, balance);
        return "PUT /api/accounts/" + id + " - Updated: 200";
    }

    String delete(long id) {
        storedAccount = null;
        return "DELETE /api/accounts/" + id + " - Deleted: 204";
    }
}

public class Main {
    public static void main(String[] args) {
        AccountApi api = new AccountApi();

        System.out.println(api.create("Alice", 5000.0));
        System.out.println(api.getById(1));
        System.out.println(api.update(1, "Alice Martin", 5500.0));
        System.out.println(api.delete(1));
    }
}
```
