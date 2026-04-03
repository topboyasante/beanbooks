---
id: "jwt-authentication"
moduleId: "spring-boot"
title: "JWT Authentication"
description: "Secure your API with JSON Web Tokens — issue, validate, and protect endpoints."
order: 4
---

## Banking Scenario

Banking APIs cannot use simple session-based authentication — they serve mobile apps, partner APIs, and internal services that don't share a server session. When a customer logs in through the mobile app and then checks their balance from a different server instance, a session stored on server A is invisible to server B. JSON Web Tokens (JWT) solve this: after login, the server issues a signed token containing the user's identity and roles. Every subsequent request includes this token, and the server verifies the signature without hitting a database.

This stateless approach scales across multiple server instances and is the standard for modern banking APIs. A JWT is self-contained — it carries the user's ID, roles, and expiration time inside the token itself. The server signs it with a secret key, so any tampering is detectable. No session store, no sticky sessions, no database lookup on every request.

## Content

### What is JWT

A JSON Web Token consists of three parts separated by dots: `header.payload.signature`. Each part is Base64-encoded (not encrypted — anyone can decode and read it). The header specifies the algorithm (e.g., HS256). The payload contains claims (data about the user). The signature is a hash of the header and payload using a secret key, ensuring the token has not been tampered with.

```java
// JWT structure (decoded):
// Header:  {"alg": "HS256", "typ": "JWT"}
// Payload: {"sub": "alice@javabank.com", "role": "CUSTOMER", "iat": 1700000000, "exp": 1700001800}
// Signature: HMACSHA256(base64(header) + "." + base64(payload), secretKey)

// Encoded token looks like:
// eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.4xR4...
```

The critical point: JWT is encoded, not encrypted. Never put passwords, credit card numbers, or sensitive data in the payload. Anyone who intercepts the token can decode and read the claims. The signature only guarantees integrity (no tampering), not confidentiality.

### JWT Claims

Claims are key-value pairs in the payload. Standard claims include `sub` (subject — the user), `iat` (issued at), `exp` (expiration), and `iss` (issuer). You add custom claims for application-specific data like roles, account IDs, or permission levels.

```java
// Standard claims:
// sub  - subject (user identifier): "alice@javabank.com"
// iat  - issued at (Unix timestamp): 1700000000
// exp  - expiration (Unix timestamp): 1700001800 (30 minutes later)
// iss  - issuer: "javabank-auth-service"

// Custom claims:
// role      - "CUSTOMER", "TELLER", "ADMIN"
// userId    - 42
// accountId - "ACC-001"
```

The `exp` claim is essential. Without it, a stolen token works forever. Banking tokens typically expire in 15-30 minutes for security.

### Authentication Flow

The JWT authentication flow has five steps. First, the client sends credentials to `POST /auth/login`. Second, the server validates the credentials against the database. Third, the server creates a JWT with the user's claims and signs it. Fourth, the client stores the token (typically in memory or a secure cookie). Fifth, every subsequent request includes the token in the `Authorization` header as `Bearer <token>`.

```java
// Step 1: Client sends login request
// POST /auth/login
// Body: {"email": "alice@javabank.com", "password": "secret123"}

// Step 2-3: Server validates and returns JWT
// Response: {"token": "eyJhbG...", "expiresIn": 1800}

// Step 4-5: Client sends token with every request
// GET /api/accounts
// Header: Authorization: Bearer eyJhbG...
```

The server never stores the token. It verifies the signature on each request using the same secret key that was used to sign it. If the signature is valid and the token has not expired, the request is authenticated.

### Spring Security and JWT Integration

In a Spring Boot application, JWT authentication requires three components: a `JwtTokenProvider` that generates and validates tokens, a `JwtAuthenticationFilter` that intercepts every request and checks for tokens, and a `SecurityFilterChain` that configures which endpoints require authentication.

```java
public class JwtTokenProvider {
    private final String secretKey = "my-secret-key-for-javabank-minimum-256-bits-long!!";

    public String generateToken(String email, String role) {
        long now = System.currentTimeMillis();
        long expiry = now + (30 * 60 * 1000); // 30 minutes
        // In production, use a library like io.jsonwebtoken (jjwt)
        // return Jwts.builder().setSubject(email).claim("role", role)
        //     .setIssuedAt(new Date(now)).setExpiration(new Date(expiry))
        //     .signWith(SignatureAlgorithm.HS256, secretKey).compact();
        return "eyJhbG...(signed token)";
    }

    public boolean validateToken(String token) {
        // Verify signature and check expiration
        // Returns true if valid, false if tampered or expired
        return token != null && token.startsWith("eyJhbG");
    }

    public String getEmailFromToken(String token) {
        // Decode payload and extract "sub" claim
        return "alice@javabank.com";
    }
}
```

The `JwtAuthenticationFilter` extends `OncePerRequestFilter` and runs before every request. It extracts the token from the `Authorization` header, validates it, and sets the authentication context so Spring Security knows who the user is.

### Securing Endpoints

Spring Security's `SecurityFilterChain` defines which endpoints are public and which require authentication. Login and registration must be accessible without a token. Account and transaction endpoints require authentication. Admin endpoints require a specific role.

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/auth/login", "/auth/register").permitAll()
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .requestMatchers("/api/**").authenticated()
        )
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
}
```

Session management is set to `STATELESS` because JWT replaces sessions entirely. CSRF protection is disabled because JWT-based APIs are not vulnerable to CSRF attacks (the token is not automatically sent by browsers like cookies are).

### Token Expiration and Refresh

Access tokens should be short-lived (15-30 minutes) to limit the damage of a stolen token. But forcing users to log in every 30 minutes is terrible UX. The solution is refresh tokens: a long-lived token (7 days) used solely to request new access tokens.

```java
// Login returns both tokens:
// {"accessToken": "eyJ...", "refreshToken": "dGhpcyBpcy...", "expiresIn": 1800}

