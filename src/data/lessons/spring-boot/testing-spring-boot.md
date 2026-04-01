---
id: "testing-spring-boot"
moduleId: "spring-boot"
title: "Testing Spring Boot"
description: "Test Spring Boot applications with @SpringBootTest, MockMvc, and Testcontainers."
order: 4
---

## Banking Scenario

JavaBank's API handles real money. A bug in the transfer endpoint could double-charge customers or lose funds. Before any code reaches production, it must pass a comprehensive test suite covering unit tests, integration tests, and API tests. Spring Boot provides testing tools at every level of the testing pyramid.

Your team's CI pipeline runs all tests on every pull request. If any test fails, the code cannot be merged. This discipline prevents regressions and gives the team confidence to deploy frequently. Understanding Spring Boot's testing tools is essential for contributing to the codebase.

## Content

### The Testing Pyramid

The testing pyramid guides how many tests you write at each level. Unit tests form the broad base: fast, isolated, testing individual methods. Integration tests form the middle: testing how components work together with real databases or message queues. End-to-end tests form the narrow top: testing the full application flow from HTTP request to database and back.

In banking, the pyramid is critical. You want hundreds of unit tests that run in seconds, verifying business rules like interest calculation and validation logic. Dozens of integration tests verify that your repositories correctly persist data. A handful of end-to-end tests verify complete workflows like account creation and fund transfers.

The ratio matters because each level has tradeoffs. Unit tests are fast but do not catch integration bugs. Integration tests catch more bugs but are slower. End-to-end tests catch the most bugs but are slow, brittle, and expensive to maintain. A healthy banking project has roughly 70% unit, 20% integration, and 10% end-to-end tests.

```java
// Testing Pyramid:
//
//         /\
//        /  \        E2E Tests (few, slow, comprehensive)
//       /    \       - Full application running
//      /------\      - Real HTTP requests
//     /        \
//    / Integr.  \    Integration Tests (moderate)
//   /   Tests    \   - @SpringBootTest, @DataJpaTest
//  /--------------\  - Real database, Spring context
// /                \
// /   Unit Tests    \ Unit Tests (many, fast, isolated)
// ------------------  - Pure Java, no Spring
//                     - Mockito for dependencies

// Spring Boot testing annotations:
// @SpringBootTest      - Full application context
// @WebMvcTest          - Controller layer only
// @DataJpaTest         - Repository layer only
// @MockBean            - Replace a bean with a mock
```

### @SpringBootTest

`@SpringBootTest` loads the complete Spring ApplicationContext, creating all beans and wiring all dependencies. It is the most comprehensive test annotation but also the slowest. Use it when you need to test how multiple layers work together or when the behavior depends on auto-configuration.

By default, `@SpringBootTest` starts the application without a web server. To test HTTP endpoints, add `webEnvironment = WebEnvironment.RANDOM_PORT` to start an embedded server on a random available port. Use `@LocalServerPort` to discover the assigned port.

