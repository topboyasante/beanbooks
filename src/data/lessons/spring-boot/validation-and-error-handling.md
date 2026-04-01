---
id: "validation-and-error-handling"
moduleId: "spring-boot"
title: "Validation & Error Handling"
description: "Validate request data with Bean Validation and handle errors consistently with @ControllerAdvice."
order: 3
---

## Banking Scenario

A banking API must reject invalid data before it reaches your business logic. A transfer with a negative amount, an account creation without a name, or a deposit exceeding daily limits — all must be caught at the API boundary with clear error messages. If bad data slips through, it can corrupt account balances, trigger incorrect transactions, or violate regulatory rules.

Banks also require consistent error responses across all endpoints for their API consumers (mobile apps, partner integrations). If your login endpoint returns errors as `{"error": "..."}` but your transfer endpoint returns `{"message": "..."}`, every consumer has to write special handling for each endpoint. Inconsistent error formats cause integration failures and support escalations. You need a single, structured error format everywhere.

## Content

### Bean Validation Annotations

Bean Validation (JSR 380) provides annotations that declare rules directly on your fields. Spring Boot includes the `spring-boot-starter-validation` dependency which brings in Hibernate Validator, the reference implementation. You annotate DTO (Data Transfer Object) fields, and the framework validates them automatically before your code runs.

Here are the most common annotations for banking scenarios:

```java
public class TransferRequest {

    @NotNull(message = "senderId must not be null")
    private Long senderId;

    @NotNull(message = "recipientId must not be null")
    private Long recipientId;

    @Positive(message = "amount must be greater than 0")
    private Double amount;

    @NotBlank(message = "description must not be blank")
    @Size(min = 3, max = 100, message = "description must be 3-100 characters")
    private String description;

    @Email(message = "notificationEmail must be valid")
    private String notificationEmail;

    @Pattern(regexp = "^[A-Z]{3}$", message = "currency must be a 3-letter code")
    private String currency;

    // constructors, getters, setters
}
```

Other useful annotations include `@Min` and `@Max` for numeric ranges, `@DecimalMin` for precise decimal thresholds, and `@NotEmpty` for collections. Each annotation accepts a `message` attribute that defines the error text returned to the client.

### Triggering Validation with @Valid

To activate validation, add `@Valid` before the `@RequestBody` parameter in your controller method. Without `@Valid`, Spring ignores all your annotations and accepts any data.

```java
@RestController
@RequestMapping("/api/transfers")
public class TransferController {

    @PostMapping
    public ResponseEntity<String> transfer(@Valid @RequestBody TransferRequest request) {
        // This code only runs if validation passes
        return ResponseEntity.ok("Transfer of $" + request.getAmount() + " processed");
    }
}
```

When validation fails, Spring throws `MethodArgumentNotValidException` before your method body executes. The default error response is a 400 status with a verbose, unstructured JSON blob. It works, but it is ugly and inconsistent. You need custom handling.

### Custom Validators

Sometimes built-in annotations are not enough. For example, you might want to enforce a daily transfer limit. You create a custom annotation and a corresponding validator class.

```java
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = DailyLimitValidator.class)
public @interface DailyLimitCheck {
    String message() default "Transfer exceeds daily limit";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class DailyLimitValidator implements ConstraintValidator<DailyLimitCheck, Double> {
    private static final double DAILY_LIMIT = 10000.00;

    @Override
    public boolean isValid(Double value, ConstraintValidatorContext context) {
        return value == null || value <= DAILY_LIMIT;
    }
}
```

Apply `@DailyLimitCheck` to the amount field, and it runs alongside all other validators. For cross-field validation (e.g., senderId must differ from recipientId), implement a class-level validator that receives the entire object.

### Global Exception Handling with @ControllerAdvice

`@ControllerAdvice` creates a centralized exception handler that applies to every controller in your application. Combined with `@ExceptionHandler`, you catch specific exception types and return structured responses.

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(err -> err.getField() + " " + err.getDefaultMessage())
            .toList();

        ErrorResponse response = new ErrorResponse(
            LocalDateTime.now(), 400, "Validation failed", errors, request.getRequestURI()
        );
        return ResponseEntity.badRequest().body(response);
    }
}
```

### Structured Error Responses

Define a consistent error response class used across your entire API. This follows the RFC 7807 (Problem Details) approach where every error response has the same shape.

```java
public class ErrorResponse {
    private LocalDateTime timestamp;
    private int status;
    private String message;
    private List<String> errors;
    private String path;

    // constructor, getters
}
```

Every consumer of your API — mobile apps, partner systems, internal tools — can write a single error parser because the format never changes.

### Exception Hierarchy

Create a base exception class for all business errors, then extend it for specific cases. Each exception maps to an HTTP status code in your global handler.

```java
public abstract class BusinessException extends RuntimeException {
    private final int statusCode;
    public BusinessException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
    public int getStatusCode() { return statusCode; }
}

