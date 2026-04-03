---
id: "api-security"
moduleId: "backend-patterns"
title: "API Security"
description: "Protect banking APIs against injection, data exposure, and common OWASP vulnerabilities."
order: 10
---

## Banking Scenario

In 2019, a major financial institution exposed 106 million customer records through a misconfigured API. The attacker did not need to break encryption or guess passwords — they exploited a server-side request forgery vulnerability in a public-facing API. The breach cost the bank over $300 million in fines and settlements.

Banking APIs are the highest-value targets on the internet. They move real money, store real identities, and are subject to regulations like PCI-DSS, GDPR, and SOX. Authentication and authorization (covered in earlier lessons) answer "who are you?" and "what can you do?" — but API security goes further. It asks: "Is this request safe to process at all?" Even a fully authenticated user can send a malicious payload. Even a properly authorized endpoint can leak sensitive data in its response. This lesson covers the threats that exist beyond authentication — and how to defend against them.

## Content

### OWASP API Security Top 10

The Open Web Application Security Project (OWASP) maintains a list of the most critical API security risks. These are not theoretical — they are the vulnerabilities that attackers exploit most often in production systems. The ones most relevant to banking APIs:

1. **Broken Object Level Authorization (BOLA)** — A user requests `/api/accounts/1002` and gets another customer's data because the API only checks "is this user logged in?" instead of "does this user own account 1002?"
2. **Broken Authentication** — Weak token validation, missing expiration checks, or tokens that survive password resets.
3. **Excessive Data Exposure** — The API returns full objects (including internal fields) and relies on the frontend to filter what the user sees.
4. **Lack of Rate Limiting** — Covered in the Rate Limiting lesson, but worth repeating: an unprotected login endpoint invites brute-force attacks.
5. **Injection** — Untrusted input reaches a SQL query, OS command, or template engine without sanitization.

```java
// BOLA example — WRONG: only checks authentication, not ownership
@GetMapping("/api/accounts/{id}")
public Account getAccount(@PathVariable Long id) {
    return accountRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
}

// CORRECT: verify the authenticated user owns this account
@GetMapping("/api/accounts/{id}")
public Account getAccount(@PathVariable Long id, Authentication auth) {
    Account account = accountRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
    if (!account.getOwnerId().equals(auth.getName())) {
        throw new AccessDeniedException("Not your account");
    }
    return account;
}
```

### Input Validation and Injection

Never trust input from the client. Every field in a request body, every query parameter, every path variable is a potential attack vector. The two most dangerous injection types for banking APIs are SQL injection and cross-site scripting (XSS).

**SQL Injection** happens when user input is concatenated directly into a SQL query string. The attacker sends input that changes the query's meaning:

```java
// VULNERABLE — string concatenation builds the query
String query = "SELECT * FROM accounts WHERE owner = '" + username + "'";
// If username = "' OR '1'='1" → returns ALL accounts

// SAFE — parameterized queries (JPA handles this automatically)
@Query("SELECT a FROM Account a WHERE a.owner = :owner")
List<Account> findByOwner(@Param("owner") String owner);
// The :owner parameter is bound safely — injection is impossible
```

If you use Spring Data JPA's repository methods (like `findByOwner(String owner)`), you are already safe — JPA uses parameterized queries under the hood. The danger comes when you write raw SQL with string concatenation or use `@Query` with `nativeQuery = true` and build strings manually.

**XSS (Cross-Site Scripting)** is relevant when your API returns data that gets rendered in a browser. If a user submits `<script>alert('hacked')</script>` as their display name and the API stores and returns it without sanitization, the script executes in every browser that renders that name.

```java
// Validate and sanitize input at the boundary
public record CreateAccountRequest(
    @NotBlank @Size(max = 100) @Pattern(regexp = "^[a-zA-Z0-9 \\-'.]+$")
    String ownerName,

    @NotNull @Positive
    BigDecimal initialDeposit,

    @NotBlank @Pattern(regexp = "^(CHECKING|SAVINGS)$")
    String accountType
) {}
```

Use Jakarta Bean Validation annotations (`@NotBlank`, `@Size`, `@Pattern`) on your request DTOs. Validate at the controller layer with `@Valid`, and reject anything that does not match. Whitelisting (allowing only known-good patterns) is always safer than blacklisting (trying to block known-bad patterns).

### CORS: Cross-Origin Resource Sharing

