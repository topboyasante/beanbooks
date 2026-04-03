---
id: "business-logic-security"
moduleId: "capstone"
title: "Business Logic & Security"
description: "Implement transaction rules, balance validation, and JWT authentication."
order: 4
---

## Banking Scenario

JavaBank's compliance team has strict rules: no account can go below zero, daily transfer limits must be enforced, and every API endpoint must be protected behind authentication. A junior developer once deployed an endpoint without auth, and a penetration tester withdrew funds from a test account within minutes. That will not happen again.

This lesson is where business logic and security intersect. You will combine the service layer patterns from Spring, the exception handling from Java basics, and add JWT-based authentication to lock down the entire API. Every concept from earlier modules converges here to protect real financial operations.

## Content

### AccountService with Business Rules

The service layer is where banking rules live. Controllers handle HTTP, but the service enforces what is actually allowed. This separation of concerns was a core OOP principle:

```java
package com.javabank.api.service;

import com.javabank.api.entity.*;
import com.javabank.api.exception.*;
import com.javabank.api.repository.AccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;

@Service
public class AccountService {

    private static final BigDecimal DAILY_TRANSFER_LIMIT =
        new BigDecimal("10000.00");

    private final AccountRepository accountRepository;

    public AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional
    public void withdraw(Long accountId, BigDecimal amount) {
        Account account = accountRepository.findById(accountId)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Account not found: " + accountId));

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidTransactionException(
                "Withdrawal amount must be positive");
        }

        if (account.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException(
                "Balance " + account.getBalance()
                + " is less than withdrawal " + amount);
        }

        account.setBalance(account.getBalance().subtract(amount));
        accountRepository.save(account);
        System.out.println("Withdrew " + amount
            + " from account " + accountId);
    }
}
```

### TransactionService for Deposits, Withdrawals, and Transfers

Transfers involve two accounts and must be atomic. The `@Transactional` annotation ensures both sides succeed or both roll back, applying the database transaction concepts from the Spring module:

```java
package com.javabank.api.service;

import com.javabank.api.entity.*;
import com.javabank.api.exception.*;
import com.javabank.api.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;

@Service
public class TransactionService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    public TransactionService(AccountRepository accountRepository,
            TransactionRepository transactionRepository) {
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
    }

    @Transactional
    public void transfer(Long fromId, Long toId, BigDecimal amount) {
        if (fromId.equals(toId)) {
            throw new InvalidTransactionException(
                "Cannot transfer to the same account");
        }

        Account from = accountRepository.findById(fromId)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Source account not found"));
        Account to = accountRepository.findById(toId)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Destination account not found"));

        if (from.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException(
                "Insufficient funds for transfer");
        }

        from.setBalance(from.getBalance().subtract(amount));
        to.setBalance(to.getBalance().add(amount));

        accountRepository.save(from);
        accountRepository.save(to);

        System.out.println("Transferred " + amount
            + " from account " + fromId + " to " + toId);
    }
}
```

### JWT Authentication Setup

JSON Web Tokens let the API authenticate users without server-side sessions. The login endpoint validates credentials and returns a signed token:

```java
package com.javabank.api.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.security.Key;
import java.util.Date;

public class JwtTokenProvider {

    private static final Key SECRET_KEY =
        Keys.secretKeyFor(SignatureAlgorithm.HS256);
    private static final long EXPIRATION_MS = 86400000; // 24 hours

    public String generateToken(String username, String role) {
        System.out.println("Generating JWT for: " + username);
        return Jwts.builder()
            .setSubject(username)
            .claim("role", role)
            .setIssuedAt(new Date())
            .setExpiration(new Date(
                System.currentTimeMillis() + EXPIRATION_MS))
            .signWith(SECRET_KEY)
            .compact();
    }

    public String getUsernameFromToken(String token) {
        return Jwts.parserBuilder()
            .setSigningKey(SECRET_KEY)
            .build()
            .parseClaimsJws(token)
            .getBody()
            .getSubject();
    }
}
```

### Security Filter Chain

Spring Security's filter chain intercepts every request. Public endpoints like login are permitted, while everything else requires a valid JWT:

```java
package com.javabank.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http)
            throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/accounts/**")
                    .hasAnyRole("CUSTOMER", "ADMIN")
                .anyRequest().authenticated()
            );
        System.out.println("Security filter chain configured");
        return http.build();
    }
}
```

### Role-Based Access Control

Different users have different permissions. A CUSTOMER can view their own accounts and make transactions. An ADMIN can view all accounts and manage customers. This maps directly to the authorization concepts from the security module:

```java
// Role-based endpoint access:
// CUSTOMER: GET /api/accounts/me, POST /api/transactions
// ADMIN:    GET /api/accounts (all), GET /api/admin/customers
// PUBLIC:   POST /api/auth/login, POST /api/auth/register
```

### Custom Security Exceptions

When authentication fails, the API should return structured JSON errors, not Spring's default HTML error page:

```java
package com.javabank.api.exception;

public class InsufficientFundsException extends RuntimeException {
    public InsufficientFundsException(String message) {
        super(message);
    }
}

public class InvalidTransactionException extends RuntimeException {
    public InvalidTransactionException(String message) {
        super(message);
    }
}
```

