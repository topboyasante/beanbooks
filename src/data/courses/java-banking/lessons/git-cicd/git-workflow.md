---
id: "git-workflow"
moduleId: "git-cicd"
title: "Git Workflow"
description: "Collaborate with feature branches, pull requests, and code review practices."
order: 2
---

## Banking Scenario

JavaBank's payment team has grown from 3 to 12 developers. Last week, two engineers pushed conflicting changes to the transaction service on the same day, and a subtle bug slipped into production that miscalculated foreign exchange fees. The post-mortem revealed the root cause: there was no formal process for how code moves from a developer's machine to production. The team lead has asked you to help establish a proper Git workflow with feature branches, pull requests, and mandatory code reviews.

In regulated banking environments, every line of code that handles money must be reviewed by at least one other developer before it reaches production. This is not just good practice -- it is a compliance requirement. A well-defined Git workflow is the backbone of safe, auditable software delivery.

## Content

### Feature Branch Workflow

The feature branch workflow is the most common collaboration model for banking teams. The rule is simple: **never commit directly to `main`**. Every change starts on a dedicated branch, goes through review, and only merges after approval.

```bash
git checkout main
git pull origin main
git checkout -b feature/wire-transfer-limits
# ... write code, commit ...
git push -u origin feature/wire-transfer-limits
# Open a Pull Request on GitHub
```

### Branch Naming Conventions

Consistent naming makes it easy to understand what each branch does at a glance. Most banking teams follow a prefix convention:

```bash
feature/add-transaction-history    # new functionality
bugfix/fix-balance-rounding        # fixing a defect
hotfix/patch-auth-vulnerability    # urgent production fix
release/v2.3.0                     # release preparation
```

### Writing Good Commit Messages

Conventional commits give structure to your project history. Auditors and fellow developers can scan the log and immediately understand what changed.

```bash
feat: add daily withdrawal limit enforcement
fix: correct rounding error in interest calculation
docs: update API documentation for /transfers endpoint
refactor: extract validation logic into shared utility
test: add integration tests for overdraft scenarios
```

A good commit message answers **why** the change was made, not just what changed. The body can include ticket numbers and context for reviewers.

### Pull Request Best Practices

A pull request (PR) is your formal request to merge code. At JavaBank, every PR must include:

- **Description**: What does this change do and why?
- **Ticket reference**: Link to the Jira or issue tracker item
- **Testing notes**: How was this tested? What should reviewers verify?
- **Small, focused scope**: PRs over 400 lines are hard to review and more likely to contain bugs

```bash
## What
Add daily withdrawal limit of $5,000 for standard accounts.

## Why
Regulatory requirement from compliance team (TICKET-1234).

## Testing
- Unit tests added for limit enforcement
- Integration test with mock account service
```

### Code Review Practices

Reviewers at JavaBank look for: correctness, security vulnerabilities, proper error handling, test coverage, and adherence to coding standards. When receiving feedback, respond professionally -- explain your reasoning or accept the suggestion and update the code. Never take review comments personally; they protect the entire team.

### Trunk-Based Development vs GitFlow

**GitFlow** uses long-lived branches (`develop`, `release`, `main`) and is common in organizations with scheduled releases. **Trunk-based development** uses short-lived feature branches that merge to `main` frequently, often multiple times per day. Many modern banking teams prefer trunk-based development with feature flags, as it reduces merge conflicts and enables continuous delivery.

### Protecting the Main Branch

Branch protection rules prevent accidental or unauthorized merges. At JavaBank, the `main` branch requires:

```bash
# GitHub branch protection settings:
# - Require pull request reviews (minimum 1 approver)
# - Require status checks to pass (CI pipeline)
# - Require branches to be up to date before merging
# - Do not allow force pushes
# - Do not allow deletions
```

These rules ensure that no code reaches production without passing automated tests and human review.

## Why It Matters

A disciplined Git workflow is the difference between a team that ships confidently and one that dreads every deployment. In banking, the stakes are higher than most industries -- a bad merge can misroute funds, expose customer data, or violate regulations. Feature branches, pull requests, and code reviews create layers of protection that catch mistakes before they reach customers. Mastering these collaboration practices is essential for any developer building financial software at scale.

## Questions

Q: In a feature branch workflow, when should a developer commit directly to the main branch?
A) When the change is small
B) When no other developers are working
C) Never -- all changes go through feature branches and pull requests
D) Only on weekends when traffic is low
Correct: C