When a browser makes a request to a domain different from the page's origin, the browser enforces CORS. If your banking frontend is at `app.javabank.com` and your API is at `api.javabank.com`, the browser blocks the request unless the API explicitly allows that origin.

A misconfigured CORS policy — especially `Access-Control-Allow-Origin: *` — means any website on the internet can make authenticated requests to your API using your customers' cookies or tokens.

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            // Only allow your known frontends — NEVER use "*" in production
            .allowedOrigins("https://app.javabank.com", "https://admin.javabank.com")
            .allowedMethods("GET", "POST", "PUT", "DELETE")
            .allowedHeaders("Authorization", "Content-Type")
            .allowCredentials(true)
            .maxAge(3600);
    }
}
```

Key rules: never use wildcard origins in production, always set `allowCredentials(true)` only with explicit origins, and limit `allowedMethods` to what your API actually needs.

### HTTPS and Transport Security

Every banking API must run over HTTPS. Without TLS, every request and response — including JWT tokens, account numbers, and passwords — travels across the network in plaintext. Anyone on the same network (a coffee shop Wi-Fi, a compromised router) can read everything.

HTTPS provides three guarantees:
- **Encryption** — data is unreadable in transit
- **Integrity** — data cannot be tampered with without detection
- **Authentication** — the server proves its identity via its certificate

In Spring Boot, enforce HTTPS and redirect any HTTP requests:

```yaml
# application.yml
server:
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: ${KEYSTORE_PASSWORD}
    key-store-type: PKCS12
  port: 8443
```

In production, TLS termination usually happens at the load balancer or reverse proxy (Nginx, AWS ALB), not in the application itself. But the application should still reject non-HTTPS requests using Spring Security:

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.requiresChannel(channel -> channel.anyRequest().requiresSecure());
    // ... other security config
    return http.build();
}
```

### Security Headers

HTTP response headers tell the browser how to handle your API's responses. Missing headers leave the door open to clickjacking, MIME sniffing, and script injection.

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.headers(headers -> headers
        // Prevents the page from being embedded in an iframe (stops clickjacking)
        .frameOptions(frame -> frame.deny())
        // Stops browsers from guessing content types (prevents MIME sniffing attacks)
        .contentTypeOptions(Customizer.withDefaults())
        // Forces HTTPS for the next year, including subdomains
        .httpStrictTransportSecurity(hsts -> hsts
            .includeSubDomains(true)
            .maxAgeInSeconds(31536000))
        // Controls what the browser is allowed to execute
        .contentSecurityPolicy(csp -> csp
            .policyDirectives("default-src 'self'; script-src 'self'"))
    );
    return http.build();
}
```

| Header | Purpose |
|--------|---------|
| `Strict-Transport-Security` | Forces HTTPS for all future requests |
| `X-Content-Type-Options: nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options: DENY` | Blocks iframe embedding (clickjacking) |
| `Content-Security-Policy` | Controls which scripts, styles, and resources can load |
| `Cache-Control: no-store` | Prevents caching of sensitive API responses |

For banking APIs, also add `Cache-Control: no-store` on any response that contains financial data. You do not want account balances cached in a shared proxy.

### Sensitive Data Exposure

The most common mistake: returning your entire database entity as the API response. Internal IDs, creation timestamps, soft-delete flags, hashed passwords, internal notes — none of these should reach the client.

```java
// WRONG — returning the entity directly exposes internal fields
@GetMapping("/api/accounts/{id}")
public Account getAccount(@PathVariable Long id) {
    return accountRepository.findById(id).orElseThrow();
}
// Response includes: id, internalLedgerId, hashedPin, createdBy, auditFlags...