// When access token expires, client calls:
// POST /auth/refresh
// Body: {"refreshToken": "dGhpcyBpcy..."}
// Response: {"accessToken": "eyJ...(new)", "expiresIn": 1800}
```

Refresh tokens are stored in the database so they can be revoked. If a user's account is compromised, you delete their refresh token, and they cannot get new access tokens. The existing access token still works until it expires (max 30 minutes), which is an acceptable tradeoff for the scalability benefits.

### Password Hashing and Common Pitfalls

Never store plain-text passwords. Use `BCryptPasswordEncoder`, which automatically salts each password (adding random data before hashing) so identical passwords produce different hashes.

```java
BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
String hashed = encoder.encode("secret123");
// Result: $2a$10$N9qo8uLOickgx2ZMRZoMye... (different every time)
boolean matches = encoder.matches("secret123", hashed); // true
```

Common JWT pitfalls to avoid: storing tokens in `localStorage` exposes them to XSS attacks (use `httpOnly` cookies instead). JWTs cannot be revoked without a server-side blacklist. Clock skew between servers can cause valid tokens to be rejected — add a small grace period to expiration checks.

## Why It Matters

Every banking API must authenticate its users, and JWT is the industry standard for stateless authentication. Understanding the full flow — from password hashing to token generation to endpoint security — is essential for building APIs that protect customer data. A single authentication flaw can expose account balances, enable unauthorized transfers, or violate banking regulations. JWT gives you scalable, stateless security, but only if you implement it correctly with proper expiration, secure storage, and password hashing.

## Challenge

Simulate a JWT authentication flow: create a user, log in, generate a simplified token, verify it, and access a protected resource based on the user's role.

## Starter Code
```java
import java.util.*;

public class JwtDemo {

    // TODO: Create a User class with email, hashedPassword, and role

    // TODO: Create a SimpleJwtProvider with:
    //   - generateToken(email, role) -> returns a simulated token string
    //   - validateToken(token) -> returns true/false
    //   - extractEmail(token) and extractRole(token)

    // TODO: Simulate login -> token generation -> verification -> access check

    public static void main(String[] args) {
        // Register a user with a hashed password (simulate hashing)
        // Login with email and password
        // Generate a token
        // Validate the token
        // Extract user info and check access to /api/accounts
    }
}
```

## Expected Output
```
Login: alice@javabank.com
Token generated: eyJhbG...(simulated)
Verification: VALID
User: alice, Role: CUSTOMER
Access /api/accounts: GRANTED
```

## Hint

You do not need a real JWT library. Simulate a token by Base64-encoding a string like `"alice@javabank.com:CUSTOMER:1700001800"`. Your `validateToken` method can simply check that the token decodes successfully. The `extractEmail` and `extractRole` methods split the decoded string on `:` to get the parts.

## Solution
```java
import java.util.*;

public class JwtDemo {

    static class User {
        String email;
        String hashedPassword;
        String role;

        User(String email, String hashedPassword, String role) {
            this.email = email;
            this.hashedPassword = hashedPassword;
            this.role = role;
        }
    }

    static class SimpleJwtProvider {
        public String generateToken(String email, String role) {
            String payload = email + ":" + role + ":" + (System.currentTimeMillis() + 1800000);
            return Base64.getEncoder().encodeToString(payload.getBytes());
        }

        public boolean validateToken(String token) {
            try {
                String decoded = new String(Base64.getDecoder().decode(token));
                String[] parts = decoded.split(":");
                if (parts.length != 3) return false;
                long expiry = Long.parseLong(parts[2]);
                return System.currentTimeMillis() < expiry;
            } catch (Exception e) {
                return false;
            }
        }

        public String extractEmail(String token) {
            String decoded = new String(Base64.getDecoder().decode(token));
            return decoded.split(":")[0];
        }

        public String extractRole(String token) {
            String decoded = new String(Base64.getDecoder().decode(token));
            return decoded.split(":")[1];
        }
    }

    static String simulateHash(String password) {
        return "$2a$10$" + Base64.getEncoder().encodeToString(password.getBytes());
    }

    static boolean checkPassword(String rawPassword, String hashed) {
        return hashed.equals(simulateHash(rawPassword));
    }

    public static void main(String[] args) {
        User alice = new User("alice@javabank.com", simulateHash("secret123"), "CUSTOMER");

        System.out.println("Login: " + alice.email);

        if (!checkPassword("secret123", alice.hashedPassword)) {
            System.out.println("Login failed");
            return;
        }

        SimpleJwtProvider jwt = new SimpleJwtProvider();
        String token = jwt.generateToken(alice.email, alice.role);
        System.out.println("Token generated: eyJhbG...(simulated)");

        boolean valid = jwt.validateToken(token);
        System.out.println("Verification: " + (valid ? "VALID" : "INVALID"));

        String email = jwt.extractEmail(token);
        String role = jwt.extractRole(token);
        String username = email.split("@")[0];
        System.out.println("User: " + username + ", Role: " + role);

        boolean hasAccess = valid && (role.equals("CUSTOMER") || role.equals("ADMIN"));
        System.out.println("Access /api/accounts: " + (hasAccess ? "GRANTED" : "DENIED"));
    }
}
```