In banking, `@SpringBootTest` is used for integration tests that verify complete flows: creating an account, making a deposit, and verifying the balance. These tests catch configuration issues, transaction boundaries, and serialization problems that unit tests miss.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AccountIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private AccountRepository accountRepository;

    @BeforeEach
    void setUp() {
        accountRepository.deleteAll();
    }

    @Test
    void createAndRetrieveAccount() {
        // Create
        Account account = new Account("Alice", 5000.0);
        ResponseEntity<Account> createResponse = restTemplate.postForEntity(
            "/api/accounts", account, Account.class);
        assertEquals(HttpStatus.CREATED, createResponse.getStatusCode());

        // Retrieve
        Long id = createResponse.getBody().getId();
        Account found = restTemplate.getForObject(
            "/api/accounts/" + id, Account.class);
        assertEquals("Alice", found.getHolderName());
        assertEquals(5000.0, found.getBalance());
    }
}
```

### @WebMvcTest and MockMvc

`@WebMvcTest` loads only the web layer: controllers, filters, and exception handlers. It does not load services, repositories, or other components. This makes it fast and focused on testing HTTP request/response behavior. Dependencies are replaced with mocks using `@MockBean`.

`MockMvc` simulates HTTP requests without starting a real server. You build requests with `MockMvcRequestBuilders`, execute them, and verify responses with `MockMvcResultMatchers`. You can check status codes, response body content, headers, and JSON structure. This is the primary tool for testing REST controllers.

For banking APIs, `@WebMvcTest` verifies that endpoints return correct status codes, validate input properly, serialize responses correctly, and handle errors gracefully. It runs much faster than `@SpringBootTest` because it does not start a database or load the full application.

```java
@WebMvcTest(AccountController.class)
class AccountControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AccountService accountService;

    @Test
    void getAccount_shouldReturn200() throws Exception {
        Account account = new Account(1L, "Alice", 5000.0);
        when(accountService.findById(1L)).thenReturn(Optional.of(account));

        mockMvc.perform(get("/api/accounts/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderName").value("Alice"))
            .andExpect(jsonPath("$.balance").value(5000.0));
    }

    @Test
    void getAccount_notFound_shouldReturn404() throws Exception {
        when(accountService.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/accounts/999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void createAccount_invalidData_shouldReturn400() throws Exception {
        String invalidJson = "{\"holderName\": \"\", \"balance\": -100}";

        mockMvc.perform(post("/api/accounts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidJson))
            .andExpect(status().isBadRequest());
    }
}
```

### @DataJpaTest and Repository Testing

`@DataJpaTest` configures an in-memory database, scans for `@Entity` classes, and configures Spring Data JPA repositories. It does not load controllers, services, or other components. Each test runs in a transaction that is rolled back afterward, keeping the database clean.

This annotation is perfect for testing repository methods, especially custom queries and derived query methods. You can verify that your `findByHolderName` query returns the correct results, that your `@Query` annotation generates valid SQL, and that entity mappings are correct.

For banking, repository tests catch mapping errors early. If your `@Column(name = "holder_name")` annotation does not match the database column, the test fails before reaching production. They also verify complex query methods that aggregate data or filter by multiple criteria.

```java
@DataJpaTest
class AccountRepositoryTest {

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void findByHolderName_shouldReturnMatchingAccounts() {
        entityManager.persist(new Account("Alice Martin", 5000.0));
        entityManager.persist(new Account("Bob Jones", 3000.0));
        entityManager.flush();

        List<Account> results = accountRepository.findByHolderName("Alice Martin");
        assertEquals(1, results.size());
        assertEquals(5000.0, results.get(0).getBalance());
    }

    @Test
    void save_shouldPersistAccount() {
        Account account = new Account("Carol White", 7500.0);
        Account saved = accountRepository.save(account);

        assertNotNull(saved.getId());
        assertEquals("Carol White", saved.getHolderName());
    }

    @Test
    void findByBalanceGreaterThan_shouldFilterCorrectly() {
        entityManager.persist(new Account("Alice", 1000.0));
        entityManager.persist(new Account("Bob", 5000.0));
        entityManager.persist(new Account("Carol", 10000.0));
        entityManager.flush();

        List<Account> wealthy = accountRepository.findByBalanceGreaterThan(4000.0);
        assertEquals(2, wealthy.size());
    }
}
```

### @MockBean

`@MockBean` replaces a Spring bean with a Mockito mock in the application context. Use it in `@WebMvcTest` to mock service dependencies of controllers, or in `@SpringBootTest` to mock external service clients. The mock is automatically reset between tests.

The difference between `@Mock` (Mockito) and `@MockBean` (Spring Boot) is context. `@Mock` creates a mock for use in plain unit tests without Spring. `@MockBean` creates a mock and registers it in the Spring ApplicationContext, replacing the real bean. Controllers and other components that depend on the mocked bean receive the mock automatically through dependency injection.

In banking tests, `@MockBean` is commonly used to mock external service clients (payment gateways, credit bureaus), notification services (email, SMS), and slow dependencies (report generators, PDF services) while testing the rest of the application with real beans.

```java
@SpringBootTest
class TransferServiceTest {

    @Autowired
    private TransferService transferService;

    @MockBean
    private NotificationClient notificationClient;

    @MockBean
    private FraudDetectionService fraudService;

    @Test
    void transfer_shouldNotifyOnSuccess() {
        // Mock external services
        when(fraudService.check(any())).thenReturn(FraudResult.CLEAN);
        doNothing().when(notificationClient).send(any());

        // Real transfer logic runs with real database
        transferService.transfer("ACC-001", "ACC-002", 500.0);

        // Verify notification was sent
        verify(notificationClient).send(any(TransferNotification.class));
    }
}
```

### Testcontainers

Testcontainers runs real Docker containers during tests. Instead of testing against H2 (which has different behavior from PostgreSQL), you run tests against a real PostgreSQL container. The container starts before tests, runs during tests, and is destroyed afterward.

This eliminates the "works on H2 but fails on PostgreSQL" problem. Database-specific features like `JSONB` columns, array types, and custom functions work correctly in tests. Testcontainers supports PostgreSQL, MySQL, Redis, Kafka, and many other technologies.

For banking applications, Testcontainers is increasingly the standard for integration tests. It provides confidence that your queries, migrations, and transaction behavior work exactly as they will in production. The slight increase in test time (a few seconds for container startup) is a worthwhile tradeoff for test reliability.

```java
@SpringBootTest
@Testcontainers
class AccountRepositoryIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private AccountRepository accountRepository;

    @Test
    void shouldPersistAndRetrieveAccount() {
        // Running against real PostgreSQL, not H2
        Account account = accountRepository.save(new Account("Alice", 5000.0));
        Account found = accountRepository.findById(account.getId()).orElseThrow();
        assertEquals("Alice", found.getHolderName());
    }
}
```

### Test Configuration

Spring Boot tests can use a separate `application-test.yml` for test-specific configuration. Place it in `src/test/resources` to override production settings. Common overrides include in-memory database URLs, disabled security, and reduced logging.

The `@ActiveProfiles("test")` annotation activates the test profile, loading `application-test.yml`. You can also use `@TestPropertySource` to override specific properties inline. For Testcontainers, `@DynamicPropertySource` sets properties at runtime based on the container's assigned port.

A well-organized test suite has clear boundaries: unit tests need no configuration, `@WebMvcTest` uses mock beans, `@DataJpaTest` uses an embedded database, and `@SpringBootTest` with Testcontainers uses a real database. Each level provides more confidence at the cost of more setup and execution time.

```java
// src/test/resources/application-test.yml
// spring:
//   datasource:
//     url: jdbc:h2:mem:testdb
//   jpa:
//     hibernate:
//       ddl-auto: create-drop
//   security:
//     enabled: false
// logging:
//   level:
//     root: WARN
//     com.javabank: DEBUG

@SpringBootTest
@ActiveProfiles("test")
class AccountServiceTest {
    // Uses test configuration
    // H2 database, security disabled, minimal logging
}
```

## Why It Matters

Automated testing is the foundation of reliable banking software. Spring Boot's testing tools let you verify every layer of your application, from individual methods to full HTTP request flows. Understanding `@SpringBootTest`, `MockMvc`, `@DataJpaTest`, and Testcontainers is expected of every Spring Boot developer. A comprehensive test suite is what gives your team the confidence to deploy to production on a Friday afternoon.

## Challenge

Simulate MockMvc tests for an account endpoint. Test that GET returns 200 for an existing account and POST with invalid data returns 400.

## Starter Code
```java
public class Main {
    static int passed = 0;
    static int total = 2;

    public static void main(String[] args) {
        // TODO: Simulate a MockMvc test for GET /api/accounts/1 -> 200 OK
        // TODO: Simulate a MockMvc test for POST /api/accounts with invalid data -> 400
        // TODO: Print test results
    }
}
```

## Expected Output
```
Test: GET /api/accounts/1 -> 200 OK - PASSED
Test: POST /api/accounts (invalid) -> 400 Bad Request - PASSED
All tests passed: 2/2
```

## Hint

Create a simulated controller with a `get` method that returns 200 for valid IDs and a `post` method that validates input and returns 400 for invalid data. For each test, call the method, check the status code, print the result, and increment the passed counter if correct.

## Solution
```java
class AccountController {
    int getAccount(long id) {
        if (id > 0) {
            return 200;
        }
        return 404;
    }

    int createAccount(String holderName, double balance) {
        if (holderName == null || holderName.isEmpty() || balance < 0) {
            return 400;
        }
        return 201;
    }
}

public class Main {
    static int passed = 0;
    static int total = 2;

    public static void main(String[] args) {
        AccountController controller = new AccountController();

        // Test 1: GET existing account
        int getStatus = controller.getAccount(1);
        if (getStatus == 200) {
            System.out.println("Test: GET /api/accounts/1 -> 200 OK - PASSED");
            passed++;
        } else {
            System.out.println("Test: GET /api/accounts/1 -> 200 OK - FAILED");
        }

        // Test 2: POST with invalid data
        int postStatus = controller.createAccount("", -100);
        if (postStatus == 400) {
            System.out.println("Test: POST /api/accounts (invalid) -> 400 Bad Request - PASSED");
            passed++;
        } else {
            System.out.println("Test: POST /api/accounts (invalid) -> 400 Bad Request - FAILED");
        }

        System.out.println("All tests passed: " + passed + "/" + total);
    }
}
```