Q: Which commit message follows conventional commit standards?
A) "updated stuff"
B) "fix: correct currency conversion rounding for JPY transactions"
C) "Fixed the bug John found"
D) "WIP - do not merge"
Correct: B

Q: What is the primary advantage of trunk-based development over GitFlow?
A) It eliminates the need for code reviews
B) It uses fewer branches, reducing merge conflicts and enabling faster delivery
C) It does not require any automated testing
D) It allows direct pushes to production without CI
Correct: B

## Challenge

Simulate the pull request lifecycle at JavaBank. Create a class that models the stages a code change goes through: creating a branch, making commits, opening a PR, receiving review feedback, making revisions, getting approval, and merging. Print each stage with a description.

## Starter Code

```java
public class PullRequestLifecycle {
    public static void main(String[] args) {
        System.out.println("=== JavaBank Pull Request Lifecycle ===\n");

        // Stage 1: Create feature branch
        // Print branch creation with naming convention

        // Stage 2: Make commits with conventional messages
        // Print 2-3 commits

        // Stage 3: Push and open PR
        // Print push command and PR details

        // Stage 4: Code review feedback
        // Print reviewer comments

        // Stage 5: Address feedback
        // Print revision commit

        // Stage 6: Approval and merge
        // Print approval and merge
    }
}
```

## Expected Output

```
=== JavaBank Pull Request Lifecycle ===

Stage 1: Create Feature Branch
$ git checkout -b feature/daily-transfer-limit
Branch naming: feature/ prefix for new functionality

Stage 2: Make Commits
$ git commit -m "feat: add TransferLimitService"
$ git commit -m "test: add unit tests for daily limit enforcement"
$ git commit -m "docs: update transfer API documentation"

Stage 3: Push and Open Pull Request
$ git push -u origin feature/daily-transfer-limit
PR #42 opened: "Add daily transfer limit enforcement"
Description: Enforces $5,000 daily limit per TICKET-1234

Stage 4: Code Review Feedback
Reviewer @sarah: "Add null check for account parameter"
Reviewer @sarah: "Consider edge case: limit reset at midnight UTC"

Stage 5: Address Feedback
$ git commit -m "fix: add null check and midnight UTC reset logic"
$ git push origin feature/daily-transfer-limit
Responded to review: "Good catch -- added both fixes"

Stage 6: Approval and Merge
Reviewer @sarah approved PR #42
CI pipeline: All checks passed (tests, coverage, security scan)
$ git merge --no-ff feature/daily-transfer-limit
Merged to main successfully
```

## Hint

Think of each stage as a step in a real-world process. Use System.out.println to print both the Git commands (prefixed with "$ ") and the descriptions. The key message is that code never reaches main without going through review and automated checks.

## Solution

```java
public class PullRequestLifecycle {
    public static void main(String[] args) {
        System.out.println("=== JavaBank Pull Request Lifecycle ===\n");

        System.out.println("Stage 1: Create Feature Branch");
        System.out.println("$ git checkout -b feature/daily-transfer-limit");
        System.out.println("Branch naming: feature/ prefix for new functionality");

        System.out.println("\nStage 2: Make Commits");
        System.out.println("$ git commit -m \"feat: add TransferLimitService\"");
        System.out.println("$ git commit -m \"test: add unit tests for daily limit enforcement\"");
        System.out.println("$ git commit -m \"docs: update transfer API documentation\"");

        System.out.println("\nStage 3: Push and Open Pull Request");
        System.out.println("$ git push -u origin feature/daily-transfer-limit");
        System.out.println("PR #42 opened: \"Add daily transfer limit enforcement\"");
        System.out.println("Description: Enforces $5,000 daily limit per TICKET-1234");

        System.out.println("\nStage 4: Code Review Feedback");
        System.out.println("Reviewer @sarah: \"Add null check for account parameter\"");
        System.out.println("Reviewer @sarah: \"Consider edge case: limit reset at midnight UTC\"");

        System.out.println("\nStage 5: Address Feedback");
        System.out.println("$ git commit -m \"fix: add null check and midnight UTC reset logic\"");
        System.out.println("$ git push origin feature/daily-transfer-limit");
        System.out.println("Responded to review: \"Good catch -- added both fixes\"");

        System.out.println("\nStage 6: Approval and Merge");
        System.out.println("Reviewer @sarah approved PR #42");
        System.out.println("CI pipeline: All checks passed (tests, coverage, security scan)");
        System.out.println("$ git merge --no-ff feature/daily-transfer-limit");
        System.out.println("Merged to main successfully");
    }
}
```
