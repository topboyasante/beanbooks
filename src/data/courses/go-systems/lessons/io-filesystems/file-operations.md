---
id: "go-file-operations"
courseId: "go-systems"
moduleId: "io-filesystems"
title: "File Operations"
description: "Read, write, and manage files and directories for building persistent storage systems."
order: 3
---

## Scenario

You're building a simple key-value database. Before you write a B-tree or hash table, you need something more fundamental: a write-ahead log (WAL). Every database operation — SET, DELETE — gets appended to a file on disk before it's applied in memory. If the process crashes, you replay the WAL to recover the state. This is how PostgreSQL, SQLite, and every serious database ensures durability.

Building a WAL means mastering file operations: creating files, appending data, reading line-by-line, checking if files exist, and handling permissions. These are the primitives that every storage system is built on.

## Content

## File Operations

Go's `os` package provides low-level file operations, while `filepath` handles path manipulation. Together they give you everything needed to build persistent storage.

### Opening and Reading Files

`os.Open` opens a file for reading:

```go
file, err := os.Open("data.log")
if err != nil {
    if os.IsNotExist(err) {
        fmt.Println("file does not exist")
        return
    }
    log.Fatalf("failed to open: %v", err)
}
defer file.Close()

// Read the entire file
data, err := io.ReadAll(file)
if err != nil {
    log.Fatalf("failed to read: %v", err)
}
fmt.Println(string(data))
```

`os.Open` is read-only. For writing, you need `os.Create` or `os.OpenFile`.

### Creating and Writing Files

`os.Create` creates a file (or truncates it if it exists):

```go
file, err := os.Create("wal.log")
if err != nil {
    log.Fatalf("failed to create: %v", err)
}
defer file.Close()

// Write operations to the WAL
file.WriteString("SET user:1 alice\n")
file.WriteString("SET user:2 bob\n")
file.WriteString("DEL user:1\n")
```

Warning: `os.Create` truncates existing files. If you want to append, use `os.OpenFile`.

### Appending to Files

For a WAL, you append — never overwrite:

```go
file, err := os.OpenFile("wal.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
if err != nil {
    log.Fatalf("failed to open: %v", err)
}
defer file.Close()

entry := fmt.Sprintf("SET user:3 charlie\n")
_, err = file.WriteString(entry)
if err != nil {
    log.Fatalf("failed to write: %v", err)
}
```

The flags: `O_APPEND` positions writes at the end, `O_CREATE` creates the file if missing, `O_WRONLY` opens for writing only. The `0644` is the Unix permission (owner read/write, group and others read-only).

### File Metadata with os.Stat

Check if a file exists, get its size, or check modification time:

```go
info, err := os.Stat("wal.log")
if err != nil {
    if os.IsNotExist(err) {
        fmt.Println("WAL does not exist — fresh start")
        return
    }
    log.Fatalf("stat failed: %v", err)
}

fmt.Printf("file: %s\n", info.Name())
fmt.Printf("size: %d bytes\n", info.Size())
fmt.Printf("modified: %s\n", info.ModTime())
fmt.Printf("is directory: %t\n", info.IsDir())
fmt.Printf("permissions: %s\n", info.Mode())
```

### Reading Files Line by Line

For replaying a WAL, read line by line with `bufio.Scanner`:

```go
func replayWAL(filename string) (map[string]string, error) {
    file, err := os.Open(filename)
    if err != nil {
        return nil, err
    }
    defer file.Close()

    store := make(map[string]string)
    scanner := bufio.NewScanner(file)

    for scanner.Scan() {
        line := scanner.Text()
        parts := strings.SplitN(line, " ", 3)

        switch parts[0] {
        case "SET":
            if len(parts) == 3 {
                store[parts[1]] = parts[2]
                fmt.Printf("replayed: SET %s = %s\n", parts[1], parts[2])
            }
        case "DEL":
            if len(parts) >= 2 {
                delete(store, parts[1])
                fmt.Printf("replayed: DEL %s\n", parts[1])
            }
        }
    }

    return store, scanner.Err()
}
```

### Walking Directory Trees

`filepath.Walk` traverses a directory tree recursively:

