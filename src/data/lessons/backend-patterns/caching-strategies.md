---
id: "caching-strategies"
moduleId: "backend-patterns"
title: "Caching Strategies"
description: "Speed up banking applications with caching patterns, TTL, and cache invalidation."
order: 4
---

## Banking Scenario

When thousands of customers check their account balance every second, hitting the database each time is wasteful and slow. Banks use caching layers to serve frequent reads from memory. But caching financial data requires careful invalidation -- showing a stale balance after a transfer is unacceptable.

A well-designed caching strategy can reduce database load by 90% and cut response times from hundreds of milliseconds to single digits. However, the wrong strategy can show customers incorrect balances, leak stale data across accounts, or crash your system with a cache stampede. Understanding caching patterns is about knowing which tradeoffs are acceptable for each use case.

## Content

### Why Cache

Caching stores frequently accessed data in a faster storage layer (typically memory) to avoid expensive operations. The benefits are significant:

- **Latency reduction**: Memory access is microseconds; database queries are milliseconds. For user-facing requests, this is the difference between a snappy app and a sluggish one.
- **Database load reduction**: If 10,000 users check the same exchange rate, the database should answer once, not 10,000 times.
- **Cost savings**: Fewer database queries means smaller database instances and lower cloud bills.

```java
// Without cache: every call hits the database
// getExchangeRate("USD", "EUR") -> DB query (15ms)

// With cache: first call hits DB, next 999 come from memory
// getExchangeRate("USD", "EUR") -> cache hit (0.1ms)
```

### Cache-Aside (Lazy Loading)

The most common pattern. The application checks the cache first. On a miss, it loads from the database and stores the result in the cache:

```java
public Account getAccount(String accountId) {
    Account cached = cache.get(accountId);
    if (cached != null) {
        System.out.println("Cache HIT for " + accountId);
        return cached;
    }
    System.out.println("Cache MISS for " + accountId);
    Account account = database.findById(accountId);
    cache.put(accountId, account);
    return account;
}
```

Advantages: only requested data is cached, and the cache naturally fills with popular data. Disadvantage: the first request for each item is always slow (cache miss).

### Write-Through

When data is updated, the application writes to both the cache and the database simultaneously:

```java
public void updateBalance(String accountId, long newBalance) {
    database.updateBalance(accountId, newBalance);
    cache.put(accountId, new Account(accountId, newBalance));
    System.out.println("Updated DB and cache for " + accountId);
}
```

This guarantees the cache is always consistent with the database. The tradeoff is that every write incurs cache overhead, even for data that may never be read again.

### Write-Behind (Write-Back)

The application writes to the cache immediately and asynchronously flushes changes to the database later. This gives the fastest write performance but risks data loss if the cache crashes before flushing:

```java
// Conceptual write-behind
cache.put(accountId, updatedAccount); // Instant return
// Background thread periodically writes dirty entries to DB
```

Banks rarely use write-behind for financial data because durability is critical. However, it works well for non-critical data like login timestamps or analytics counters.

### TTL (Time To Live)

Every cached entry should have an expiration time. TTL balances freshness and performance:

```java
// Exchange rates: cache for 5 minutes (changes infrequently)
cache.put("USD_EUR_RATE", rate, Duration.ofMinutes(5));

// Account balance: cache for 30 seconds (must be fresh)
cache.put("balance:" + accountId, balance, Duration.ofSeconds(30));

// Customer profile: cache for 1 hour (rarely changes)
cache.put("profile:" + customerId, profile, Duration.ofHours(1));
```

Short TTL means fresher data but more cache misses. Long TTL means better performance but staler data. Choose based on how critical freshness is for each data type.

### Cache Invalidation

Phil Karlton famously said there are only two hard things in computer science: cache invalidation and naming things. Common approaches:

- **Event-driven invalidation**: When an account balance changes, explicitly remove it from cache. Most precise, but requires discipline.
- **Cache stampede prevention**: When a popular entry expires, hundreds of threads rush to rebuild it. Solutions include locking (only one thread rebuilds) or pre-refreshing entries before they expire.

```java
public void onTransferCompleted(TransferEvent event) {
    cache.evict("balance:" + event.getFromAccountId());
    cache.evict("balance:" + event.getToAccountId());
    System.out.println("Invalidated cache for both accounts");
}
```

### Spring Cache and Redis

Spring provides a clean cache abstraction with annotations:

```java
@Cacheable("accounts")       // Cache the result, return cached on next call
public Account findById(String id) { ... }

@CacheEvict("accounts")      // Remove from cache when called
public void deleteAccount(String id) { ... }

@CachePut("accounts")        // Always execute and update cache
public Account updateAccount(Account account) { ... }
```

