---
id: "rest-api-layer"
moduleId: "capstone"
title: "REST API Layer"
description: "Build CRUD controllers with DTOs, validation, and structured error handling."
order: 3
---

## Banking Scenario

JavaBank's frontend team needs well-defined API endpoints to build the customer-facing web and mobile apps. They need to create accounts, view balances, and list transactions. The API must validate incoming data, return consistent response structures, and provide clear error messages when something goes wrong. A missing account number or a negative deposit amount should never reach the database.

The backend team is building the REST API layer on top of the domain model. This is where the Spring MVC skills from the Spring module meet the validation and error handling patterns from backend patterns. Every endpoint must be predictable, well-documented by its structure, and safe from bad input.

## Content

### Request and Response DTOs

Never expose JPA entities directly in your API. DTOs decouple your API contract from your database schema, a critical pattern you learned in the backend patterns module:

```java
package com.javabank.api.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public class CreateAccountRequest {

    @NotBlank(message = "Customer ID is required")
    private String customerId;

    @NotNull(message = "Account type is required")
    private String accountType;

    @DecimalMin(value = "0.00",
        message = "Initial deposit cannot be negative")
    private BigDecimal initialDeposit;

    public String getCustomerId() { return customerId; }
    public String getAccountType() { return accountType; }
    public BigDecimal getInitialDeposit() { return initialDeposit; }
}
```

```java
package com.javabank.api.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class AccountResponse {
    private Long id;
    private String accountNumber;
    private String accountType;
    private BigDecimal balance;
    private String customerName;
    private LocalDateTime createdAt;

    public AccountResponse(Long id, String accountNumber,
            String accountType, BigDecimal balance,
            String customerName, LocalDateTime createdAt) {
        this.id = id;
        this.accountNumber = accountNumber;
        this.accountType = accountType;
        this.balance = balance;
        this.customerName = customerName;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getAccountNumber() { return accountNumber; }
    public String getAccountType() { return accountType; }
    public BigDecimal getBalance() { return balance; }
    public String getCustomerName() { return customerName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

### AccountController with CRUD Endpoints

The controller handles HTTP concerns only. It validates input, delegates to the service layer, and maps results to response DTOs:

```java
package com.javabank.api.controller;

import com.javabank.api.dto.*;
import com.javabank.api.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public ResponseEntity<List<AccountResponse>> getAllAccounts() {
        System.out.println("GET /api/accounts - listing all accounts");
        return ResponseEntity.ok(accountService.getAllAccounts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AccountResponse> getAccount(
            @PathVariable Long id) {
        System.out.println("GET /api/accounts/" + id);
        return ResponseEntity.ok(accountService.getAccountById(id));
    }

    @PostMapping
    public ResponseEntity<AccountResponse> createAccount(
            @Valid @RequestBody CreateAccountRequest request) {
        System.out.println("POST /api/accounts - creating account");
        AccountResponse response =
            accountService.createAccount(request);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(response);
    }
}
```

### Bean Validation with @Valid

The `@Valid` annotation triggers validation on the request body before your controller code runs. Every constraint annotation you add to your DTO fields is checked automatically. This is the validation module in action:

```java
// When a POST arrives with invalid data:
// POST /api/accounts
// { "customerId": "", "accountType": null }
//
// Spring returns 400 Bad Request before your code executes
// The GlobalExceptionHandler formats the error response
```

### GlobalExceptionHandler with @ControllerAdvice

Centralized error handling ensures every error follows the same response structure. This applies the exception handling patterns from both the Java basics and Spring modules:

```java
package com.javabank.api.exception;

import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            ResourceNotFoundException ex) {
        System.out.println("Error: " + ex.getMessage());
        ErrorResponse error = new ErrorResponse(
            HttpStatus.NOT_FOUND.value(),
            ex.getMessage(),
            LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult()
            .getFieldErrors().stream()
            .map(f -> f.getField() + ": " + f.getDefaultMessage())
            .toList();
        System.out.println("Validation errors: " + errors);
        ErrorResponse error = new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Validation failed: " + String.join(", ", errors),
            LocalDateTime.now()
        );
        return ResponseEntity.badRequest().body(error);
    }
}
```

### Mapping Between Entities and DTOs

A mapper method or class translates between your domain entities and API DTOs. Keep this logic simple and testable:

```java
package com.javabank.api.service;

import com.javabank.api.dto.AccountResponse;
import com.javabank.api.entity.Account;

public class AccountMapper {

    public static AccountResponse toResponse(Account account) {
        return new AccountResponse(
            account.getId(),
            account.getAccountNumber(),
            account.getAccountType().name(),
            account.getBalance(),
            account.getCustomer().getFirstName() + " "
                + account.getCustomer().getLastName(),
            account.getCreatedAt()
        );
    }
}
```

### Error Response Structure

Consistent error responses make life easier for frontend developers. Every error returns the same shape:

```java
package com.javabank.api.exception;

import java.time.LocalDateTime;

public class ErrorResponse {
    private int status;
    private String message;
    private LocalDateTime timestamp;

    public ErrorResponse(int status, String message,
                         LocalDateTime timestamp) {
        this.status = status;
        this.message = message;
        this.timestamp = timestamp;
    }

