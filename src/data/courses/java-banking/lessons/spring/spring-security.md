---
id: "spring-security"
moduleId: "spring"
title: "Spring Security Basics"
description: "Secure endpoints with authentication and authorization."
order: 8
---

## Banking Scenario

Security is the most critical concern in banking software. JavaBank handles sensitive financial data: account balances, transaction histories, personal information, and payment credentials. A security breach could expose thousands of customers to fraud, result in millions in regulatory fines, and destroy the bank's reputation.

Every endpoint in the API must answer two questions: "Who is making this request?" (authentication) and "Are they allowed to do this?" (authorization). Spring Security provides a comprehensive framework that handles both, protecting your endpoints with minimal configuration while remaining flexible enough for complex banking requirements.

## Content

### Why Security Matters in Banking

Banking applications face strict regulatory requirements. PCI-DSS mandates protection of cardholder data. GDPR requires safeguarding personal information. SOX demands audit trails for financial operations. Failure to comply results in fines, lawsuits, and loss of banking licenses.

Security is not a feature you add later. It must be designed into the application from the start. Common attack vectors include unauthorized API access (no authentication), privilege escalation (user accessing admin functions), injection attacks (SQL, XSS), and credential theft (weak password storage). Spring Security provides defense against all of these.

Every banking application must implement the principle of least privilege: users should only access what they need. A teller can view account balances but cannot delete accounts. An admin can manage users but should not process transactions. A customer can see their own data but not other customers' data. Spring Security's role-based access control makes this straightforward.

```java
// Security violations in banking have real consequences:
// - Unauthorized balance inquiry: privacy violation
// - Unauthenticated transfer: financial fraud
// - Admin endpoint exposed: full system compromise
// - Plaintext passwords: credential theft at scale

// Spring Security protects against all of these
// with a layered defense architecture
```

### Spring Security Architecture

Spring Security operates as a filter chain that intercepts every HTTP request before it reaches your controllers. Each filter in the chain performs a specific security function: authentication, authorization, CSRF protection, session management, and more. If any filter rejects the request, it never reaches the controller.

The key components are: `SecurityFilterChain` (configures which filters apply), `AuthenticationManager` (validates credentials), `UserDetailsService` (loads user data), and `SecurityContext` (stores the authenticated user for the current request). These components work together to enforce security policies.

When a request arrives, Spring Security checks if the endpoint requires authentication. If so, it looks for credentials (in headers, cookies, or tokens). The `AuthenticationManager` validates these credentials against a `UserDetailsService`. If valid, the authenticated user is stored in the `SecurityContext` for the duration of the request.

```java
// Request flow through Spring Security:
// 1. HTTP Request
// 2. SecurityFilterChain intercepts
//    a. CorsFilter - handles CORS
//    b. CsrfFilter - CSRF protection
//    c. AuthenticationFilter - extracts credentials
//    d. AuthorizationFilter - checks permissions
// 3. If all filters pass -> Controller method executes
// 4. If any filter rejects -> 401 Unauthorized or 403 Forbidden

// Simplified architecture
// Client -> Filter Chain -> DispatcherServlet -> Controller
//              |
//     AuthenticationManager
//              |
//       UserDetailsService
//              |
//          Database
```

### SecurityFilterChain Configuration

In modern Spring Security (6.x), you configure security through a `SecurityFilterChain` bean. This replaces the older `WebSecurityConfigurerAdapter` approach. You define which endpoints are public, which require authentication, and which require specific roles.

The configuration uses a fluent API with `HttpSecurity`. You specify URL patterns and their access requirements. Patterns are evaluated in order, so more specific rules should come first. The `anyRequest().authenticated()` catch-all ensures that any endpoint not explicitly configured requires authentication.

In banking applications, security configuration is typically strict by default. Everything requires authentication unless explicitly marked as public. Health check endpoints and login pages are public. Account operations require authentication. Administrative operations require the ADMIN role.

```java
@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/health", "/api/public/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/accounts/**").hasAnyRole("USER", "ADMIN")
                .anyRequest().authenticated()
            )
            .httpBasic(Customizer.withDefaults())
            .formLogin(Customizer.withDefaults());

        return http.build();
    }
}
```

### Authentication Methods

Spring Security supports multiple authentication methods. HTTP Basic Authentication sends credentials in the `Authorization` header (Base64-encoded). Form Login presents an HTML login page and uses session cookies. Token-based authentication (JWT) sends a token in each request header. OAuth2/OpenID Connect delegates authentication to external providers (Google, Okta).

For banking REST APIs, token-based authentication (JWT) is most common. The client authenticates once, receives a token, and includes it in subsequent requests. This is stateless -- the server does not need to maintain session state, making it suitable for horizontal scaling.

For internal admin portals, form-based login with session management is often used. Spring Security handles session creation, CSRF protection, and session fixation prevention automatically.