```go
err := filepath.Walk("./data", func(path string, info os.FileInfo, err error) error {
    if err != nil {
        return err
    }

    if info.IsDir() {
        fmt.Printf("DIR:  %s\n", path)
    } else {
        fmt.Printf("FILE: %s (%d bytes)\n", path, info.Size())
    }
    return nil
})
if err != nil {
    log.Fatalf("walk failed: %v", err)
}
```

For newer Go code, prefer `filepath.WalkDir` which is more efficient — it doesn't call `os.Stat` on every entry unless you need the `FileInfo`.

### File Permissions

Unix permissions matter in production. Creating files with the wrong permissions is a security vulnerability:

```go
// Sensitive file — owner read/write only
err := os.WriteFile("secret.key", keyData, 0600)

// Log file — owner read/write, group/others read
err = os.WriteFile("app.log", logData, 0644)

// Executable script — owner all, group/others read+execute
err = os.WriteFile("start.sh", scriptData, 0755)

// Create a directory with permissions
err = os.MkdirAll("data/wal", 0755)
```

## Why It Matters

Every persistent system — databases, message queues, configuration stores, log aggregators — is built on file operations. The WAL pattern you learn here is the same one used by PostgreSQL, MySQL, etcd, and CockroachDB. Understanding how to safely append to files, handle missing files, and manage permissions is the foundation of building systems that survive crashes and restarts. When your tunnel needs to persist configuration or log traffic to disk, these are the primitives you'll reach for.

## Questions

Q: What is the difference between os.Create and os.OpenFile with O_APPEND?
A) os.Create appends, os.OpenFile truncates
B) os.Create truncates existing files, os.OpenFile with O_APPEND adds to the end
C) They are identical
D) os.Create only works with new files
Correct: B

Q: What does the permission 0644 mean?
A) Owner: read/write/execute, Group: read, Others: read
B) Owner: read/write, Group: read, Others: read
C) Everyone: read/write
D) Owner: read only, Group: read/write, Others: read/write
Correct: B

Q: Why is a write-ahead log (WAL) important for databases?
A) It makes reads faster
B) It compresses data on disk
C) It ensures operations are persisted to disk before being applied, enabling crash recovery
D) It encrypts data at rest
Correct: C

## Challenge

Build a simple WAL-backed key-value store. Write 3 SET operations to a WAL file, then read the WAL back and reconstruct the store. Print the final state.

## Starter Code

```go
package main

import (
    "bufio"
    "fmt"
    "log"
    "os"
    "strings"
)

func main() {
    walFile := "/tmp/beanbooks-wal.log"

    // Write 3 SET operations to the WAL file

    // Read the WAL and reconstruct the store

    // Print the final store contents
}
```

## Expected Output

```
writing WAL entries...
replaying WAL...
replayed: SET name = alice
replayed: SET role = engineer
replayed: SET team = platform
final store:
  name = alice
  role = engineer
  team = platform
```

## Hint

Use `os.Create` to write the WAL with lines like `SET name alice`. Then use `os.Open` with `bufio.NewScanner` to read it back line by line. Split each line with `strings.SplitN(line, " ", 3)` to get the operation, key, and value.

## Solution

```go
package main

import (
    "bufio"
    "fmt"
    "log"
    "os"
    "strings"
)

func main() {
    walFile := "/tmp/beanbooks-wal.log"

    // Write WAL entries
    fmt.Println("writing WAL entries...")
    f, err := os.Create(walFile)
    if err != nil {
        log.Fatalf("failed to create WAL: %v", err)
    }
    f.WriteString("SET name alice\n")
    f.WriteString("SET role engineer\n")
    f.WriteString("SET team platform\n")
    f.Close()

    // Replay WAL
    fmt.Println("replaying WAL...")
    f, err = os.Open(walFile)
    if err != nil {
        log.Fatalf("failed to open WAL: %v", err)
    }
    defer f.Close()

    store := make(map[string]string)
    scanner := bufio.NewScanner(f)
    for scanner.Scan() {
        parts := strings.SplitN(scanner.Text(), " ", 3)
        if len(parts) == 3 && parts[0] == "SET" {
            store[parts[1]] = parts[2]
            fmt.Printf("replayed: SET %s = %s\n", parts[1], parts[2])
        }
    }

    fmt.Println("final store:")
    for k, v := range store {
        fmt.Printf("  %s = %s\n", k, v)
    }

    os.Remove(walFile)
}
```