public class InsufficientFundsException extends BusinessException {
    public InsufficientFundsException(String accountId) {
        super("Insufficient funds in account " + accountId, 422);
    }
}

public class AccountNotFoundException extends BusinessException {
    public AccountNotFoundException(String accountId) {
        super("Account not found: " + accountId, 404);
    }
}
```

In your `@ControllerAdvice`, add a handler for `BusinessException` that reads the status code from the exception and builds the structured response automatically.

### Validation Groups

Sometimes the same DTO is used for both creation and update, but the rules differ. For example, `accountId` is required on update but absent on create. Validation groups let you apply different rules per operation.

```java
public interface CreateGroup {}
public interface UpdateGroup {}

public class AccountRequest {
    @Null(groups = CreateGroup.class)
    @NotNull(groups = UpdateGroup.class)
    private Long id;

    @NotBlank(groups = {CreateGroup.class, UpdateGroup.class})
    private String name;
}
```

Use `@Validated(CreateGroup.class)` instead of `@Valid` on the controller parameter to activate a specific group.

## Why It Matters

In banking, invalid data is not just an inconvenience — it is a financial risk. A transfer with a negative amount could credit the sender, a missing recipient could lose funds, and an amount exceeding limits could violate regulations. Validation is your first line of defense, and structured error handling ensures that when something goes wrong, every system consuming your API knows exactly what happened and can respond appropriately. This is not optional in financial software — it is a requirement.

## Challenge

Create a `TransferRequest` class with validation annotations and a `GlobalExceptionHandler` that returns structured errors. Simulate both a valid and an invalid transfer request.

## Starter Code
```java
import java.time.LocalDateTime;
import java.util.*;

public class ValidationDemo {

    // TODO: Create TransferRequest with validation annotations (simulate with manual checks)
    // Fields: senderId (not null), recipientId (not null), amount (positive), description (not blank)

    // TODO: Create ErrorResponse with timestamp, status, message, errors list

    // TODO: Create a validate() method that checks the rules and collects errors

    // TODO: Test with a valid request and an invalid request (negative amount, null recipientId)

    public static void main(String[] args) {
        // Test valid transfer
        // Test invalid transfer and print structured errors
    }
}
```

## Expected Output
```
Valid transfer: OK
Invalid transfer:
  Status: 400
  Error: amount must be greater than 0
  Error: recipientId must not be null
```

## Hint

Since we cannot run Spring in a standalone main method, simulate validation by writing a `validate(TransferRequest)` method that checks each field manually and collects error messages into a list. If the list is empty, the request is valid. If not, build an ErrorResponse and print each error.

## Solution
```java
import java.time.LocalDateTime;
import java.util.*;

public class ValidationDemo {

    static class TransferRequest {
        Long senderId;
        Long recipientId;
        Double amount;
        String description;

        TransferRequest(Long senderId, Long recipientId, Double amount, String description) {
            this.senderId = senderId;
            this.recipientId = recipientId;
            this.amount = amount;
            this.description = description;
        }
    }

    static class ErrorResponse {
        LocalDateTime timestamp;
        int status;
        String message;
        List<String> errors;

        ErrorResponse(int status, String message, List<String> errors) {
            this.timestamp = LocalDateTime.now();
            this.status = status;
            this.message = message;
            this.errors = errors;
        }
    }

    static List<String> validate(TransferRequest request) {
        List<String> errors = new ArrayList<>();
        if (request.senderId == null) {
            errors.add("senderId must not be null");
        }
        if (request.recipientId == null) {
            errors.add("recipientId must not be null");
        }
        if (request.amount == null || request.amount <= 0) {
            errors.add("amount must be greater than 0");
        }
        if (request.description == null || request.description.isBlank()) {
            errors.add("description must not be blank");
        }
        return errors;
    }

    public static void main(String[] args) {
        TransferRequest valid = new TransferRequest(1L, 2L, 500.0, "Rent payment");
        List<String> validErrors = validate(valid);
        if (validErrors.isEmpty()) {
            System.out.println("Valid transfer: OK");
        }

        TransferRequest invalid = new TransferRequest(1L, null, -100.0, "Test");
        List<String> invalidErrors = validate(invalid);
        if (!invalidErrors.isEmpty()) {
            ErrorResponse response = new ErrorResponse(400, "Validation failed", invalidErrors);
            System.out.println("Invalid transfer:");
            System.out.println("  Status: " + response.status);
            for (String error : response.errors) {
                System.out.println("  Error: " + error);
            }
        }
    }
}
```
