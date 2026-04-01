---
id: "spring-mvc"
moduleId: "spring"
title: "Spring MVC"
description: "Build REST APIs with controllers, request mapping, and response handling."
order: 4
---

## Banking Scenario

JavaBank needs to expose its account management functionality through a REST API. Mobile apps, web frontends, and partner integrations all need to create accounts, check balances, and initiate transfers through HTTP endpoints. Spring MVC provides the framework to map HTTP requests to Java methods, handle request data, and return structured responses.

As the backend developer, you will design controllers that receive incoming requests, delegate to services, and return appropriate HTTP responses with status codes. The API must handle errors gracefully, validate input, and follow REST conventions that external teams expect.

## Content

### @RestController vs @Controller

Spring MVC provides two annotations for handling web requests. `@Controller` is the traditional annotation for MVC applications that return views (HTML pages). `@RestController` is a convenience annotation that combines `@Controller` and `@ResponseBody`, meaning every method automatically serializes its return value to JSON (or XML) instead of resolving a view.

For REST APIs in banking, you will almost always use `@RestController`. The response body is serialized using Jackson, Spring's default JSON library. Any Java object returned from a controller method is automatically converted to JSON. You do not need to manually call `ObjectMapper` or construct JSON strings.

Each controller class is responsible for a specific resource. `AccountController` handles account operations, `TransactionController` handles transactions, and `CustomerController` handles customer data. This follows REST resource-oriented design and keeps controllers focused.

```java
@RestController
@RequestMapping("/api/accounts")
class AccountController {

    private final AccountService accountService;

    AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping("/{id}")
    Account getAccount(@PathVariable String id) {
        return accountService.findById(id);
        // Automatically serialized to JSON:
        // {"id": "1001", "holder": "Alice", "balance": 5000.0}
    }
}
```

### Request Mapping Annotations

Spring provides shortcut annotations for each HTTP method: `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, and `@PatchMapping`. These are cleaner than the generic `@RequestMapping(method = RequestMethod.GET)` syntax. Each maps an HTTP method and URL path to a Java method.

The `@RequestMapping` annotation at the class level sets a base path for all methods in the controller. Method-level annotations append to this base path. Paths can include variables enclosed in curly braces, which are extracted with `@PathVariable`. Query parameters are captured with `@RequestParam`.

Following REST conventions, `GET` retrieves resources (should be idempotent), `POST` creates new resources, `PUT` updates resources completely, `PATCH` updates partially, and `DELETE` removes resources. Banking APIs follow these conventions strictly for consistency and predictability.

```java
@RestController
@RequestMapping("/api/accounts")
class AccountController {

    @GetMapping                     // GET /api/accounts
    List<Account> listAccounts() { return List.of(); }

    @GetMapping("/{id}")            // GET /api/accounts/1001
    Account getAccount(@PathVariable Long id) { return null; }

    @PostMapping                    // POST /api/accounts
    Account createAccount(@RequestBody Account account) { return account; }

    @PutMapping("/{id}")            // PUT /api/accounts/1001
    Account updateAccount(@PathVariable Long id, @RequestBody Account account) {
        return account;
    }

    @DeleteMapping("/{id}")         // DELETE /api/accounts/1001
    void deleteAccount(@PathVariable Long id) { }

    @GetMapping("/search")          // GET /api/accounts/search?holder=Alice
    List<Account> searchByHolder(@RequestParam String holder) { return List.of(); }
}
```

### @PathVariable and @RequestParam

`@PathVariable` extracts values from the URL path. In `/api/accounts/{id}`, the `{id}` segment maps to a method parameter. Spring automatically converts the string to the parameter type (Long, Integer, String, UUID). If the path variable name matches the parameter name, you can omit the name attribute.

`@RequestParam` captures query string parameters. For `/api/accounts?status=active&page=2`, you would use `@RequestParam String status` and `@RequestParam int page`. You can set defaults with `defaultValue` and make parameters optional with `required = false`.

`@RequestBody` deserializes the HTTP request body (usually JSON) into a Java object. Spring uses Jackson to map JSON fields to Java object properties. This is how clients send data for creating or updating resources. Always validate `@RequestBody` input in banking applications.

```java
@RestController
@RequestMapping("/api/transactions")
class TransactionController {

    // Path variable: /api/transactions/TXN-001
    @GetMapping("/{transactionId}")
    Transaction getTransaction(@PathVariable String transactionId) {
        return new Transaction(transactionId, 500.0, "COMPLETED");
    }

    // Query params: /api/transactions?accountId=ACC-001&limit=10
    @GetMapping
    List<Transaction> listTransactions(
            @RequestParam String accountId,
            @RequestParam(defaultValue = "20") int limit) {
        return List.of();
    }

    // Request body: POST with JSON payload
    @PostMapping
    Transaction createTransaction(@RequestBody TransactionRequest request) {
        return new Transaction("TXN-NEW", request.getAmount(), "PENDING");
    }
}
```

### ResponseEntity for Status Codes

`ResponseEntity` gives you full control over the HTTP response, including status code, headers, and body. While returning an object directly from a controller method uses 200 OK by default, banking APIs need precise status codes: 201 for created resources, 204 for successful deletions, 404 for missing resources, and 400 for invalid input.

`ResponseEntity` is a generic class: `ResponseEntity<Account>` wraps an `Account` with an HTTP status. You build responses using the static factory methods: `ResponseEntity.ok()`, `ResponseEntity.status(HttpStatus.CREATED)`, `ResponseEntity.notFound()`, and `ResponseEntity.badRequest()`.

Proper status codes are essential for API consumers. Mobile app developers rely on them to determine whether to show a success message, display an error, or retry the request. Banking regulators may also audit API behavior, so correct status codes are not just nice to have.

```java
@RestController
@RequestMapping("/api/accounts")
class AccountController {

