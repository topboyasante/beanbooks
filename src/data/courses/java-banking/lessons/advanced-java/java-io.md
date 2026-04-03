---
id: "java-io"
moduleId: "advanced-java"
title: "Java I/O"
description: "Read and write files using Java's I/O and NIO APIs for statement generation."
order: 6
---

## Banking Scenario

Every month, your bank generates millions of account statements -- PDF files, CSV exports, and transaction reports that must be written to disk, archived, and made available for download. When a customer disputes a charge, the system must read through historical transaction logs stored in files. When regulatory audits occur, the compliance team needs to export filtered data to specific file formats.

File I/O is the bridge between your application's in-memory data and persistent storage. Java provides two major I/O systems: the classic `java.io` package and the newer `java.nio` (New I/O) package. Understanding both is essential, as banking codebases contain a mix of legacy and modern file handling code.

## Content

### Byte Streams vs Character Streams

Java's classic I/O divides streams into two categories based on what they handle:

**Byte streams** (`InputStream`/`OutputStream`) handle raw binary data -- images, serialized objects, encrypted files. They read and write one byte at a time.

**Character streams** (`Reader`/`Writer`) handle text data with proper character encoding. They read and write characters, automatically handling encoding conversions (UTF-8, UTF-16, etc.).

```java
import java.io.*;

// Byte stream -- for binary data (rarely used for text)
// InputStream, OutputStream, FileInputStream, FileOutputStream

// Character stream -- for text data (banking statements, CSV files)
// Reader, Writer, FileReader, FileWriter

// Rule of thumb:
// Text files (CSV, JSON, XML, statements) -> Character streams (Reader/Writer)
// Binary files (images, serialized objects) -> Byte streams (InputStream/OutputStream)
```

For banking, you will almost always work with character streams since statements, reports, and logs are text-based.

### BufferedReader and BufferedWriter

Unbuffered streams perform a system call for every read or write operation, which is extremely slow. Buffered streams collect data into an internal buffer and perform I/O in larger chunks, dramatically improving performance.

```java
import java.io.*;

// Writing a transaction log
try (BufferedWriter writer = new BufferedWriter(new FileWriter("transactions.txt"))) {
    writer.write("2026-04-01, Deposit, $500.00");
    writer.newLine();
    writer.write("2026-04-01, Withdrawal, $200.00");
    writer.newLine();
    writer.write("2026-04-01, Transfer, $1000.00");
    writer.newLine();
}

// Reading the transaction log
try (BufferedReader reader = new BufferedReader(new FileReader("transactions.txt"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        System.out.println(line);
    }
}
```

`BufferedReader.readLine()` is the workhorse of text file processing. It reads a complete line and returns `null` at end-of-file, making it perfect for the `while` loop pattern shown above.

### Try-With-Resources for I/O

File handles are limited system resources. Failing to close them causes resource leaks that can crash a banking application during peak hours. `try-with-resources` guarantees cleanup.

```java
import java.io.*;

// Multiple resources -- all automatically closed in reverse order
try (
    FileReader fileReader = new FileReader("accounts.csv");
    BufferedReader bufferedReader = new BufferedReader(fileReader)
) {
    String header = bufferedReader.readLine();
    System.out.println("Header: " + header);
} catch (FileNotFoundException e) {
    System.out.println("Account file not found: " + e.getMessage());
} catch (IOException e) {
    System.out.println("Error reading file: " + e.getMessage());
}
// Both fileReader and bufferedReader are closed automatically
```

Any class implementing `AutoCloseable` (which includes `Closeable`) can be used in try-with-resources. This includes file streams, database connections, and network sockets.

### Java NIO -- Path and Files

Java NIO (`java.nio.file`) was introduced as a modern replacement for many classic I/O operations. The two central classes are `Path` (representing a file location) and `Files` (utility methods for file operations).

```java
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.Files;
import java.io.IOException;
import java.util.List;

// Creating Path objects
Path statementPath = Paths.get("statements", "april-2026.txt");
Path homePath = Path.of(System.getProperty("user.home"), "bank-data");

// Checking file properties
System.out.println("Exists: " + Files.exists(statementPath));
System.out.println("Is directory: " + Files.isDirectory(statementPath));
System.out.println("File size: " + Files.size(statementPath));
```

### Files Utility Methods

The `Files` class provides convenient one-liner methods that replace dozens of lines of classic I/O code:

