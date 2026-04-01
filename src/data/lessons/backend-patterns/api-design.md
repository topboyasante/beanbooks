---
id: "api-design"
moduleId: "backend-patterns"
title: "API Design & Idempotency"
description: "Design robust REST APIs with versioning, pagination, and idempotent payment operations."
order: 8
---

## Banking Scenario

Your bank's API is consumed by mobile apps, partner banks, fintech integrations, and internal services. A poorly designed API causes integration nightmares — unclear endpoints, inconsistent error formats, and breaking changes that take down partner systems overnight.

And in payments, idempotency is non-negotiable: if a network timeout occurs after the client sends a transfer request, they will retry. Your API must ensure the transfer does not execute twice. A customer who sees a double charge because your API processed a retry as a new transaction will lose trust in your bank immediately.

## Content

### REST Resource Design

Design APIs around resources (nouns), not actions (verbs). Use HTTP methods to express intent. Choose status codes carefully — they tell clients exactly what happened.

```java
// Good: resources as nouns
// POST   /api/v1/accounts           → 201 Created
// GET    /api/v1/accounts/{id}      → 200 OK
// PUT    /api/v1/accounts/{id}      → 200 OK
// DELETE /api/v1/accounts/{id}      → 204 No Content

// POST   /api/v1/transfers          → 201 Created
// GET    /api/v1/transactions?accountId=123 → 200 OK

// Bad: verbs in URLs
// POST /api/v1/createAccount       ← wrong
// POST /api/v1/doTransfer          ← wrong

// Key status codes for banking:
// 201 Created    — new resource created (account opened, transfer initiated)
// 204 No Content — successful operation with no response body
// 409 Conflict   — duplicate resource (idempotency key already processed)
// 422 Unprocessable Entity — valid JSON but business rule violation (insufficient funds)
```

### API Versioning

APIs evolve, but existing clients should not break. URL versioning (`/v1/accounts`) is the most common approach — it is explicit and easy to route. Header versioning (`Accept: application/vnd.bank.v1+json`) is cleaner but harder to test in a browser. Version when you make breaking changes; additive changes (new optional fields) do not require a new version.

```java
// URL versioning — most common, easiest to understand
@RestController
@RequestMapping("/api/v1/accounts")
public class AccountControllerV1 { }

@RestController
@RequestMapping("/api/v2/accounts")
public class AccountControllerV2 { }
```

### Pagination

Never return unbounded collections. For banking transaction histories, offset-based pagination (`?page=0&size=20`) is simple but slow for deep pages. Cursor-based pagination (`?after=txn_abc123&size=20`) scales better for large datasets because it does not need to skip rows.

```java
// Spring's Pageable — offset-based pagination
@GetMapping("/api/v1/transactions")
public Page<Transaction> getTransactions(
        @RequestParam String accountId,
        Pageable pageable) {
    return transactionRepository.findByAccountId(accountId, pageable);
}
// GET /api/v1/transactions?accountId=123&page=0&size=20&sort=timestamp,desc
```

### Filtering and Sorting

Let clients narrow results with query parameters. Spring's Specification pattern enables dynamic, composable filters without writing a query for every combination.

```java
// Query parameter filtering
// GET /api/v1/transactions?status=COMPLETED&type=TRANSFER&sort=amount,desc

@GetMapping("/api/v1/transactions")
public List<Transaction> search(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String type,
        @RequestParam(defaultValue = "timestamp,desc") String sort) {
    // Build dynamic query using Spring Specification
    return transactionService.search(status, type, sort);
}
```

### Idempotency

An idempotent operation produces the same result no matter how many times you call it. GET, PUT, and DELETE are naturally idempotent. POST is not — that is why payment APIs require an `Idempotency-Key` header. The server stores the key with its response. On a retry, it returns the cached response instead of processing the request again.