    public int getStatus() { return status; }
    public String getMessage() { return message; }
    public LocalDateTime getTimestamp() { return timestamp; }
}
```

## Why It Matters

The REST API is the contract between your backend and every client that consumes it. In banking, a poorly validated endpoint can allow invalid transactions. An inconsistent error format wastes frontend developers' time. DTOs protect your internal domain model from being coupled to external consumers. These patterns are the difference between a prototype and a production API.

## Questions

Q: Why should you use DTOs instead of exposing JPA entities directly in API responses?
A) DTOs are faster to serialize than entities
B) DTOs decouple the API contract from the database schema
C) JPA entities cannot be converted to JSON
D) DTOs automatically validate incoming data
Correct: B

Q: What happens when a request body fails @Valid validation in a Spring controller?
A) The controller method runs with null values
B) Spring returns a 500 Internal Server Error
C) Spring rejects the request before the controller method executes
D) The request is silently ignored
Correct: C

Q: What is the purpose of @RestControllerAdvice?
A) It adds authentication to all controllers
B) It provides centralized exception handling across all controllers
C) It validates all request parameters automatically
D) It logs all incoming HTTP requests
Correct: B

## Challenge

Build a simple banking controller simulation. Create a `BankController` class with methods for getting an account and creating an account. Use a DTO for the create request with validation logic, and handle the case where an account is not found.

## Starter Code
```java
import java.math.BigDecimal;
import java.util.*;

class AccountResponse {
    String accountNumber;
    String type;
    BigDecimal balance;

    AccountResponse(String accountNumber, String type, BigDecimal balance) {
        this.accountNumber = accountNumber;
        this.type = type;
        this.balance = balance;
    }
}

class CreateAccountRequest {
    String customerName;
    String accountType;
    BigDecimal initialDeposit;

    CreateAccountRequest(String customerName, String accountType,
                         BigDecimal initialDeposit) {
        this.customerName = customerName;
        this.accountType = accountType;
        this.initialDeposit = initialDeposit;
    }
}

public class RestApiDemo {
    private static Map<String, AccountResponse> accounts = new HashMap<>();

    // TODO: Add a validate method for CreateAccountRequest
    // TODO: Add a createAccount method
    // TODO: Add a getAccount method that throws if not found

    public static void main(String[] args) {
        // TODO: Create a valid account
        // TODO: Retrieve it by account number
        // TODO: Try to retrieve a non-existent account
    }
}
```

## Expected Output
```
Validating request...
Account created: ACC-1001 | CHECKING | $500.00
Retrieving account ACC-1001...
Found: ACC-1001 | CHECKING | $500.00
Retrieving account ACC-9999...
Error 404: Account not found: ACC-9999
```

## Hint

Create a `validate` method that checks if `customerName` is not null/empty and `initialDeposit` is not negative. Use a `Map<String, AccountResponse>` to simulate a database. For the not-found case, catch a custom exception or check if the map returns null.

## Solution
```java
import java.math.BigDecimal;
import java.util.*;

class AccountResponse {
    String accountNumber;
    String type;
    BigDecimal balance;

    AccountResponse(String accountNumber, String type, BigDecimal balance) {
        this.accountNumber = accountNumber;
        this.type = type;
        this.balance = balance;
    }
}

class CreateAccountRequest {
    String customerName;
    String accountType;
    BigDecimal initialDeposit;

    CreateAccountRequest(String customerName, String accountType,
                         BigDecimal initialDeposit) {
        this.customerName = customerName;
        this.accountType = accountType;
        this.initialDeposit = initialDeposit;
    }
}

class AccountNotFoundException extends RuntimeException {
    AccountNotFoundException(String msg) { super(msg); }
}

public class RestApiDemo {
    private static Map<String, AccountResponse> accounts = new HashMap<>();

    static List<String> validate(CreateAccountRequest request) {
        List<String> errors = new ArrayList<>();
        if (request.customerName == null
                || request.customerName.isBlank()) {
            errors.add("customerName is required");
        }
        if (request.initialDeposit != null
                && request.initialDeposit.compareTo(BigDecimal.ZERO) < 0) {
            errors.add("initialDeposit cannot be negative");
        }
        return errors;
    }

    static AccountResponse createAccount(CreateAccountRequest request) {
        System.out.println("Validating request...");
        List<String> errors = validate(request);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException(
                "Validation failed: " + String.join(", ", errors));
        }
        AccountResponse response = new AccountResponse(
            "ACC-1001", request.accountType,
            request.initialDeposit);
        accounts.put(response.accountNumber, response);
        System.out.println("Account created: "
            + response.accountNumber + " | " + response.type
            + " | $" + response.balance);
        return response;
    }

    static AccountResponse getAccount(String accountNumber) {
        System.out.println("Retrieving account " + accountNumber
            + "...");
        AccountResponse account = accounts.get(accountNumber);
        if (account == null) {
            throw new AccountNotFoundException(
                "Account not found: " + accountNumber);
        }
        System.out.println("Found: " + account.accountNumber
            + " | " + account.type + " | $" + account.balance);
        return account;
    }

    public static void main(String[] args) {
        CreateAccountRequest request = new CreateAccountRequest(
            "Alice Johnson", "CHECKING", new BigDecimal("500.00"));
        createAccount(request);

        getAccount("ACC-1001");

        try {
            getAccount("ACC-9999");
        } catch (AccountNotFoundException e) {
            System.out.println("Error 404: " + e.getMessage());
        }
    }
}
```
