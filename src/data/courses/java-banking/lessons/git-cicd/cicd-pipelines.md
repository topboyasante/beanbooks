---
id: "cicd-pipelines"
moduleId: "git-cicd"
title: "CI/CD Pipelines"
description: "Automate build, test, and deployment with GitHub Actions for banking applications."
order: 3
---

## Banking Scenario

JavaBank's payment service team has been deploying manually for months. A developer builds the JAR on their laptop, runs a few tests by hand, then uploads it to the server via SSH. Last Friday, a developer accidentally deployed a build compiled with Java 17 to a server running Java 11. The service crashed during peak hours, and thousands of transactions failed. The CTO has mandated that all deployments must now go through an automated CI/CD pipeline -- no more manual builds, no more "it worked on my machine."

In banking, manual deployments are a liability. Automated pipelines guarantee that every build is tested, every artifact is reproducible, and every deployment passes the same quality gates. This is not just about speed -- it is about trust, consistency, and regulatory compliance.

## Content

### What Is CI/CD?

**Continuous Integration (CI)** means every developer's code is automatically built and tested when they push to the repository. **Continuous Deployment (CD)** extends this by automatically deploying tested code to production. Together, CI/CD creates a repeatable, reliable pipeline from code commit to running software.

Banks require CI because it eliminates human error from the build and test process. Every change is validated by the same automated checks, every time, without exception.

### GitHub Actions Basics

GitHub Actions is a CI/CD platform built into GitHub. Pipelines are defined as YAML files in `.github/workflows/`. The key concepts are:

- **Workflow**: A configurable automated process (the YAML file)
- **Job**: A set of steps that run on the same runner
- **Step**: An individual task (run a command, use an action)
- **Trigger**: What starts the workflow (push, pull_request, schedule)

### A Complete Pipeline for Spring Boot

Here is a real-world CI pipeline for JavaBank's payment service:

```yaml
# .github/workflows/ci.yml
name: JavaBank CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Java 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Run tests
        run: mvn test

      - name: Build JAR
        run: mvn package -DskipTests

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: payment-service.jar
          path: target/*.jar
```

### Environment Secrets

Banking applications handle sensitive credentials: database passwords, API keys, encryption keys. These must never appear in code or YAML files. GitHub Actions provides **encrypted secrets** that are injected at runtime:

```yaml
- name: Run integration tests
  env:
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    API_KEY: ${{ secrets.PAYMENT_GATEWAY_KEY }}
  run: mvn verify -Pintegration
```

Secrets are masked in logs and only available to workflows in the repository. This satisfies banking security requirements for credential management.

### Build Artifacts

A build artifact is the output of your pipeline -- typically a JAR file for Spring Boot applications. Artifacts are versioned and stored so you can deploy the exact same binary to every environment. This guarantees that what you tested is what you deploy.

### Deployment Stages

Banking applications move through multiple environments before reaching customers:

```bash
dev       -> Run by developers for rapid feedback
staging   -> Mirror of production for final validation
production -> Live environment serving real customers
```

Each stage has its own database, configuration, and access controls. Promoting a build from one stage to the next requires passing all quality gates.

### Quality Gates

Quality gates are automated checks that must pass before code can proceed. At JavaBank, the pipeline enforces:

- All unit and integration tests pass
- Code coverage exceeds 80%
- No critical security vulnerabilities (OWASP dependency check)
- Static analysis passes (no code smells above threshold)
- Docker image builds successfully

If any gate fails, the pipeline stops and the team is notified. No exceptions, no overrides.

## Why It Matters

CI/CD pipelines are the safety net that catches bugs, security issues, and configuration mistakes before they reach production. In banking, a failed deployment can mean lost transactions, regulatory fines, or damaged customer trust. Automated pipelines remove human error from the equation, ensure every build is reproducible, and provide an audit trail that regulators can inspect. Understanding how to build and maintain CI/CD pipelines is a core competency for any backend developer working on financial systems.

## Questions

Q: What is the primary benefit of Continuous Integration in a banking environment?
A) It allows developers to skip writing tests
B) It automatically builds and tests every code change, catching errors early
C) It eliminates the need for staging environments
D) It allows direct deployment to production without review
Correct: B

Q: Why should database passwords never appear in a GitHub Actions YAML file?
A) YAML does not support string values
B) It would make the pipeline run slower
C) Secrets in code can be exposed through version history and are a security violation
D) GitHub Actions cannot read string values from YAML
Correct: C