**Redis** is the industry-standard cache for banking applications. It is an in-memory data store supporting strings, hashes, lists, sets, and sorted sets. Banks use Redis for session storage, rate limiting, leaderboards, and distributed locking. Its pub/sub feature enables cache invalidation across multiple application instances.

## Why It Matters

Caching is one of the highest-impact performance optimizations in backend engineering. A well-implemented cache can make the difference between a system that handles 100 requests per second and one that handles 10,000. In banking, you must also navigate the tension between performance and correctness -- financial data demands strong consistency guarantees that conflict with aggressive caching. Knowing which pattern to apply and when is a core backend engineering skill.

## Challenge

Implement a simple in-memory cache with TTL support for account lookups. Demonstrate cache hits, cache misses, and TTL expiration.

## Starter Code

```java
import java.util.HashMap;
import java.util.Map;

public class CachingStrategies {

    // TODO: Create a SimpleCache class with:
    // - A HashMap to store cached values
    // - A HashMap to store expiration times (System.currentTimeMillis() + ttlMs)
    // - get(key): return value if present and not expired, else null
    // - put(key, value, ttlMs): store value with expiration time

    public static void main(String[] args) throws InterruptedException {
        System.out.println("=== Banking Cache Simulation ===\n");

        // TODO: Create a cache and simulate account lookups
        // 1. Look up account "ACC-001" -> cache miss, "load from DB"
        // 2. Look up account "ACC-001" again -> cache hit
        // 3. Look up account "ACC-002" -> cache miss
        // 4. Wait for TTL to expire
        // 5. Look up account "ACC-001" again -> cache miss (expired)
    }
}
```

## Expected Output

```
=== Banking Cache Simulation ===

Looking up account ACC-001...
  Cache MISS - Loading from database...
  Loaded: Account{id=ACC-001, holder=Alice, balance=$15000}
  Stored in cache with TTL=2000ms

Looking up account ACC-001...
  Cache HIT
  Retrieved: Account{id=ACC-001, holder=Alice, balance=$15000}

Looking up account ACC-002...
  Cache MISS - Loading from database...
  Loaded: Account{id=ACC-002, holder=Bob, balance=$8500}
  Stored in cache with TTL=2000ms

Waiting 3 seconds for TTL expiration...

Looking up account ACC-001...
  Cache MISS (expired) - Loading from database...
  Loaded: Account{id=ACC-001, holder=Alice, balance=$15000}
  Stored in cache with TTL=2000ms

Cache stats: 3 misses, 1 hit
```

## Hint

For the TTL, store `System.currentTimeMillis() + ttlMs` as the expiration timestamp. In the `get` method, compare the current time to the stored expiration time. If it has passed, remove the entry and return null. Use two `HashMap` instances: one for data and one for expiration times.

## Solution

```java
import java.util.HashMap;
import java.util.Map;

public class CachingStrategies {

    static class SimpleCache {
        private Map<String, String> data = new HashMap<>();
        private Map<String, Long> expirations = new HashMap<>();

        public String get(String key) {
            if (!data.containsKey(key)) {
                return null;
            }
            if (System.currentTimeMillis() > expirations.get(key)) {
                data.remove(key);
                expirations.remove(key);
                return null;
            }
            return data.get(key);
        }

        public void put(String key, String value, long ttlMs) {
            data.put(key, value);
            expirations.put(key, System.currentTimeMillis() + ttlMs);
        }
    }

    static int hits = 0;
    static int misses = 0;

    static String lookupAccount(SimpleCache cache, String accountId, String holder, int balance, long ttlMs) {
        System.out.println("Looking up account " + accountId + "...");
        String cached = cache.get(accountId);
        if (cached != null) {
            hits++;
            System.out.println("  Cache HIT");
            System.out.println("  Retrieved: " + cached);
            return cached;
        }
        misses++;
        System.out.println("  Cache MISS - Loading from database...");
        String account = "Account{id=" + accountId + ", holder=" + holder + ", balance=$" + balance + "}";
        System.out.println("  Loaded: " + account);
        cache.put(accountId, account, ttlMs);
        System.out.println("  Stored in cache with TTL=" + ttlMs + "ms");
        return account;
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println("=== Banking Cache Simulation ===\n");

        SimpleCache cache = new SimpleCache();
        long ttl = 2000;

        lookupAccount(cache, "ACC-001", "Alice", 15000, ttl);
        System.out.println();
        lookupAccount(cache, "ACC-001", "Alice", 15000, ttl);
        System.out.println();
        lookupAccount(cache, "ACC-002", "Bob", 8500, ttl);

        System.out.println("\nWaiting 3 seconds for TTL expiration...\n");
        Thread.sleep(3000);

        lookupAccount(cache, "ACC-001", "Alice", 15000, ttl);

        System.out.println("\nCache stats: " + misses + " misses, " + hits + " hit");
    }
}
```
