---
id: "build-tools"
moduleId: "java-platform"
title: "Build Tools: Maven & Gradle"
description: "Manage dependencies, compile code, and package applications with Maven and Gradle."
order: 4
---

## Banking Scenario

In a banking team, you never manually download JAR files or compile code from the command line. Build tools automate everything — downloading libraries, compiling source code, running tests, and packaging your application into a deployable artifact. When your team's CI/CD pipeline builds the transaction processing service, it runs `mvn clean package` or `./gradlew build`, and the build tool handles the rest. Understanding your build tool is essential because you'll modify it daily — adding dependencies, configuring plugins, and troubleshooting failed builds.

## Content

### What Build Tools Do

Before build tools existed, Java developers manually downloaded JAR files from websites, dropped them into a `/lib` folder, and configured the classpath by hand. This approach falls apart fast. What happens when Library A needs version 2.0 of Commons Lang, but Library B needs version 3.0? What happens when a teammate adds a new dependency but forgets to tell you? What happens when your laptop builds fine but the server doesn't? You get version conflicts, missing transitive dependencies, and builds that aren't reproducible.

Build tools solve all of this. They handle **dependency management** (automatically downloading the right JARs and their dependencies), **compilation** (turning `.java` files into `.class` files), **testing** (running your JUnit tests), **packaging** (creating JAR or WAR files), and **deployment** (pushing artifacts to a repository).

The two dominant build tools in Java are **Maven** and **Gradle**. Maven uses XML configuration and follows a "convention over configuration" philosophy — it expects your code in `src/main/java` and your tests in `src/test/java`. Gradle uses a code-based DSL (Groovy or Kotlin) and is more flexible and faster. Both are widely used in banking.

### Maven Fundamentals

Maven's configuration lives in a file called `pom.xml` (Project Object Model). Every Maven project is identified by three coordinates called **GAV**: `groupId` (your organization, like `com.javabank`), `artifactId` (your project name, like `transaction-service`), and `version` (like `1.0.0`).

Here's a realistic `pom.xml` for a banking Spring Boot application:

```xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>

    <groupId>com.javabank</groupId>
    <artifactId>transaction-service</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <scope>provided</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```

Maven has a **build lifecycle** — a fixed sequence of phases. When you run `mvn package`, Maven automatically runs every phase before it: `clean` (removes old build output), `validate` (checks the project is correct), `compile` (compiles source code), `test` (runs unit tests), `package` (creates the JAR), `verify` (runs integration tests), `install` (copies the JAR to your local repository), and `deploy` (uploads the JAR to a remote repository).

**Plugins** extend Maven's behavior. The `maven-compiler-plugin` sets the Java version, `spring-boot-maven-plugin` creates an executable JAR with embedded Tomcat, and `maven-surefire-plugin` runs your tests.

Most projects include the **Maven wrapper** (`mvnw`) — a script checked into version control that downloads and uses a specific Maven version. This ensures every developer and CI server uses the exact same version. You run it with `./mvnw clean package` instead of `mvn clean package`.

### Gradle Fundamentals

Gradle uses code instead of XML. You can write your build file in Groovy (`build.gradle`) or Kotlin (`build.gradle.kts`). The Kotlin DSL is increasingly preferred because it offers better IDE autocompletion and type safety.

Here's the same banking app as a `build.gradle.kts`:

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.2.0"
    id("io.spring.dependency-management") version "1.1.4"
}

group = "com.javabank"
version = "1.0.0"