```java
@PostMapping("/api/v1/transfers")
public ResponseEntity<TransferResult> createTransfer(
        @RequestHeader("Idempotency-Key") String idempotencyKey,
        @RequestBody TransferRequest request) {

    // Check if this key was already processed
    Optional<TransferResult> cached = idempotencyStore.get(idempotencyKey);
    if (cached.isPresent()) {
        return ResponseEntity.ok(cached.get()); // return cached result
    }

    // Process the transfer
    TransferResult result = transferService.execute(request);

    // Store the result with the idempotency key (TTL: 24 hours)
    idempotencyStore.put(idempotencyKey, result);

    return ResponseEntity.status(HttpStatus.CREATED).body(result);
}
```

### Error Response Format

Use a consistent error format across all endpoints. The RFC 7807 `problem+json` standard is widely adopted. Every error should include a machine-readable code and a human-readable message.

```java
// Consistent error response body
{
    "type": "https://api.bank.com/errors/insufficient-funds",
    "title": "Insufficient Funds",
    "status": 422,
    "detail": "Account ACC-1001 has $50.00 but transfer requires $200.00",
    "instance": "/api/v1/transfers/txn-789"
}
```

### API Documentation

API documentation is a feature, not an afterthought. Use OpenAPI (Swagger) annotations to generate interactive docs automatically. Well-documented APIs reduce support tickets and accelerate partner integrations.

```java
@Operation(summary = "Create a bank transfer")
@ApiResponse(responseCode = "201", description = "Transfer created successfully")
@ApiResponse(responseCode = "409", description = "Duplicate idempotency key")
@ApiResponse(responseCode = "422", description = "Insufficient funds")
@PostMapping("/api/v1/transfers")
public ResponseEntity<TransferResult> createTransfer(...) { }
```

## Why It Matters

API design is the interface contract between your bank and every system that integrates with it. A well-designed, idempotent API prevents double-charges, handles failures gracefully, and scales with your business. Interviewers for banking roles will test your understanding of idempotency, proper HTTP semantics, and pagination — these are not theoretical concepts but daily concerns in payment systems.

## Challenge

Build an idempotent transfer API simulation. Create a `TransferService` that accepts transfers with an idempotency key. Send the same transfer twice and demonstrate that only one transfer executes while the second returns the cached result.

## Starter Code
```java
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class IdempotentApiDemo {

    record TransferRequest(String fromAccount, String toAccount, double amount) {}
    record TransferResult(String transferId, String status, double amount, String message) {}

    static class TransferService {
        private final Map<String, TransferResult> idempotencyStore = new HashMap<>();
        private final Map<String, Double> accountBalances = new HashMap<>();

        public TransferService() {
            accountBalances.put("ACC-1001", 5000.00);
            accountBalances.put("ACC-2002", 1000.00);
        }

        public TransferResult processTransfer(String idempotencyKey, TransferRequest request) {
            // TODO: Check if the idempotency key already exists in the store
            // TODO: If it does, return the cached result (print "Duplicate detected")
            // TODO: If it doesn't, execute the transfer, store the result, and return it

            return null; // replace this
        }

        private TransferResult executeTransfer(TransferRequest request) {
            // TODO: Debit from source account, credit to destination account
            // TODO: Return a TransferResult with a generated transfer ID
            return null; // replace this
        }

        public void printBalances() {
            accountBalances.forEach((account, balance) ->
                System.out.println(account + ": $" + balance));
        }
    }

    public static void main(String[] args) {
        TransferService service = new TransferService();

        System.out.println("=== Initial Balances ===");
        service.printBalances();

        // Client generates an idempotency key
        String idempotencyKey = UUID.randomUUID().toString();

        TransferRequest request = new TransferRequest("ACC-1001", "ACC-2002", 250.00);

        // First request — should process
        System.out.println("\n=== First Request (idempotency key: " + idempotencyKey.substring(0, 8) + "...) ===");
        TransferResult result1 = service.processTransfer(idempotencyKey, request);
        System.out.println("Result: " + result1);

        // Retry with same idempotency key — should return cached result
        System.out.println("\n=== Retry Request (same idempotency key) ===");
        TransferResult result2 = service.processTransfer(idempotencyKey, request);
        System.out.println("Result: " + result2);

        // Different idempotency key — should process as new transfer
        System.out.println("\n=== New Request (different idempotency key) ===");
        String newKey = UUID.randomUUID().toString();
        TransferResult result3 = service.processTransfer(newKey, new TransferRequest("ACC-1001", "ACC-2002", 100.00));
        System.out.println("Result: " + result3);

        System.out.println("\n=== Final Balances ===");
        service.printBalances();
    }
}
```

