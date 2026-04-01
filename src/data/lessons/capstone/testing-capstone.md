---
id: "testing-capstone"
moduleId: "capstone"
title: "Testing the API"
description: "Write unit tests, integration tests, and MockMvc tests for the banking API."
order: 5
---

## Banking Scenario

JavaBank is preparing for an external audit. The auditors want to see evidence that every business rule is tested: insufficient funds are rejected, daily limits are enforced, validation errors return the right status codes, and the database correctly persists transactions. The QA team has been writing manual test scripts, but the development team knows that automated tests are the only way to maintain confidence as the codebase grows.

This lesson brings together everything from the testing module and applies it to a real banking API. You will write unit tests with Mockito for isolated service logic, MockMvc tests for controller behavior, and integration tests that exercise the full stack.

## Content

### Unit Testing AccountService with Mockito

Unit tests verify business logic in isolation. By mocking the repository, you test only the service layer's decisions. This is the Mockito pattern from the testing module applied to real banking rules:

```java
package com.javabank.api.service;

import com.javabank.api.entity.*;
import com.javabank.api.exception.*;
import com.javabank.api.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @InjectMocks
    private AccountService accountService;

    private Account testAccount;

    @BeforeEach
    void setUp() {
        testAccount = new Account();
        testAccount.setBalance(new BigDecimal("1000.00"));
    }

    @Test
    void withdraw_sufficientFunds_updatesBalance() {
        when(accountRepository.findById(1L))
            .thenReturn(Optional.of(testAccount));

        accountService.withdraw(1L, new BigDecimal("500.00"));

        assertEquals(new BigDecimal("500.00"),
            testAccount.getBalance());
        verify(accountRepository).save(testAccount);
        System.out.println("PASS: withdraw with sufficient funds");
    }

    @Test
    void withdraw_insufficientFunds_throwsException() {
        when(accountRepository.findById(1L))
            .thenReturn(Optional.of(testAccount));

        assertThrows(InsufficientFundsException.class, () ->
            accountService.withdraw(1L, new BigDecimal("2000.00"))
        );
        verify(accountRepository, never()).save(any());
        System.out.println("PASS: withdraw with insufficient funds");
    }
}
```

### @WebMvcTest for Controller Testing

`@WebMvcTest` loads only the web layer, making tests fast. MockMvc simulates HTTP requests without starting a real server. This is how you verify that your controller returns the right status codes and response bodies:

```java
package com.javabank.api.controller;

import com.javabank.api.dto.*;
import com.javabank.api.service.AccountService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AccountController.class)
class AccountControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AccountService accountService;

    @Test
    void createAccount_validRequest_returns201() throws Exception {
        System.out.println("Testing POST /api/accounts - valid");
        mockMvc.perform(post("/api/accounts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "customerId": "1",
                        "accountType": "CHECKING",
                        "initialDeposit": 500.00
                    }
                    """))
            .andExpect(status().isCreated());
    }

    @Test
    void createAccount_missingFields_returns400() throws Exception {
        System.out.println("Testing POST /api/accounts - invalid");
        mockMvc.perform(post("/api/accounts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest());
    }
}
```

### @DataJpaTest for Repository Testing

`@DataJpaTest` configures an in-memory database and scans only JPA components. Use it to verify that custom queries and entity relationships work correctly:

```java
package com.javabank.api.repository;

import com.javabank.api.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class AccountRepositoryTest {

    @Autowired
    private AccountRepository accountRepository;

    @BeforeEach
    void setUp() {
        Account account = new Account();
        account.setBalance(new BigDecimal("5000.00"));
        accountRepository.save(account);
    }

    @Test
    void findByBalanceGreaterThan_returnsMatchingAccounts() {
        List<Account> results = accountRepository
            .findByBalanceGreaterThan(new BigDecimal("1000.00"));

        assertFalse(results.isEmpty());
        System.out.println("PASS: found " + results.size()
            + " accounts with balance > 1000");
    }
}
```

### @SpringBootTest for Full Integration

Integration tests start the entire application context. They verify that all layers work together, from controller through service to database:

```java
package com.javabank.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class JavaBankIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthEndpoint_returnsOk() throws Exception {
        mockMvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(content().string("JavaBank API is running"));
        System.out.println("PASS: integration health check");
    }
}
```

### Test Data Setup with @BeforeEach

Consistent test data prevents flaky tests. Use `@BeforeEach` to create a known starting state before every test. This isolates tests from each other, which you learned in the testing module:

```java
@BeforeEach
void setUp() {
    // Reset state before each test
    testAccount = new Account();
    testAccount.setBalance(new BigDecimal("1000.00"));
    // Each test starts with a known balance of 1000.00
    System.out.println("Test setup: account with balance 1000.00");
}
```

### Testing Strategy Summary

A well-tested banking API uses all three levels. Unit tests are fast and numerous, covering every business rule branch. Controller tests verify HTTP contracts. Integration tests confirm the full stack works end-to-end. This layered testing strategy matches the testing pyramid from the testing module.

## Why It Matters

In banking, untested code is a liability. A missed edge case in withdrawal logic could allow negative balances. An untested validation rule could let malformed data into the database. Automated tests catch regressions before they reach production, satisfy auditors, and give the team confidence to refactor and improve the codebase without fear of breaking critical financial operations.

## Questions