java {
    sourceCompatibility = JavaVersion.VERSION_21
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    runtimeOnly("org.postgresql:postgresql")
    compileOnly("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
```

Notice the dependency configurations: `implementation` (equivalent to Maven's compile scope), `testImplementation` (test scope), `runtimeOnly` (runtime scope), and `compileOnly` (provided scope).

Common tasks include `./gradlew build` (compile, test, package), `./gradlew test` (run tests only), and `./gradlew bootRun` (start the Spring Boot app). You can also write custom tasks.

Gradle is faster than Maven because of **incremental compilation** (only recompiles changed files), a **build cache** (reuses outputs from previous builds), and the **Gradle daemon** (a long-running background process that avoids JVM startup overhead). The **Gradle wrapper** (`gradlew`) works the same way as Maven's — it ensures consistent Gradle versions across the team.

### Dependency Management

When you add `spring-boot-starter-web` to your project, you're not just getting one JAR. That starter depends on `spring-web`, which depends on `spring-core`, which depends on other libraries. These are called **transitive dependencies**, and your build tool resolves the entire tree automatically.

**Version conflicts** happen when two of your dependencies require different versions of the same library. Maven uses a "nearest wins" strategy (the version declared closest to your project in the dependency tree wins). Gradle uses "highest version wins" by default.

A **BOM (Bill of Materials)** is a special POM that defines compatible versions for a set of libraries. Spring Boot's `spring-boot-dependencies` BOM ensures that all Spring libraries work together. In Maven, you reference it in a `<dependencyManagement>` block. In Gradle, you use `platform()`.

Understanding **dependency scopes** matters: `compile` dependencies are bundled into your final JAR, `test` dependencies are only available during testing, `provided` dependencies exist at compile time but the server supplies them at runtime, and `runtime` dependencies are bundled but not needed during compilation (like JDBC drivers).

### Multi-Module Projects

Banking applications are large, and they're almost always split into **multi-module projects**. Instead of one giant codebase, you separate concerns into modules. A typical structure looks like this:

- `javabank-common` — shared entities, DTOs, and utility classes
- `javabank-api` — REST controllers and request/response handling
- `javabank-service` — business logic (interest calculation, fraud detection)
- `javabank-batch` — scheduled jobs (end-of-day processing, statement generation)

In Maven, you create a **parent POM** that declares shared dependencies and plugin configurations. Each module has its own `pom.xml` that references the parent. In Gradle, you define subprojects in `settings.gradle.kts` using `include("javabank-common", "javabank-api", "javabank-service")`.

This structure lets teams work independently, deploy modules separately, and share common code without duplication.

### Maven vs Gradle: When to Use Which

**Maven** is simpler, more convention-driven, and has a massive ecosystem of plugins. Most banking legacy projects and enterprise applications use Maven. If you're joining an existing banking team, there's a good chance you'll work with Maven.

**Gradle** builds faster, is more flexible for complex build logic, and handles large multi-module projects better. It's the default for Android development and is growing in backend adoption.

**For interviews**: know both, but Maven is more commonly asked about in banking. Be ready to explain the Maven lifecycle, how to add a dependency, and what `scope` means.

## Why It Matters

Every Java project you work on at a bank uses either Maven or Gradle. You'll add dependencies when integrating new libraries, configure plugins for code quality checks, debug failed builds in CI/CD pipelines, and understand multi-module structures in large banking platforms. Build tool knowledge isn't glamorous, but it's the difference between being productive on day one and being stuck asking teammates how to add a dependency.

## Challenge

Simulate a build process — print the Maven lifecycle phases in order, show which dependencies a banking app needs with their scopes, and display a simplified resolved dependency tree.

## Starter Code
```java
public class BuildToolsDemo {
    public static void main(String[] args) {
        // Maven lifecycle phases in order
        String[] lifecyclePhases = {
            "clean", "validate", "compile", "test",
            "package", "verify", "install", "deploy"
        };

        // Banking app dependencies: {name, scope}
        String[][] dependencies = {
            {"spring-boot-starter-web", "compile"},
            {"spring-boot-starter-data-jpa", "compile"},
            {"postgresql", "runtime"},
            {"lombok", "compile-only"},
            {"spring-boot-starter-test", "test"}
        };

        // Transitive dependencies of spring-boot-starter-web
        String[] transitiveDeps = {
            "spring-boot-starter",
            "spring-web",
            "spring-webmvc",
            "spring-boot-starter-tomcat"
        };

        // TODO: Print the Maven build lifecycle phases numbered 1-8
        System.out.println("Maven Build Lifecycle:");

        // TODO: Print a blank line, then print each dependency with its scope
        // Format: "- dependency-name (scope)"
        System.out.println("Banking App Dependencies:");

        // TODO: Print a blank line, then print the dependency tree
        // First line: "spring-boot-starter-web"
        // Remaining lines: "  +- dependency-name"
        System.out.println("Dependency Tree:");
    }
}
```

## Expected Output
```
Maven Build Lifecycle:
1. clean
2. validate
3. compile
4. test
5. package
6. verify
7. install
8. deploy

Banking App Dependencies:
- spring-boot-starter-web (compile)
- spring-boot-starter-data-jpa (compile)
- postgresql (runtime)
- lombok (compile-only)
- spring-boot-starter-test (test)

Dependency Tree:
spring-boot-starter-web
  +- spring-boot-starter
  +- spring-web
  +- spring-webmvc
  +- spring-boot-starter-tomcat
```

## Hint

Use a `for` loop with an index to number the lifecycle phases (remember arrays are zero-indexed, so add 1). For the dependencies array, access `dependencies[i][0]` for the name and `dependencies[i][1]` for the scope. For the dependency tree, print the first item without a prefix, then loop through the rest with `"  +- "` prepended.

## Solution
```java
public class BuildToolsDemo {
    public static void main(String[] args) {
        String[] lifecyclePhases = {
            "clean", "validate", "compile", "test",
            "package", "verify", "install", "deploy"
        };

        String[][] dependencies = {
            {"spring-boot-starter-web", "compile"},
            {"spring-boot-starter-data-jpa", "compile"},
            {"postgresql", "runtime"},
            {"lombok", "compile-only"},
            {"spring-boot-starter-test", "test"}
        };

        String[] transitiveDeps = {
            "spring-boot-starter",
            "spring-web",
            "spring-webmvc",
            "spring-boot-starter-tomcat"
        };

        System.out.println("Maven Build Lifecycle:");
        for (int i = 0; i < lifecyclePhases.length; i++) {
            System.out.println((i + 1) + ". " + lifecyclePhases[i]);
        }

        System.out.println();
        System.out.println("Banking App Dependencies:");
        for (int i = 0; i < dependencies.length; i++) {
            System.out.println("- " + dependencies[i][0] + " (" + dependencies[i][1] + ")");
        }

        System.out.println();
        System.out.println("Dependency Tree:");
        System.out.println("spring-boot-starter-web");
        for (int i = 0; i < transitiveDeps.length; i++) {
            System.out.println("  +- " + transitiveDeps[i]);
        }
    }
}
```
