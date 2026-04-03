---
id: "git-fundamentals"
moduleId: "git-cicd"
title: "Git Fundamentals"
description: "Track changes, create branches, and merge code with Git version control."
order: 1
---

## Banking Scenario

You have just joined the backend team at **JavaBank**. On your first day, a production bug surfaces in the payment processing service. The senior developer reverts the codebase to last Tuesday's version in seconds, identifies the exact commit that introduced the bug, and patches it -- all without disrupting other developers' work. This is possible because every line of code at JavaBank is tracked with Git.

Banks are among the most heavily regulated industries in the world. Auditors can request a full history of every change made to a financial system: who changed what, when, and why. Git provides that immutable audit trail. Without version control, you would be emailing ZIP files, overwriting each other's work, and losing the ability to roll back when things go wrong.

## Content

### What Is Version Control?

Version control is a system that records changes to files over time so you can recall specific versions later. Git is a **distributed** version control system, meaning every developer has a complete copy of the project history on their local machine. In banking, this is not optional -- regulators require traceability for every code change that touches financial data.

### Initializing a Repository

Every Git project starts with `git init`. This creates a hidden `.git` directory that stores the entire history of your project.

```bash
mkdir payment-service
cd payment-service
git init
```

After making changes, you **stage** files with `git add` and save them with `git commit`:

```bash
git add TransactionProcessor.java
git commit -m "feat: add initial transaction processor"
```

### The .gitignore File

Certain files should never be committed: credentials, build artifacts, IDE settings. Banks take this seriously -- leaking a `.env` file with database passwords could be a security breach.

```bash
# .gitignore
.env
target/
.idea/
*.class
application-secrets.yml
```

### Branching

Branches let you work on features or fixes without affecting the main codebase. At JavaBank, no one commits directly to `main`.

```bash
git branch feature/overdraft-protection
git checkout -b feature/overdraft-protection
```

This creates a separate line of development. You can switch between branches freely without losing work.

### Merging

When your feature is ready, you merge it back. A **fast-forward merge** occurs when there are no diverging commits. A **3-way merge** happens when both branches have new commits and Git must reconcile them.

```bash
git checkout main
git merge feature/overdraft-protection
```

If two developers edited the same line, Git produces a **merge conflict**. You must manually resolve it by choosing which version to keep, then stage and commit the result.

### Git Stash

Sometimes you need to switch branches but have uncommitted work. `git stash` saves your changes temporarily:

```bash
git stash
git checkout hotfix/fix-rounding-error
# ... fix the bug ...
git checkout feature/overdraft-protection
git stash pop
```

### Viewing History

`git log` shows the commit history and `git diff` shows what changed. These are essential for auditing and debugging.

```bash
git log --oneline --graph
git diff HEAD~1
```

## Why It Matters

Every banking institution requires a complete, tamper-evident history of code changes for regulatory compliance and incident response. Git is the industry standard for version control, and understanding its fundamentals -- committing, branching, merging, and inspecting history -- is a non-negotiable skill for any developer working on financial systems. Mastering these basics means you can collaborate safely, recover from mistakes quickly, and satisfy auditors who need to trace every change back to its author and purpose.

## Questions

Q: Why do banks mandate version control for all application code?
A) To make deployments faster
B) To provide an audit trail of every code change for regulatory compliance
C) To reduce the number of developers needed on a team
D) To eliminate the need for code reviews
Correct: B

Q: Which of the following should be added to .gitignore in a banking application?
A) TransactionService.java
B) pom.xml
C) .env containing database credentials
D) README.md
Correct: C

Q: What happens during a 3-way merge in Git?
A) Git deletes the feature branch automatically
B) Git reconciles changes from two diverging branches and their common ancestor
C) Git always produces a merge conflict
D) Git replaces the main branch with the feature branch
Correct: B

## Challenge

Simulate a Git workflow for JavaBank's payment service. Create a class that prints out the steps a developer would take: initializing a repo, creating a .gitignore, making commits on a feature branch, and merging back to main. Print each Git command and its purpose.

## Starter Code

```java
public class GitWorkflow {
    public static void main(String[] args) {
        System.out.println("=== JavaBank Git Workflow ===\n");

        // Step 1: Initialize repository
        System.out.println("Step 1: Initialize Repository");
        // Print the git init command and what it does

        // Step 2: Create .gitignore
        System.out.println("\nStep 2: Create .gitignore");
        // Print files that should be ignored

        // Step 3: First commit
        System.out.println("\nStep 3: Initial Commit");
        // Print the add and commit commands

        // Step 4: Create a feature branch
        System.out.println("\nStep 4: Create Feature Branch");
        // Print the branch command

        // Step 5: Make changes and commit on the branch
        System.out.println("\nStep 5: Commit on Feature Branch");
        // Print add and commit

        // Step 6: Merge back to main
        System.out.println("\nStep 6: Merge to Main");
        // Print checkout and merge commands
    }
}
```

## Expected Output

```
=== JavaBank Git Workflow ===

Step 1: Initialize Repository
$ git init
Created empty Git repository for payment-service

Step 2: Create .gitignore
Ignoring: .env, target/, .idea/, *.class

Step 3: Initial Commit
$ git add PaymentService.java
$ git commit -m "feat: add payment service skeleton"
[main] 1 file changed

Step 4: Create Feature Branch
$ git checkout -b feature/overdraft-protection
Switched to new branch 'feature/overdraft-protection'

Step 5: Commit on Feature Branch
$ git add OverdraftChecker.java
$ git commit -m "feat: add overdraft protection logic"
[feature/overdraft-protection] 1 file changed

Step 6: Merge to Main
$ git checkout main
$ git merge feature/overdraft-protection
Fast-forward merge successful
```

## Hint

Use System.out.println for each line. Prefix Git commands with "$ " to distinguish them from output descriptions. Think of this as documenting the exact sequence of commands a new developer at JavaBank would follow on day one.

## Solution

```java
public class GitWorkflow {
    public static void main(String[] args) {
        System.out.println("=== JavaBank Git Workflow ===\n");

        System.out.println("Step 1: Initialize Repository");
        System.out.println("$ git init");
        System.out.println("Created empty Git repository for payment-service");

        System.out.println("\nStep 2: Create .gitignore");
        System.out.println("Ignoring: .env, target/, .idea/, *.class");

        System.out.println("\nStep 3: Initial Commit");
        System.out.println("$ git add PaymentService.java");
        System.out.println("$ git commit -m \"feat: add payment service skeleton\"");
        System.out.println("[main] 1 file changed");

        System.out.println("\nStep 4: Create Feature Branch");
        System.out.println("$ git checkout -b feature/overdraft-protection");
        System.out.println("Switched to new branch 'feature/overdraft-protection'");

        System.out.println("\nStep 5: Commit on Feature Branch");
        System.out.println("$ git add OverdraftChecker.java");
        System.out.println("$ git commit -m \"feat: add overdraft protection logic\"");
        System.out.println("[feature/overdraft-protection] 1 file changed");

        System.out.println("\nStep 6: Merge to Main");
        System.out.println("$ git checkout main");
        System.out.println("$ git merge feature/overdraft-protection");
        System.out.println("Fast-forward merge successful");
    }
}
```