## Why It Matters

Business logic errors in banking software cost real money. An unchecked withdrawal that drives a balance negative, a transfer without atomic transaction guarantees, or an unprotected endpoint can all lead to financial loss, regulatory penalties, and broken customer trust. Layering security on top of validated business rules is not optional in financial software. It is the baseline.

## Questions

Q: Why is the transfer method annotated with @Transactional?
A) To make the method run faster
B) To ensure both account updates succeed or both roll back
C) To prevent concurrent access to the method
D) To automatically log the transaction
Correct: B

Q: What should happen when a user tries to withdraw more than their account balance?
A) The withdrawal should proceed and set the balance to zero
B) The system should silently ignore the request
C) An InsufficientFundsException should be thrown before modifying the balance
D) The system should create a loan for the remaining amount
Correct: C

Q: In the security filter chain, what does `hasRole("ADMIN")` do on the `/api/admin/**` path?
A) It creates an admin account automatically
B) It logs all requests to admin endpoints
C) It only allows users with the ADMIN role to access those endpoints
D) It disables authentication for admin endpoints
Correct: C

## Challenge

Simulate a banking service with business rules. Create an `AccountService` that handles deposits and withdrawals with validation: amounts must be positive, withdrawals cannot exceed the balance, and there is a daily withdrawal limit of $5,000.

## Starter Code
```java
import java.math.BigDecimal;

class InsufficientFundsException extends RuntimeException {
    InsufficientFundsException(String msg) { super(msg); }
}

class InvalidTransactionException extends RuntimeException {
    InvalidTransactionException(String msg) { super(msg); }
}

class AccountService {
    private BigDecimal balance;
    private BigDecimal dailyWithdrawn = BigDecimal.ZERO;
    private static final BigDecimal DAILY_LIMIT =
        new BigDecimal("5000.00");

    public AccountService(BigDecimal initialBalance) {
        this.balance = initialBalance;
    }

    // TODO: deposit method with positive amount validation
    // TODO: withdraw method with balance check and daily limit
    // TODO: getBalance method
}

public class BusinessLogicDemo {
    public static void main(String[] args) {
        AccountService service =
            new AccountService(new BigDecimal("3000.00"));
        // TODO: Deposit 1500
        // TODO: Withdraw 2000
        // TODO: Try to withdraw 5000 (should fail - insufficient funds)
        // TODO: Try to withdraw 4000 (should fail - daily limit)
    }
}
```

## Expected Output
```
Deposited: $1500.00 | Balance: $4500.00
Withdrew: $2000.00 | Balance: $2500.00
Error: Insufficient funds. Balance: 2500.00, requested: 5000.00
Error: Daily withdrawal limit exceeded. Limit: 5000.00, already withdrawn: 2000.00, requested: 4000.00
```

## Hint

Track `dailyWithdrawn` as a running total. Before processing a withdrawal, check two things: (1) the balance is sufficient and (2) adding this withdrawal to `dailyWithdrawn` does not exceed the `DAILY_LIMIT`. Use `BigDecimal.compareTo()` for all comparisons.

## Solution
```java
import java.math.BigDecimal;

class InsufficientFundsException extends RuntimeException {
    InsufficientFundsException(String msg) { super(msg); }
}

class InvalidTransactionException extends RuntimeException {
    InvalidTransactionException(String msg) { super(msg); }
}

class AccountService {
    private BigDecimal balance;
    private BigDecimal dailyWithdrawn = BigDecimal.ZERO;
    private static final BigDecimal DAILY_LIMIT =
        new BigDecimal("5000.00");

    public AccountService(BigDecimal initialBalance) {
        this.balance = initialBalance;
    }

    public void deposit(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidTransactionException(
                "Deposit amount must be positive");
        }
        balance = balance.add(amount);
        System.out.println("Deposited: $" + amount
            + " | Balance: $" + balance);
    }

    public void withdraw(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidTransactionException(
                "Withdrawal amount must be positive");
        }
        if (balance.compareTo(amount) < 0) {
            throw new InsufficientFundsException(
                "Insufficient funds. Balance: " + balance
                + ", requested: " + amount);
        }
        if (dailyWithdrawn.add(amount).compareTo(DAILY_LIMIT) > 0) {
            throw new InvalidTransactionException(
                "Daily withdrawal limit exceeded. Limit: "
                + DAILY_LIMIT + ", already withdrawn: "
                + dailyWithdrawn + ", requested: " + amount);
        }
        balance = balance.subtract(amount);
        dailyWithdrawn = dailyWithdrawn.add(amount);
        System.out.println("Withdrew: $" + amount
            + " | Balance: $" + balance);
    }

    public BigDecimal getBalance() { return balance; }
}

public class BusinessLogicDemo {
    public static void main(String[] args) {
        AccountService service =
            new AccountService(new BigDecimal("3000.00"));

        service.deposit(new BigDecimal("1500.00"));
        service.withdraw(new BigDecimal("2000.00"));

        try {
            service.withdraw(new BigDecimal("5000.00"));
        } catch (InsufficientFundsException e) {
            System.out.println("Error: " + e.getMessage());
        }

        try {
            service.withdraw(new BigDecimal("4000.00"));
        } catch (InvalidTransactionException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }
}
```