## Expected Output
```
=== Initial Balances ===
ACC-1001: $5000.0
ACC-2002: $1000.0

=== First Request (idempotency key: a1b2c3d4...) ===
Processing new transfer: ACC-1001 → ACC-2002, $250.0
Result: TransferResult[transferId=TXN-1, status=COMPLETED, amount=250.0, message=Transfer successful]

=== Retry Request (same idempotency key) ===
Duplicate detected — returning cached result
Result: TransferResult[transferId=TXN-1, status=COMPLETED, amount=250.0, message=Transfer successful]

=== New Request (different idempotency key) ===
Processing new transfer: ACC-1001 → ACC-2002, $100.0
Result: TransferResult[transferId=TXN-2, status=COMPLETED, amount=100.0, message=Transfer successful]

=== Final Balances ===
ACC-1001: $4650.0
ACC-2002: $1350.0
```

## Hint

In `processTransfer()`, use `idempotencyStore.containsKey(idempotencyKey)` to check for duplicates. If found, return `idempotencyStore.get(idempotencyKey)`. Otherwise, call `executeTransfer()`, store the result with the key, and return it. Use a counter for generating sequential transfer IDs.

## Solution
```java
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class IdempotentApiDemo {

    record TransferRequest(String fromAccount, String toAccount, double amount) {}
    record TransferResult(String transferId, String status, double amount, String message) {}

    static class TransferService {
        private final Map<String, TransferResult> idempotencyStore = new HashMap<>();
        private final Map<String, Double> accountBalances = new HashMap<>();
        private int transferCounter = 0;

        public TransferService() {
            accountBalances.put("ACC-1001", 5000.00);
            accountBalances.put("ACC-2002", 1000.00);
        }

        public TransferResult processTransfer(String idempotencyKey, TransferRequest request) {
            if (idempotencyStore.containsKey(idempotencyKey)) {
                System.out.println("Duplicate detected — returning cached result");
                return idempotencyStore.get(idempotencyKey);
            }

            System.out.println("Processing new transfer: " + request.fromAccount()
                + " → " + request.toAccount() + ", $" + request.amount());

            TransferResult result = executeTransfer(request);
            idempotencyStore.put(idempotencyKey, result);
            return result;
        }

        private TransferResult executeTransfer(TransferRequest request) {
            transferCounter++;
            String transferId = "TXN-" + transferCounter;

            accountBalances.merge(request.fromAccount(), -request.amount(), Double::sum);
            accountBalances.merge(request.toAccount(), request.amount(), Double::sum);

            return new TransferResult(transferId, "COMPLETED", request.amount(), "Transfer successful");
        }

        public void printBalances() {
            accountBalances.forEach((account, balance) ->
                System.out.println(account + ": $" + balance));
        }
    }

    public static void main(String[] args) {
        TransferService service = new TransferService();

        System.out.println("=== Initial Balances ===");
        service.printBalances();

        String idempotencyKey = UUID.randomUUID().toString();

        TransferRequest request = new TransferRequest("ACC-1001", "ACC-2002", 250.00);

        System.out.println("\n=== First Request (idempotency key: " + idempotencyKey.substring(0, 8) + "...) ===");
        TransferResult result1 = service.processTransfer(idempotencyKey, request);
        System.out.println("Result: " + result1);

        System.out.println("\n=== Retry Request (same idempotency key) ===");
        TransferResult result2 = service.processTransfer(idempotencyKey, request);
        System.out.println("Result: " + result2);

        System.out.println("\n=== New Request (different idempotency key) ===");
        String newKey = UUID.randomUUID().toString();
        TransferResult result3 = service.processTransfer(newKey, new TransferRequest("ACC-1001", "ACC-2002", 100.00));
        System.out.println("Result: " + result3);

        System.out.println("\n=== Final Balances ===");
        service.printBalances();
    }
}
```