```java
import java.nio.file.*;
import java.io.IOException;
import java.util.List;

Path path = Path.of("statement.txt");

// Write all lines at once
List<String> lines = List.of(
    "Account: ACC-1001",
    "Date: 2026-04-01",
    "Balance: $15,000.00"
);
Files.write(path, lines);

// Read all lines at once
List<String> readLines = Files.readAllLines(path);
readLines.forEach(System.out::println);

// Read entire file as a single string (Java 11+)
String content = Files.readString(path);

// Write a string directly (Java 11+)
Files.writeString(Path.of("quick.txt"), "Fast write!");

// Copy and move files
Files.copy(path, Path.of("backup-statement.txt"), StandardCopyOption.REPLACE_EXISTING);
Files.move(Path.of("temp.txt"), Path.of("final.txt"), StandardCopyOption.ATOMIC_MOVE);

// Delete
Files.deleteIfExists(Path.of("temp.txt"));
```

### Serialization Basics

Serialization converts a Java object into a byte stream that can be stored in a file or sent over a network. The object's class must implement the `Serializable` marker interface.

```java
import java.io.*;

class AccountRecord implements Serializable {
    private static final long serialVersionUID = 1L;
    private String accountId;
    private double balance;

    public AccountRecord(String accountId, double balance) {
        this.accountId = accountId;
        this.balance = balance;
    }

    @Override
    public String toString() {
        return accountId + ": $" + balance;
    }
}

// Serialize (write object to file)
AccountRecord account = new AccountRecord("ACC-1001", 15000.0);
try (ObjectOutputStream oos = new ObjectOutputStream(
        new FileOutputStream("account.dat"))) {
    oos.writeObject(account);
}

// Deserialize (read object from file)
try (ObjectInputStream ois = new ObjectInputStream(
        new FileInputStream("account.dat"))) {
    AccountRecord loaded = (AccountRecord) ois.readObject();
    System.out.println(loaded); // ACC-1001: $15000.0
}
```

**Important:** Always declare `serialVersionUID` to maintain compatibility across class changes. In modern banking applications, JSON or Protocol Buffers are often preferred over Java serialization for data exchange, but serialization still appears in caching, session persistence, and legacy systems.

### When to Use Classic I/O vs NIO

| Task | Use | Why |
|------|-----|-----|
| Read/write entire small files | `Files.readAllLines()` / `Files.write()` | One-liner convenience |
| Process large files line by line | `BufferedReader` | Memory efficient |
| Check file existence, size, attributes | `Files.exists()`, `Files.size()` | Clean API |
| File copy, move, delete | `Files.copy()`, `Files.move()` | Atomic operations |
| Complex stream processing | Classic `InputStream`/`OutputStream` | Fine-grained control |
| Working with directories | `Files.list()`, `Files.walk()` | Stream-based directory traversal |

## Why It Matters

Every banking system reads and writes files -- transaction logs, customer statements, regulatory reports, configuration files, and data exports. Interviewers expect you to know both classic I/O and NIO, understand when to use each, and always close resources properly. A resource leak that goes unnoticed in development can bring down a production server handling thousands of concurrent statement generations.

## Challenge

Write a program that builds a bank statement as a string (simulating file output without requiring actual file I/O). Include a header with the account number and date, three transaction lines, and a footer with the total balance. Print the complete statement.

## Starter Code
```java
public class StatementGenerator {
    public static void main(String[] args) {
        // Build a bank statement string using StringBuilder

        // Header: account number and date

        // Separator line

        // Three transactions (date, description, amount)

        // Separator line

        // Footer: total balance

        // Print the complete statement
    }
}
```

## Expected Output
```
========================================
  NATIONAL BANK - Account Statement
  Account: ACC-1001
  Date: 2026-04-01
========================================
  2026-03-05  Salary Deposit    +$3500.00
  2026-03-12  Rent Payment      -$1200.00
  2026-03-20  Grocery Purchase  -$150.00
========================================
  Total Balance: $2150.00
========================================
```

## Hint

Use `StringBuilder` to efficiently build the multi-line string. Call `append()` for each line followed by `append("\n")` for newlines. Use `String.format()` or manual padding for alignment. At the end, print the entire `StringBuilder` with a single `System.out.println()` or `System.out.print()`.

## Solution
```java
public class StatementGenerator {
    public static void main(String[] args) {
        StringBuilder statement = new StringBuilder();
        String separator = "========================================";

        statement.append(separator).append("\n");
        statement.append("  NATIONAL BANK - Account Statement\n");
        statement.append("  Account: ACC-1001\n");
        statement.append("  Date: 2026-04-01\n");
        statement.append(separator).append("\n");

        double deposit = 3500.00;
        double rent = 1200.00;
        double grocery = 150.00;

        statement.append(String.format("  2026-03-05  Salary Deposit    +$%.2f%n", deposit));
        statement.append(String.format("  2026-03-12  Rent Payment      -$%.2f%n", rent));
        statement.append(String.format("  2026-03-20  Grocery Purchase  -$%.2f%n", grocery));

        statement.append(separator).append("\n");

        double total = deposit - rent - grocery;
        statement.append(String.format("  Total Balance: $%.2f%n", total));
        statement.append(separator);

        System.out.println(statement);
    }
}
```