```java
@Configuration
class SecurityConfig {

    // HTTP Basic: suitable for service-to-service communication
    @Bean
    SecurityFilterChain basicAuth(HttpSecurity http) throws Exception {
        http.httpBasic(Customizer.withDefaults());
        return http.build();
    }

    // Password encoding: NEVER store plaintext passwords
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
        // Input:  "password123"
        // Stored: "$2a$10$N9qo8uLOi..."  (60 char hash)
    }

    // UserDetailsService: loads user from database
    @Bean
    UserDetailsService userDetailsService(PasswordEncoder encoder) {
        UserDetails user = User.builder()
            .username("alice")
            .password(encoder.encode("password123"))
            .roles("USER")
            .build();

        UserDetails admin = User.builder()
            .username("admin")
            .password(encoder.encode("admin456"))
            .roles("ADMIN", "USER")
            .build();

        return new InMemoryUserDetailsManager(user, admin);
    }
}
```

### Role-Based Access Control

`@PreAuthorize` provides method-level security. You annotate service or controller methods with SpEL (Spring Expression Language) expressions that check the user's roles or permissions. This is a second layer of defense beyond URL-based security configuration.

`hasRole("ADMIN")` checks if the user has the ADMIN role. `hasAnyRole("USER", "ADMIN")` checks for any of the listed roles. You can also use `hasAuthority` for more granular permissions and combine expressions with `and`, `or`, and `not`.

In banking, method-level security protects critical operations. Even if a URL pattern accidentally allows access, the method-level check stops unauthorized users. Defense in depth means multiple security layers, so a single misconfiguration does not expose sensitive operations.

```java
@Service
class AccountService {

    @PreAuthorize("hasRole('USER')")
    public Account getAccount(Long id) {
        // Any authenticated user with USER role can view
        return accountRepository.findById(id).orElseThrow();
    }

    @PreAuthorize("hasRole('ADMIN')")
    public void deleteAccount(Long id) {
        // Only admins can delete accounts
        accountRepository.deleteById(id);
    }

    @PreAuthorize("hasRole('ADMIN') or #accountId == authentication.principal.accountId")
    public List<Transaction> getTransactions(Long accountId) {
        // Admins can view any account; users can only view their own
        return transactionRepository.findByAccountId(accountId);
    }
}
```

### CORS and API Security

Cross-Origin Resource Sharing (CORS) controls which domains can call your API from a browser. Without CORS configuration, a banking web app at `app.javabank.com` cannot call the API at `api.javabank.com`. Spring Security integrates CORS configuration into the security filter chain.

For banking APIs, CORS should be restrictive. Only allow requests from your known frontend domains. Never use `allowedOrigins("*")` in production -- this lets any website make requests to your API. Specify exact origins, allowed methods, and allowed headers.

Additional API security measures include rate limiting (preventing brute-force attacks), input validation (preventing injection), and security headers (preventing clickjacking and XSS). Spring Security adds several security headers by default, including `X-Content-Type-Options`, `X-Frame-Options`, and `Cache-Control`.

```java
@Configuration
class CorsConfig {

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "https://app.javabank.com",
            "https://admin.javabank.com"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}

// In SecurityFilterChain:
// http.cors(cors -> cors.configurationSource(corsConfigurationSource()));
```

## Why It Matters

Security is not optional in banking -- it is the most scrutinized aspect of any financial application. Spring Security is the de facto standard for securing Java applications, and understanding its filter chain, authentication mechanisms, and authorization model is essential. Banking interviews will test your understanding of security concepts, and production banking code will require you to configure and extend Spring Security daily.

## Challenge

Define a security configuration that specifies which endpoints are public, which require authentication, and which require admin privileges. Print the access rules for each endpoint.

## Starter Code
```java
import java.util.LinkedHashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        // TODO: Create a SecurityConfig class that defines access rules
        // TODO: Define rules for:
        //   - /api/health -> public (no auth required)
        //   - /api/accounts -> requires authentication (LOGIN)
        //   - /api/admin/users -> requires ADMIN role
        // TODO: Print each endpoint with its access requirement
    }
}
```

## Expected Output
```
Public endpoint: /api/health - OK
Authenticated: /api/accounts - Requires LOGIN
Admin only: /api/admin/users - Requires ADMIN role
```

## Hint

Create a `SecurityConfig` class with a `Map<String, String>` storing endpoint paths and their access rules. Add three entries for the three endpoints. Iterate over the map and print each endpoint with its rule. Format the output to match: public endpoints say "OK", authenticated endpoints say "Requires LOGIN", and admin endpoints say "Requires ADMIN role".

## Solution
```java
import java.util.LinkedHashMap;
import java.util.Map;

class SecurityConfig {
    private Map<String, String> rules = new LinkedHashMap<>();

    SecurityConfig() {
        rules.put("/api/health", "PUBLIC");
        rules.put("/api/accounts", "AUTHENTICATED");
        rules.put("/api/admin/users", "ADMIN");
    }

    void printSecurityRules() {
        for (Map.Entry<String, String> entry : rules.entrySet()) {
            String path = entry.getKey();
            String rule = entry.getValue();

            switch (rule) {
                case "PUBLIC":
                    System.out.println("Public endpoint: " + path + " - OK");
                    break;
                case "AUTHENTICATED":
                    System.out.println("Authenticated: " + path + " - Requires LOGIN");
                    break;
                case "ADMIN":
                    System.out.println("Admin only: " + path + " - Requires ADMIN role");
                    break;
            }
        }
    }
}

public class Main {
    public static void main(String[] args) {
        SecurityConfig config = new SecurityConfig();
        config.printSecurityRules();
    }
}
```