    @GetMapping("/{id}")
    ResponseEntity<Account> getAccount(@PathVariable Long id) {
        Account account = accountService.findById(id);
        if (account == null) {
            return ResponseEntity.notFound().build();        // 404
        }
        return ResponseEntity.ok(account);                   // 200
    }

    @PostMapping
    ResponseEntity<Account> createAccount(@RequestBody Account account) {
        Account saved = accountService.save(account);
        return ResponseEntity.status(HttpStatus.CREATED)     // 201
            .body(saved);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> deleteAccount(@PathVariable Long id) {
        accountService.deleteById(id);
        return ResponseEntity.noContent().build();           // 204
    }
}
```

### Request/Response Lifecycle

Understanding how a request flows through Spring MVC helps you debug issues. When an HTTP request arrives, the `DispatcherServlet` (Spring's front controller) receives it. The `HandlerMapping` component finds the right controller method based on the URL and HTTP method. The `HandlerAdapter` invokes the method, passing converted parameters. The return value is processed by a `HttpMessageConverter` (Jackson for JSON) and written to the response.

If something goes wrong at any step, Spring returns an appropriate error response. A missing handler returns 404. A type conversion failure returns 400. An unhandled exception returns 500. Understanding this lifecycle helps you place debugging breakpoints and logging at the right locations.

Filters and interceptors can process requests before they reach the controller or modify responses afterward. Banking applications use filters for authentication, logging, rate limiting, and request ID tracking. The filter chain executes before the DispatcherServlet, while interceptors execute around the handler invocation.

```java
// Request lifecycle:
// 1. HTTP Request arrives
// 2. DispatcherServlet receives it
// 3. HandlerMapping finds the right controller method
// 4. HandlerAdapter invokes the method
//    - @PathVariable values extracted from URL
//    - @RequestParam values extracted from query string
//    - @RequestBody deserialized from JSON
// 5. Controller method executes business logic
// 6. Return value serialized to JSON by Jackson
// 7. HTTP Response sent back to client

// Example flow for: GET /api/accounts/1001
// -> DispatcherServlet
//    -> HandlerMapping: AccountController.getAccount(Long)
//       -> @PathVariable id = 1001
//       -> AccountService.findById(1001)
//       -> return Account object
//    -> Jackson serializes to JSON
// <- Response: 200 OK, {"id":1001,"holder":"Alice","balance":5000.0}
```

### Exception Handling

The `@ExceptionHandler` annotation defines methods that handle specific exceptions thrown by controller methods. Combined with `@ControllerAdvice`, you can create a global exception handler that applies to all controllers. This centralizes error handling and ensures consistent error responses.

In banking APIs, error responses should be structured and informative without exposing internal details. A common pattern is to return an error object with a code, message, and timestamp. Never expose stack traces, SQL queries, or internal class names in API error responses -- these are security risks.

`@ControllerAdvice` creates a class that intercepts exceptions from all controllers. You define handler methods for different exception types, and Spring routes the exception to the matching handler. This is much cleaner than try-catch blocks in every controller method.

```java
@ControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(AccountNotFoundException.class)
    ResponseEntity<ErrorResponse> handleNotFound(AccountNotFoundException ex) {
        ErrorResponse error = new ErrorResponse(
            "ACCOUNT_NOT_FOUND",
            ex.getMessage(),
            LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException ex) {
        ErrorResponse error = new ErrorResponse(
            "BAD_REQUEST",
            ex.getMessage(),
            LocalDateTime.now()
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        ErrorResponse error = new ErrorResponse(
            "INTERNAL_ERROR",
            "An unexpected error occurred",
            LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
```

## Why It Matters

REST APIs are the backbone of modern banking systems. Every mobile app, web portal, and partner integration communicates through HTTP endpoints. Spring MVC is the standard framework for building these APIs in Java. Understanding controllers, request mapping, response handling, and error management is essential for any backend developer in banking. These are the endpoints your team will build, test, and maintain daily.

## Challenge

Design a REST controller for accounts. Show the class structure with endpoint mappings and simulate a GET request for an account by printing the request and response.

## Starter Code
```java
public class Main {
    public static void main(String[] args) {
        // TODO: Create an Account class with id (long), holder (String), balance (double)
        // TODO: Create a simulated AccountController that maps endpoints
        // TODO: Simulate a GET /api/accounts/1001 request
        // TODO: Print the request path, response data, and status code
    }
}
```

## Expected Output
```
GET /api/accounts/1001
Response: {id: 1001, holder: Alice, balance: 5000.0}
Status: 200 OK
```

## Hint

Create an `Account` class with fields for id, holder, and balance. Create an `AccountController` class with a `getAccount(long id)` method that returns an `Account`. In `main`, simulate the request by calling the method and printing the formatted output. You do not need a running Spring application -- just demonstrate the structure and output.

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

    public String toJson() {
        return "{id: " + id + ", holder: " + holder + ", balance: " + balance + "}";
    }
}

class AccountController {
    public Account getAccount(long id) {
        if (id == 1001) {
            return new Account(1001, "Alice", 5000.0);
        }
        return null;
    }
}

public class Main {
    public static void main(String[] args) {
        AccountController controller = new AccountController();

        long requestId = 1001;
        System.out.println("GET /api/accounts/" + requestId);

        Account account = controller.getAccount(requestId);
        if (account != null) {
            System.out.println("Response: " + account.toJson());
            System.out.println("Status: 200 OK");
        } else {
            System.out.println("Status: 404 Not Found");
        }
    }
}
```