Q: What is the purpose of @Mock on AccountRepository in the service test?
A) It creates a real database connection for testing
B) It creates a fake implementation that returns controlled values
C) It automatically generates test data in the repository
D) It disables the repository to prevent data corruption
Correct: B

Q: Why does @WebMvcTest load only the web layer instead of the full application?
A) The web layer is the only part that can have bugs
B) It makes tests faster by not loading unnecessary components like databases
C) Spring Boot does not support full application testing
D) Controllers cannot be tested with the full application context
Correct: B

Q: What does `verify(accountRepository, never()).save(any())` assert?
A) That the save method was called exactly once
B) That the save method was called with a null argument
C) That the save method was never called during the test
D) That the repository was properly initialized
Correct: C

## Challenge

Write a test class for a `BankingService` that handles deposits and withdrawals. Test the happy path for both operations and the edge case where a withdrawal exceeds the balance. Use assertions to verify balances and exception handling.

## Starter Code
```java
import java.math.BigDecimal;

class InsufficientFundsException extends RuntimeException {
    InsufficientFundsException(String msg) { super(msg); }
}

class BankingService {
    private BigDecimal balance;

    public BankingService(BigDecimal initialBalance) {
        this.balance = initialBalance;
    }

    public void deposit(BigDecimal amount) {
        balance = balance.add(amount);
    }

    public void withdraw(BigDecimal amount) {
        if (balance.compareTo(amount) < 0) {
            throw new InsufficientFundsException(
                "Cannot withdraw " + amount + " from balance " + balance);
        }
        balance = balance.subtract(amount);
    }

    public BigDecimal getBalance() { return balance; }
}

public class TestingDemo {
    private static int passed = 0;
    private static int failed = 0;

    static void assertEquals(BigDecimal expected, BigDecimal actual,
                             String testName) {
        if (expected.compareTo(actual) == 0) {
            System.out.println("PASS: " + testName);
            passed++;
        } else {
            System.out.println("FAIL: " + testName
                + " (expected " + expected + ", got " + actual + ")");
            failed++;
        }
    }

    // TODO: Add assertThrows method
    // TODO: Add test for deposit
    // TODO: Add test for withdrawal
    // TODO: Add test for insufficient funds

    public static void main(String[] args) {
        // TODO: Run all tests
        // TODO: Print summary
    }
}
```

## Expected Output
```
PASS: deposit increases balance
PASS: withdraw decreases balance
PASS: withdraw with insufficient funds throws exception
---
3 passed, 0 failed
```

## Hint

For `assertThrows`, use a try-catch block. Run the code that should throw inside the try. If no exception is thrown, mark the test as failed. If the expected exception is caught, mark it as passed. Create a fresh `BankingService` instance before each test to ensure isolation.

## Solution
```java
import java.math.BigDecimal;

class InsufficientFundsException extends RuntimeException {
    InsufficientFundsException(String msg) { super(msg); }
}

class BankingService {
    private BigDecimal balance;

    public BankingService(BigDecimal initialBalance) {
        this.balance = initialBalance;
    }

    public void deposit(BigDecimal amount) {
        balance = balance.add(amount);
    }

    public void withdraw(BigDecimal amount) {
        if (balance.compareTo(amount) < 0) {
            throw new InsufficientFundsException(
                "Cannot withdraw " + amount
                + " from balance " + balance);
        }
        balance = balance.subtract(amount);
    }

    public BigDecimal getBalance() { return balance; }
}

public class TestingDemo {
    private static int passed = 0;
    private static int failed = 0;

    static void assertEquals(BigDecimal expected, BigDecimal actual,
                             String testName) {
        if (expected.compareTo(actual) == 0) {
            System.out.println("PASS: " + testName);
            passed++;
        } else {
            System.out.println("FAIL: " + testName
                + " (expected " + expected + ", got " + actual + ")");
            failed++;
        }
    }

    static void assertThrows(Class<? extends Exception> expectedType,
                              Runnable code, String testName) {
        try {
            code.run();
            System.out.println("FAIL: " + testName
                + " (no exception thrown)");
            failed++;
        } catch (Exception e) {
            if (expectedType.isInstance(e)) {
                System.out.println("PASS: " + testName);
                passed++;
            } else {
                System.out.println("FAIL: " + testName
                    + " (wrong exception: " + e.getClass().getName()
                    + ")");
                failed++;
            }
        }
    }

    static void testDeposit() {
        BankingService service =
            new BankingService(new BigDecimal("1000.00"));
        service.deposit(new BigDecimal("500.00"));
        assertEquals(new BigDecimal("1500.00"),
            service.getBalance(), "deposit increases balance");
    }

    static void testWithdraw() {
        BankingService service =
            new BankingService(new BigDecimal("1000.00"));
        service.withdraw(new BigDecimal("300.00"));
        assertEquals(new BigDecimal("700.00"),
            service.getBalance(), "withdraw decreases balance");
    }

    static void testWithdrawInsufficientFunds() {
        BankingService service =
            new BankingService(new BigDecimal("100.00"));
        assertThrows(InsufficientFundsException.class,
            () -> service.withdraw(new BigDecimal("500.00")),
            "withdraw with insufficient funds throws exception");
    }

    public static void main(String[] args) {
        testDeposit();
        testWithdraw();
        testWithdrawInsufficientFunds();
        System.out.println("---");
        System.out.println(passed + " passed, " + failed + " failed");
    }
}
```
