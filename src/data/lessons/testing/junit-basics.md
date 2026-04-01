---
id: "junit-basics"
moduleId: "testing"
title: "JUnit 5 Basics"
description: "Write your first unit tests with JUnit 5 assertions and lifecycle."
order: 1
---

## Banking Scenario

At JavaBank, every piece of code that handles money must be thoroughly tested before deployment. A single bug in a deposit or withdrawal method could result in incorrect balances for thousands of customers, regulatory violations, and loss of trust. Automated testing is the safety net that prevents these costly mistakes.

Your team lead has mandated 80% test coverage for all banking modules. Before you write any new feature, you need to understand how to write effective unit tests using JUnit 5, the standard testing framework in the Java ecosystem. Today, you will learn to test a BankAccount class that handles deposits and withdrawals.

## Content

### Why Testing Matters

In banking software, correctness is not optional. Manual testing is slow, error-prone, and cannot keep up with continuous deployment cycles. Automated unit tests let you verify that individual methods behave correctly in isolation, catch regressions when code changes, and serve as living documentation of expected behavior.

Unit tests follow the Arrange-Act-Assert pattern. You set up test data (arrange), call the method under test (act), and verify the result (assert). Each test should focus on a single behavior and be independent of other tests. A good test suite runs in seconds and gives you immediate confidence that your code works.

JUnit 5 is the latest version of the most widely used Java testing framework. It introduced a modular architecture with JUnit Platform, JUnit Jupiter (the programming model), and JUnit Vintage (backward compatibility). Most of the time, you will work with JUnit Jupiter annotations and assertions.

```java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BankAccountTest {
    @Test
    void depositShouldIncreaseBalance() {
        BankAccount account = new BankAccount("Alice", 1000.0);
        account.deposit(500.0);
        assertEquals(1500.0, account.getBalance());
    }
}
```

### JUnit 5 Annotations

JUnit 5 provides several annotations to control test execution. The `@Test` annotation marks a method as a test case. `@BeforeEach` runs before every test method, making it ideal for setting up shared test fixtures. `@AfterEach` runs after every test, useful for cleanup. `@DisplayName` gives your test a human-readable name that appears in test reports.

There are also class-level lifecycle annotations. `@BeforeAll` and `@AfterAll` run once before and after all tests in a class. These must be static methods (unless you use `@TestInstance(Lifecycle.PER_CLASS)`). Use them for expensive setup like database connections or loading test configuration.

```java
import org.junit.jupiter.api.*;

class AccountServiceTest {
    private BankAccount account;

    @BeforeEach
    void setUp() {
        account = new BankAccount("Test User", 1000.0);
    }

    @AfterEach
    void tearDown() {
        account = null;
    }

    @Test
    @DisplayName("Deposit should add amount to balance")
    void depositAddsToBalance() {
        account.deposit(250.0);
        assertEquals(1250.0, account.getBalance());
    }

    @Test
    @DisplayName("Withdrawal should subtract from balance")
    void withdrawalSubtractsFromBalance() {
        account.withdraw(200.0);
        assertEquals(800.0, account.getBalance());
    }
}
```

### Assertions

JUnit 5 provides a rich set of assertions in the `Assertions` class. The most common ones are `assertEquals` for checking equality, `assertTrue` and `assertFalse` for boolean conditions, `assertNull` and `assertNotNull` for null checks, and `assertThrows` for verifying that exceptions are thrown.

The `assertThrows` method is particularly important in banking code. You need to verify that invalid operations like negative deposits or overdrafts are properly rejected with exceptions. It takes the expected exception class and a lambda containing the code that should throw.

```java
import static org.junit.jupiter.api.Assertions.*;

@Test
void withdrawalExceedingBalanceShouldThrow() {
    BankAccount account = new BankAccount("Bob", 500.0);

    IllegalArgumentException exception = assertThrows(
        IllegalArgumentException.class,
        () -> account.withdraw(1000.0)
    );

    assertEquals("Insufficient funds", exception.getMessage());
}

@Test
void accountShouldNotBeNull() {
    BankAccount account = new BankAccount("Carol", 100.0);
    assertNotNull(account);
    assertFalse(account.getBalance() < 0);
}
```

### Test Class Structure

A well-organized test class mirrors the structure of the class it tests. Group related tests together and use descriptive method names that explain the scenario and expected outcome. The convention `methodName_scenario_expectedBehavior` is widely used in enterprise Java projects.

Keep tests focused and independent. Each test should create its own test data or use `@BeforeEach` to get a fresh instance. Never rely on test execution order. A good test should pass whether it runs alone or as part of the full suite.

```java
class TransactionValidatorTest {

    private TransactionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new TransactionValidator();
    }

    @Test
    @DisplayName("Valid deposit amount should pass validation")
    void validate_validDeposit_returnsTrue() {
        assertTrue(validator.isValidAmount(100.0));
    }

    @Test
    @DisplayName("Zero amount should fail validation")
    void validate_zeroAmount_returnsFalse() {
        assertFalse(validator.isValidAmount(0.0));
    }

    @Test
    @DisplayName("Negative amount should fail validation")
    void validate_negativeAmount_returnsFalse() {
        assertFalse(validator.isValidAmount(-50.0));
    }
}
```

### Parameterized Tests