// CORRECT — use a response DTO that only includes what the client needs
public record AccountResponse(
    String accountNumber,
    String maskedAccountNumber,  // "****1234"
    String ownerName,
    String accountType,
    BigDecimal balance
) {
    public static AccountResponse from(Account account) {
        String masked = "****" + account.getAccountNumber()
            .substring(account.getAccountNumber().length() - 4);
        return new AccountResponse(
            account.getAccountNumber(),
            masked,
            account.getOwnerName(),
            account.getAccountType().name(),
            account.getBalance()
        );
    }
}
```

Rules for banking API responses:
- Never return entity objects directly — always map to response DTOs
- Mask account numbers in all responses (show only last 4 digits)
- Never return passwords, hashed or otherwise
- Never return internal IDs that could be used to enumerate resources
- Log the full data server-side for audit, but return only what the client needs

### Putting It All Together

A secure banking API endpoint combines all of these defenses in layers:

```java
@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping("/{accountNumber}")
    public ResponseEntity<AccountResponse> getAccount(
            // Input validation: pattern restricts format
            @PathVariable @Pattern(regexp = "^[0-9]{10}$") String accountNumber,
            // Authentication: Spring Security provides the principal
            Authentication auth) {

        // Authorization: service layer verifies ownership
        Account account = accountService.getAccountForOwner(accountNumber, auth.getName());

        // Data exposure: DTO masks sensitive fields
        return ResponseEntity.ok()
            // Security header: prevent caching of financial data
            .cacheControl(CacheControl.noStore())
            .body(AccountResponse.from(account));
    }
}
```

Each layer handles a different threat: validation stops malformed input, authentication confirms identity, authorization confirms ownership, DTOs prevent data leakage, and headers harden the transport.

## Why It Matters

API security is not a checklist you complete once. It is a mindset you apply to every endpoint, every response, every deployment. In a banking environment, a single exposed field can trigger a regulatory investigation. A single unvalidated parameter can drain accounts. The defenses in this lesson — input validation, CORS, HTTPS, security headers, and response filtering — form the baseline that every banking API must meet before it handles its first real transaction.

## Questions

Q: What is Broken Object Level Authorization (BOLA)?
A) A missing API endpoint
B) A user accessing another user's resources because the API only checks authentication, not ownership
C) A SQL injection that bypasses the login form
D) An expired JWT token
Correct: B

Q: Why should you never return JPA entities directly from a REST controller?
A) JPA entities are slower to serialize
B) They may expose internal fields, IDs, or sensitive data the client should not see
C) Spring Boot does not support returning entities
D) Entities cannot be converted to JSON
Correct: B

Q: What does the `Strict-Transport-Security` header do?
A) Encrypts the response body
B) Validates the JWT token signature
C) Tells the browser to only communicate with the server over HTTPS
D) Blocks SQL injection attempts
Correct: C

## Challenge

Write a `TransferRequest` DTO with Jakarta Bean Validation annotations that enforces: source account is a 10-digit number, destination account is a 10-digit number and different from source, amount is positive and has at most 2 decimal places, and description is optional but if provided must be under 200 characters with no HTML tags.

## Starter Code

```java
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record TransferRequest(
    // TODO: Validate 10-digit account number
    String sourceAccount,

    // TODO: Validate 10-digit account number
    String destinationAccount,

    // TODO: Positive, max 2 decimal places
    BigDecimal amount,

    // TODO: Optional, max 200 chars, no HTML
    String description
) {
    // TODO: Add a custom validation method that ensures
    // sourceAccount and destinationAccount are different
}
```

## Expected Output

```
Valid request: TransferRequest[sourceAccount=1234567890, destinationAccount=0987654321, amount=500.00, description=Monthly rent]
Invalid: sourceAccount must be a 10-digit number
Invalid: destination must differ from source
Invalid: amount must be positive
Invalid: description must not contain HTML tags
```

## Hint

Use `@Pattern(regexp = "^[0-9]{10}$")` for account numbers. For the amount, `@Positive` and `@Digits(integer = 10, fraction = 2)` handle the constraints. For description, `@Size(max = 200)` and `@Pattern(regexp = "^[^<>]*$")` reject HTML. For the cross-field check (source ≠ destination), add an `@AssertTrue` method.

## Solution

```java
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record TransferRequest(
    @NotBlank
    @Pattern(regexp = "^[0-9]{10}$", message = "must be a 10-digit number")
    String sourceAccount,

    @NotBlank
    @Pattern(regexp = "^[0-9]{10}$", message = "must be a 10-digit number")
    String destinationAccount,

    @NotNull
    @Positive(message = "must be positive")
    @Digits(integer = 10, fraction = 2, message = "max 2 decimal places")
    BigDecimal amount,

    @Size(max = 200, message = "must be under 200 characters")
    @Pattern(regexp = "^[^<>]*$", message = "must not contain HTML tags")
    String description
) {
    @AssertTrue(message = "destination must differ from source")
    boolean isDestinationDifferent() {
        if (sourceAccount == null || destinationAccount == null) return true;
        return !sourceAccount.equals(destinationAccount);
    }
}
```
xq