---
id: "development-environment"
moduleId: "java-platform"
title: "Development Environment"
description: "Set up your Java development environment and understand project structure, packages, and the classpath."
order: 3
---

## Banking Scenario

In a bank's engineering team, every developer works with the same project structure, build tools, and IDE configurations. Understanding packages and classpath is essential because banking applications have hundreds of classes organized across domains — accounts, transactions, compliance, reporting. A single banking platform might contain packages like `com.javabank.accounts`, `com.javabank.transactions.domestic`, `com.javabank.compliance.aml`, and `com.javabank.reporting.regulatory`.

Without a clear organizational system, a team of fifty developers working on the same codebase would quickly descend into chaos — name collisions, missing dependencies, and broken builds. Packages, classpath, and proper project structure solve these problems.

## Content

### Choosing an IDE

An **IDE** (Integrated Development Environment) provides code editing, compilation, debugging, and project management in one tool. The three most popular Java IDEs are:

- **IntelliJ IDEA** — The industry standard for professional Java development. The Community Edition is free and sufficient for learning. Most banking teams use IntelliJ.
- **VS Code with Java Extensions** — Lightweight and fast. Install the "Extension Pack for Java" by Microsoft. A good choice if you already use VS Code for other languages.
- **Eclipse** — Free and open source. Historically popular in enterprise Java, though IntelliJ has largely overtaken it.

For this course, any of these will work. The concepts are the same regardless of your editor.

### Java Project Structure

A well-organized Java project follows a standard directory layout:

```
my-banking-app/
├── src/                    # Source code
│   └── com/
│       └── javabank/
│           ├── accounts/   # Account-related classes
│           ├── transactions/
│           └── app/
│               └── Main.java
├── bin/                    # Compiled .class files (generated)
├── lib/                    # External libraries (JAR files)
└── README.md
```

The `src/` directory holds your `.java` source files. The `bin/` (or `out/`) directory is where compiled `.class` files go. The `lib/` directory stores third-party libraries your project depends on. Your IDE typically manages the `bin/` directory automatically.

### Packages: Organizing Your Code

A **package** is a namespace that groups related classes together. Packages map directly to directories on your file system. The class `com.javabank.accounts.SavingsAccount` must live in the file `com/javabank/accounts/SavingsAccount.java`.

```java
package com.javabank.accounts;

public class SavingsAccount {
    private double balance;

    public void deposit(double amount) {
        this.balance += amount;
    }
}
```

Package naming conventions follow the **reverse domain name** pattern: `com.companyname.projectname.module`. This ensures globally unique names — there will never be a collision between `com.javabank.accounts.Account` and `com.otherbank.accounts.Account`.

Every `.java` file should declare its package on the very first line. If you omit the package declaration, the class goes into the "default package," which is fine for quick experiments but never acceptable in production code.

### Import Statements

When you need a class from another package, you **import** it:

```java
import com.javabank.accounts.SavingsAccount;     // Import a specific class
import com.javabank.accounts.*;                    // Import all classes in a package
import static java.lang.Math.round;               // Static import — use round() directly
```

A specific import (`import com.javabank.accounts.SavingsAccount`) is preferred over a wildcard import (`import com.javabank.accounts.*`) because it makes your dependencies explicit. When reading code, you can immediately see which classes are used.

Classes in `java.lang` (like `String`, `System`, `Math`) are imported automatically — you never need to write `import java.lang.String`.

### The Classpath: How the JVM Finds Classes

The **classpath** tells the JVM where to look for compiled classes and libraries. When you run `java com.javabank.app.Main`, the JVM searches the classpath for a file matching `com/javabank/app/Main.class`.

```bash
# Set classpath when compiling
javac -cp lib/gson.jar -d bin src/com/javabank/app/Main.java

# Set classpath when running
java -cp bin:lib/gson.jar com.javabank.app.Main
```

The `-cp` (or `-classpath`) flag specifies directories and JAR files to search. Multiple entries are separated by `:` on macOS/Linux or `;` on Windows. If the JVM cannot find a class on the classpath, you get the dreaded `ClassNotFoundException` — one of the most common errors in Java development.

### JAR Files: Packaging and Libraries

A **JAR** (Java ARchive) file is a ZIP file containing compiled `.class` files, metadata, and resources. JARs are how Java libraries are distributed. When you use a library like Gson for JSON parsing or JDBC drivers for database access, you download a `.jar` file and add it to your classpath.

```bash
# Create a JAR from compiled classes
jar cf myapp.jar -C bin .

# Run a JAR with a main class
java -jar myapp.jar
```

In modern Java development, build tools like **Maven** and **Gradle** manage JAR dependencies automatically. You declare what you need in a configuration file, and the build tool downloads the correct versions. In banking, this dependency management is critical — you need to know exactly which version of every library is in production for security audits and compliance.

## Why It Matters

In professional banking software, you will never write a single-file program. Real applications have hundreds of classes across dozens of packages, depend on external libraries managed through build tools, and must compile and run consistently across every developer's machine and every deployment environment. Understanding packages prevents naming conflicts when multiple teams work on the same codebase. Understanding the classpath prevents the runtime errors that block deployments. These are not optional concepts — they are the organizational foundation of every Java project you will ever work on.

## Challenge

Create a program in the `com.javabank.app` package that prints a welcome message. In a real project, this file would live at `src/com/javabank/app/BankApp.java`. Since the simulator runs in a simplified environment, focus on writing the correct package declaration and class structure.

## Starter Code

```java
// TODO: Declare the package com.javabank.app

public class BankApp {
    public static void main(String[] args) {
        // TODO: Print "Welcome to JavaBank Application"
    }
}
```

## Expected Output

```
Welcome to JavaBank Application
```

## Hint

The package declaration goes on the very first line of the file, before any import statements or class declarations. Use the syntax `package com.javabank.app;` — note the semicolon at the end. Then use `System.out.println()` to print the welcome message.

## Solution

```java
package com.javabank.app;

public class BankApp {
    public static void main(String[] args) {
        System.out.println("Welcome to JavaBank Application");
    }
}
```