When you need to test the same logic with multiple inputs, `@ParameterizedTest` avoids code duplication. You supply test data through sources like `@ValueSource`, `@CsvSource`, or `@MethodSource`. Each set of parameters runs as a separate test case.

This is especially useful for boundary testing in banking. You might want to verify that deposits work for a range of valid amounts or that specific invalid amounts are all rejected. Parameterized tests make your test suite more thorough without adding boilerplate.

```java
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;

class DepositValidationTest {

    @ParameterizedTest
    @ValueSource(doubles = {0.01, 1.0, 100.0, 999999.99})
    @DisplayName("Valid deposit amounts should be accepted")
    void validAmounts(double amount) {
        BankAccount account = new BankAccount("Test", 0.0);
        account.deposit(amount);
        assertEquals(amount, account.getBalance());
    }

    @ParameterizedTest
    @CsvSource({
        "1000.0, 500.0, 1500.0",
        "0.0, 100.0, 100.0",
        "2500.0, 0.01, 2500.01"
    })
    void depositCalculation(double initial, double deposit, double expected) {
        BankAccount account = new BankAccount("Test", initial);
        account.deposit(deposit);
        assertEquals(expected, account.getBalance(), 0.001);
    }
}
```

### Test Naming Conventions

Good test names serve as documentation. When a test fails in CI, the name should tell you exactly what broke without reading the test code. Common conventions include `shouldDoX_whenY`, `methodName_scenario_expectedResult`, or using `@DisplayName` for natural language descriptions.

In banking projects, clear test names are critical during audits. Regulators may review your test reports to verify that edge cases are covered. A test named `test1` tells nobody anything, but `withdraw_insufficientFunds_throwsException` communicates the exact business rule being verified.

```java
class AccountNamingExamples {

    // Convention 1: should_when
    @Test
    void shouldRejectDeposit_whenAmountIsNegative() { }

    // Convention 2: method_scenario_expected
    @Test
    void deposit_negativeAmount_throwsIllegalArgument() { }

    // Convention 3: @DisplayName for readability
    @Test
    @DisplayName("Account creation with valid holder name succeeds")
    void accountCreation() { }
}
```

## Why It Matters

Unit testing is a non-negotiable skill for any Java developer working in banking. Financial institutions require extensive test coverage to meet regulatory standards and prevent costly bugs. JUnit 5 is the industry standard, and understanding its annotations, assertions, and parameterized testing capabilities will be expected in every banking Java role you apply for.

## Challenge

Write test assertions for a `BankAccount` deposit method. Create three tests: one for a normal deposit, one for a zero deposit, and one verifying that a negative deposit throws an `IllegalArgumentException`.

## Starter Code
```java
class BankAccount {
    private String holder;
    private double balance;

    public BankAccount(String holder, double balance) {
        this.holder = holder;
        this.balance = balance;
    }

    public void deposit(double amount) {
        if (amount < 0) {
            throw new IllegalArgumentException("Deposit amount cannot be negative");
        }
        this.balance += amount;
    }

    public double getBalance() { return balance; }
    public String getHolder() { return holder; }
}

public class Main {
    static int passed = 0;
    static int total = 3;

    public static void main(String[] args) {
        testNormalDeposit();
        testZeroDeposit();
        testNegativeDepositThrows();
        System.out.println("All tests passed: " + passed + "/" + total);
    }

    static void testNormalDeposit() {
        // TODO: Create account with balance 1000, deposit 500, assert balance is 1500
    }

    static void testZeroDeposit() {
        // TODO: Create account with balance 1000, deposit 0, assert balance is still 1000
    }

    static void testNegativeDepositThrows() {
        // TODO: Create account, try to deposit -100, assert IllegalArgumentException is thrown
    }
}
```

## Expected Output
```
All tests passed: 3/3
```

## Hint

For each test, create a `BankAccount`, perform the action, and check the result. Use `if` statements to verify: for `testNormalDeposit`, check that `getBalance()` equals 1500.0 after depositing 500. For the exception test, use a try-catch block -- if the exception is caught, the test passes; if no exception is thrown, it fails.

## Solution
```java
class BankAccount {
    private String holder;
    private double balance;

    public BankAccount(String holder, double balance) {
        this.holder = holder;
        this.balance = balance;
    }

    public void deposit(double amount) {
        if (amount < 0) {
            throw new IllegalArgumentException("Deposit amount cannot be negative");
        }
        this.balance += amount;
    }

    public double getBalance() { return balance; }
    public String getHolder() { return holder; }
}

public class Main {
    static int passed = 0;
    static int total = 3;

    public static void main(String[] args) {
        testNormalDeposit();
        testZeroDeposit();
        testNegativeDepositThrows();
        System.out.println("All tests passed: " + passed + "/" + total);
    }

    static void testNormalDeposit() {
        BankAccount account = new BankAccount("Alice", 1000.0);
        account.deposit(500.0);
        if (account.getBalance() == 1500.0) {
            passed++;
        }
    }

    static void testZeroDeposit() {
        BankAccount account = new BankAccount("Alice", 1000.0);
        account.deposit(0);
        if (account.getBalance() == 1000.0) {
            passed++;
        }
    }

    static void testNegativeDepositThrows() {
        BankAccount account = new BankAccount("Alice", 1000.0);
        try {
            account.deposit(-100.0);
        } catch (IllegalArgumentException e) {
            passed++;
        }
    }
}
```