Q: What is the correct order of deployment stages for a banking application?
A) production -> staging -> dev
B) staging -> dev -> production
C) dev -> staging -> production
D) dev -> production -> staging
Correct: C

## Challenge

Simulate a CI/CD pipeline execution for JavaBank's payment service. Create a class that prints each stage of the pipeline: checkout, setup, test, build, security scan, and deployment to each environment. Include pass/fail status for each stage.

## Starter Code

```java
public class CICDPipeline {
    public static void main(String[] args) {
        System.out.println("=== JavaBank CI/CD Pipeline ===\n");

        String service = "payment-service";
        String version = "2.4.1";
        int totalTests = 156;
        int passedTests = 156;
        double coverage = 87.3;
        double coverageThreshold = 80.0;

        // Stage 1: Checkout
        // Print checkout step

        // Stage 2: Setup Java
        // Print Java setup

        // Stage 3: Run tests
        // Print test results with pass/fail count

        // Stage 4: Code coverage check
        // Print coverage and whether it meets threshold

        // Stage 5: Security scan
        // Print security scan results

        // Stage 6: Build artifact
        // Print JAR build

        // Stage 7: Deploy to environments
        // Print deployment to dev, staging, production
    }
}
```

## Expected Output

```
=== JavaBank CI/CD Pipeline ===

[Stage 1] Checkout code
Action: actions/checkout@v4
Status: SUCCESS

[Stage 2] Setup Java
Java version: 17 (Temurin)
Status: SUCCESS

[Stage 3] Run tests
Tests run: 156, Passed: 156, Failed: 0
Status: SUCCESS

[Stage 4] Code coverage
Coverage: 87.3% (threshold: 80.0%)
Status: SUCCESS -- coverage meets threshold

[Stage 5] Security scan
OWASP dependency check: 0 critical vulnerabilities
Status: SUCCESS

[Stage 6] Build artifact
Built: payment-service-2.4.1.jar
Status: SUCCESS

[Stage 7] Deploy
Deployed to dev: SUCCESS
Deployed to staging: SUCCESS
Deployed to production: SUCCESS

Pipeline complete: All 7 stages passed
```

## Hint

Use the variables provided in the starter code to build dynamic output. Compare coverage against the threshold to determine the status message. The pipeline should feel like reading a real CI log -- each stage reports what it did and whether it succeeded.

## Solution

```java
public class CICDPipeline {
    public static void main(String[] args) {
        System.out.println("=== JavaBank CI/CD Pipeline ===\n");

        String service = "payment-service";
        String version = "2.4.1";
        int totalTests = 156;
        int passedTests = 156;
        double coverage = 87.3;
        double coverageThreshold = 80.0;

        System.out.println("[Stage 1] Checkout code");
        System.out.println("Action: actions/checkout@v4");
        System.out.println("Status: SUCCESS");

        System.out.println("\n[Stage 2] Setup Java");
        System.out.println("Java version: 17 (Temurin)");
        System.out.println("Status: SUCCESS");

        System.out.println("\n[Stage 3] Run tests");
        int failedTests = totalTests - passedTests;
        System.out.println("Tests run: " + totalTests + ", Passed: " + passedTests + ", Failed: " + failedTests);
        System.out.println("Status: SUCCESS");

        System.out.println("\n[Stage 4] Code coverage");
        System.out.println("Coverage: " + coverage + "% (threshold: " + coverageThreshold + "%)");
        if (coverage >= coverageThreshold) {
            System.out.println("Status: SUCCESS -- coverage meets threshold");
        } else {
            System.out.println("Status: FAILED -- coverage below threshold");
        }

        System.out.println("\n[Stage 5] Security scan");
        System.out.println("OWASP dependency check: 0 critical vulnerabilities");
        System.out.println("Status: SUCCESS");

        System.out.println("\n[Stage 6] Build artifact");
        System.out.println("Built: " + service + "-" + version + ".jar");
        System.out.println("Status: SUCCESS");

        System.out.println("\n[Stage 7] Deploy");
        System.out.println("Deployed to dev: SUCCESS");
        System.out.println("Deployed to staging: SUCCESS");
        System.out.println("Deployed to production: SUCCESS");

        System.out.println("\nPipeline complete: All 7 stages passed");
    }
}
```
