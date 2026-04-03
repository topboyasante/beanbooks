---
id: "go-compaction"
courseId: "go-systems"
moduleId: "storage-engines"
title: "Compaction"
description: "Reclaim disk space and improve read performance by merging and compacting SSTables."
order: 5
---

## Scenario

Your LSM-based storage engine is accumulating SSTables on disk. Every time the memtable fills up, a new SSTable is created. Old values for updated keys still sit in older SSTables. Deleted keys leave behind tombstones that never get cleaned up. Over time, disk usage balloons and reads slow down because you must search through more and more files.

Compaction solves this. It merges multiple SSTables into fewer, larger ones, discarding old versions and tombstones along the way. This is one of the most performance-critical operations in any LSM-based database. RocksDB, LevelDB, and Cassandra all dedicate significant engineering effort to getting compaction right.

## Content

## Compaction

### Why Compaction Is Needed

Without compaction, an LSM tree degrades over time in three ways:

```go
package compaction

// Problem 1: Space amplification
// If you update key "user:1" 100 times, all 100 versions exist
// across different SSTables. Only the newest matters.

// Problem 2: Read amplification
// A read for a missing key must check every SSTable.
// With 100 SSTables, that is 100 file reads.

// Problem 3: Tombstone accumulation
// Deleted keys leave tombstones that consume space.
// Without compaction, tombstones are never reclaimed.

// Compaction addresses all three:
// - Merges SSTables, keeping only the newest version of each key
// - Reduces the number of SSTables to search
// - Removes tombstones for keys that no longer exist in any SSTable
```

### The Merge Process

Compaction is fundamentally a sorted merge. Since each SSTable is already sorted, merging them is efficient -- you walk through all inputs simultaneously, like merge sort's merge step:

```go
package compaction

import "sort"

// Entry represents a key-value pair with metadata
type Entry struct {
	Key       string
	Value     []byte
	Deleted   bool
	Timestamp int64 // newer timestamps win
}

// MergeIterator walks through multiple sorted entry lists simultaneously
type MergeIterator struct {
	sources [][]Entry
	indices []int
}

func NewMergeIterator(sources [][]Entry) *MergeIterator {
	return &MergeIterator{
		sources: sources,
		indices: make([]int, len(sources)),
	}
}

// Next returns the next entry in sorted order.
// When multiple sources have the same key, the entry from the
// source with the higher index wins (assumed to be newer).
func (mi *MergeIterator) Next() (*Entry, bool) {
	var minKey string
	minSource := -1

	// Find the smallest key across all sources
	for i, entries := range mi.sources {
		idx := mi.indices[i]
		if idx >= len(entries) {
			continue // this source is exhausted
		}
		key := entries[idx].Key
		if minSource == -1 || key < minKey {
			minKey = key
			minSource = i
		}
	}

	if minSource == -1 {
		return nil, false // all sources exhausted
	}

	// Collect all entries with this key (to find newest)
	var candidates []struct {
		entry  *Entry
		source int
	}

	for i, entries := range mi.sources {
		idx := mi.indices[i]
		if idx < len(entries) && entries[idx].Key == minKey {
			candidates = append(candidates, struct {
				entry  *Entry
				source int
			}{&entries[idx], i})
			mi.indices[i]++
		}
	}

	// Pick the entry with the newest timestamp
	best := candidates[0].entry
	for _, c := range candidates[1:] {
		if c.entry.Timestamp > best.Timestamp {
			best = c.entry
		}
	}

	return best, true
}
```

### Size-Tiered Compaction

Size-tiered compaction (STCS) groups SSTables by size and merges similarly-sized ones together. This is the simpler strategy, used by Cassandra's default compaction:

```go
package compaction

import (
	"fmt"
	"sort"
)

// SSTableMeta holds metadata about an SSTable for compaction decisions
type SSTableMeta struct {
	Path    string
	Size    int64  // bytes on disk
	Entries int
	Level   int
	MinKey  string
	MaxKey  string
}

// SizeTieredStrategy selects SSTables for compaction based on size similarity
type SizeTieredStrategy struct {
	MinThreshold int     // minimum SSTables in a bucket to trigger compaction
	BucketLow    float64 // lower bound for size ratio (e.g., 0.5)
	BucketHigh   float64 // upper bound for size ratio (e.g., 1.5)
}

func DefaultSizeTiered() *SizeTieredStrategy {
	return &SizeTieredStrategy{
		MinThreshold: 4,
		BucketLow:    0.5,
		BucketHigh:   1.5,
	}
}

// SelectForCompaction groups SSTables by size and returns a group to compact
func (s *SizeTieredStrategy) SelectForCompaction(tables []SSTableMeta) []SSTableMeta {
	if len(tables) < s.MinThreshold {
		return nil
	}

	// Sort by size
	sorted := make([]SSTableMeta, len(tables))
	copy(sorted, tables)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Size < sorted[j].Size
	})

	// Group into buckets of similar size
	buckets := s.groupBySize(sorted)

	// Find the largest bucket that meets the threshold
	var best []SSTableMeta
	for _, bucket := range buckets {
		if len(bucket) >= s.MinThreshold {
			if best == nil || len(bucket) > len(best) {
				best = bucket
			}
		}
	}

	return best
}

func (s *SizeTieredStrategy) groupBySize(tables []SSTableMeta) [][]SSTableMeta {
	var buckets [][]SSTableMeta
	used := make([]bool, len(tables))

	for i := 0; i < len(tables); i++ {
		if used[i] {
			continue
		}
		bucket := []SSTableMeta{tables[i]}
		used[i] = true
		avgSize := float64(tables[i].Size)

		for j := i + 1; j < len(tables); j++ {
			if used[j] {
				continue
			}
			ratio := float64(tables[j].Size) / avgSize
			if ratio >= s.BucketLow && ratio <= s.BucketHigh {
				bucket = append(bucket, tables[j])
				used[j] = true
				// Update running average
				avgSize = (avgSize*float64(len(bucket)-1) + float64(tables[j].Size)) / float64(len(bucket))
			}
		}
		buckets = append(buckets, bucket)
	}

	return buckets
}
```

### Leveled Compaction

Leveled compaction (LCS) organizes SSTables into levels with size limits. Level 0 contains unsorted flush output. Each subsequent level is 10x larger and contains non-overlapping SSTables. This provides better read performance at the cost of more write amplification:

```go
package compaction

import "fmt"

// LeveledStrategy organizes SSTables into levels
type LeveledStrategy struct {
	MaxLevel       int
	L0Threshold    int   // max SSTables in L0 before triggering
	LevelSizeRatio int64 // each level is this many times larger (default 10)
	BaseLevelSize  int64 // size of L1 in bytes
}

func DefaultLeveled() *LeveledStrategy {
	return &LeveledStrategy{
		MaxLevel:       7,
		L0Threshold:    4,
		LevelSizeRatio: 10,
		BaseLevelSize:  10 * 1024 * 1024, // 10 MB
	}
}

func (l *LeveledStrategy) MaxLevelSize(level int) int64 {
	if level == 0 {
		return 0 // L0 is managed by count, not size
	}
	size := l.BaseLevelSize
	for i := 1; i < level; i++ {
		size *= l.LevelSizeRatio
	}
	return size
}

// SelectForCompaction picks an SSTable to compact and the target level
func (l *LeveledStrategy) SelectForCompaction(levels [][]SSTableMeta) (source []SSTableMeta, targetLevel int) {
	// Check L0 first -- compact to L1 when too many files
	if len(levels) > 0 && len(levels[0]) >= l.L0Threshold {
		fmt.Printf("[leveled] L0 has %d tables (threshold %d), compacting to L1\n",
			len(levels[0]), l.L0Threshold)
		return levels[0], 1
	}

	// Check other levels -- compact when a level exceeds its size limit
	for level := 1; level < len(levels); level++ {
		levelSize := totalSize(levels[level])
		maxSize := l.MaxLevelSize(level)

		if levelSize > maxSize {
			fmt.Printf("[leveled] L%d size %d exceeds max %d, compacting to L%d\n",
				level, levelSize, maxSize, level+1)
			// Pick the SSTable with the oldest data or round-robin
			return levels[level][:1], level + 1
		}
	}

	return nil, 0
}

func totalSize(tables []SSTableMeta) int64 {
	var total int64
	for _, t := range tables {
		total += t.Size
	}
	return total
}
```

### Tombstone Handling

Tombstones cannot be removed during compaction unless you are certain the key does not exist in any deeper level:

```go
package compaction

import "fmt"

// CompactEntries merges entries and handles tombstones
func CompactEntries(sources [][]Entry, isBottomLevel bool) []Entry {
	iter := NewMergeIterator(sources)
	var result []Entry

	for {
		entry, ok := iter.Next()
		if !ok {
			break
		}

		if entry.Deleted {
			if isBottomLevel {
				// Safe to drop tombstone -- no deeper level can have this key
				fmt.Printf("[compact] dropping tombstone for key=%s\n", entry.Key)
				continue
			}
			// Must keep tombstone -- older versions may exist in deeper levels
			fmt.Printf("[compact] keeping tombstone for key=%s (not bottom level)\n", entry.Key)
		}

		result = append(result, *entry)
	}

	return result
}

// Example showing why tombstones must be preserved:
//
// L1: [key=foo, value="bar", ts=100]
// L2: [key=foo, value="old", ts=50]
//
// If we delete foo, a tombstone is written to L0/L1.
// If we compact L1 and drop the tombstone, the old value in L2
// would "resurface" -- reads would find the L2 entry and return "old".
```

### Compaction Scheduling

Compaction runs in the background and must not block reads or writes. A compaction scheduler manages when and how compaction happens:

```go
package compaction

import (
	"fmt"
	"sync"
	"time"
)

// CompactionScheduler runs compaction in the background
type CompactionScheduler struct {
	strategy    string // "size-tiered" or "leveled"
	interval    time.Duration
	running     bool
	mu          sync.Mutex
	stopCh      chan struct{}
	onCompact   func() error
	stats       CompactionStats
}

type CompactionStats struct {
	CompactionsRun    int
	EntriesMerged     int
	TombstonesDropped int
	BytesWritten      int64
	BytesReclaimed    int64
	TotalDuration     time.Duration
}

func NewScheduler(strategy string, interval time.Duration, compactFn func() error) *CompactionScheduler {
	return &CompactionScheduler{
		strategy:  strategy,
		interval:  interval,
		stopCh:    make(chan struct{}),
		onCompact: compactFn,
	}
}

func (cs *CompactionScheduler) Start() {
	cs.mu.Lock()
	if cs.running {
		cs.mu.Unlock()
		return
	}
	cs.running = true
	cs.mu.Unlock()

	go func() {
		ticker := time.NewTicker(cs.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				start := time.Now()
				if err := cs.onCompact(); err != nil {
					fmt.Printf("[scheduler] compaction error: %v\n", err)
					continue
				}
				duration := time.Since(start)
				cs.mu.Lock()
				cs.stats.CompactionsRun++
				cs.stats.TotalDuration += duration
				cs.mu.Unlock()
				fmt.Printf("[scheduler] compaction completed in %v\n", duration)

			case <-cs.stopCh:
				return
			}
		}
	}()

	fmt.Printf("[scheduler] started with %s strategy, interval=%v\n", cs.strategy, cs.interval)
}

func (cs *CompactionScheduler) Stop() {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	if cs.running {
		close(cs.stopCh)
		cs.running = false
	}
}

func (cs *CompactionScheduler) Stats() CompactionStats {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	return cs.stats
}
```

### Space Amplification

Space amplification measures how much extra disk space your storage engine uses compared to the actual data size:

```go
package compaction

import "fmt"

// SpaceAmplification calculates the ratio of disk usage to actual data size
func SpaceAmplification(totalDiskBytes, actualDataBytes int64) float64 {
	if actualDataBytes == 0 {
		return 0
	}
	return float64(totalDiskBytes) / float64(actualDataBytes)
}

func ExplainAmplification() {
	// Size-tiered compaction:
	//   - Space amplification: ~2x (worst case during compaction)
	//   - Write amplification: low (~0.5 * num_levels)
	//   - Read amplification: high (many SSTables to check)

	// Leveled compaction:
	//   - Space amplification: ~1.1x (much better)
	//   - Write amplification: high (~10 * num_levels)
	//   - Read amplification: low (1 SSTable per level)

	fmt.Println("Strategy       | Space Amp | Write Amp | Read Amp")
	fmt.Println("Size-tiered    | High      | Low       | High")
	fmt.Println("Leveled        | Low       | High      | Low")
	fmt.Println()
	fmt.Println("Choose size-tiered for write-heavy workloads.")
	fmt.Println("Choose leveled for read-heavy workloads with space constraints.")
}
```

## Why It Matters

Compaction is where the real engineering challenge of LSM trees lives. It determines your storage engine's disk usage, read latency, and write throughput. Every production LSM database -- RocksDB, LevelDB, Cassandra, ScyllaDB -- has spent years tuning their compaction strategies. Understanding the tradeoffs between size-tiered and leveled compaction, why tombstones cannot always be dropped, and how space amplification affects capacity planning gives you the knowledge to tune and operate these systems effectively in production.

## Questions

Q: Why can a tombstone not be dropped during compaction unless it is at the bottom level?
A) Tombstones are needed for read performance optimization
B) Dropping a tombstone could cause an older version of the key in a deeper level to resurface as if it were never deleted
C) The file system requires tombstones to maintain file integrity
D) Tombstones use no disk space so there is no benefit to dropping them
Correct: B

Q: What is the main advantage of leveled compaction over size-tiered compaction?
A) Leveled compaction uses less CPU during merges
B) Leveled compaction has lower space amplification because each level contains non-overlapping SSTables
C) Leveled compaction never needs to rewrite data
D) Leveled compaction supports larger key sizes
Correct: B

Q: What triggers compaction in a size-tiered strategy?
A) When the total disk usage exceeds a fixed threshold
B) When enough SSTables of similar size accumulate in the same bucket
C) When read latency exceeds a configured maximum
D) On a fixed time schedule regardless of SSTable count
Correct: B

## Challenge

Build a sorted merge of two pre-sorted entry lists, keeping only the newest version of each key (by timestamp) and dropping tombstones. Print the compacted output.

## Starter Code

```go
package main

import "fmt"

type Entry struct {
	Key       string
	Value     string
	Deleted   bool
	Timestamp int
}

func merge(older, newer []Entry) []Entry {
	// TODO: Merge two sorted lists, keeping the newest version of each key
	// Drop tombstones since this is the "bottom level"
	return nil
}

func main() {
	older := []Entry{
		{"a", "old-a", false, 1},
		{"b", "old-b", false, 1},
		{"c", "old-c", false, 1},
	}
	newer := []Entry{
		{"a", "new-a", false, 5},
		{"b", "", true, 5},
		{"d", "new-d", false, 5},
	}

	result := merge(older, newer)
	for _, e := range result {
		fmt.Printf("key=%s value=%s\n", e.Key, e.Value)
	}
}
```

## Expected Output

```
key=a value=new-a
key=c value=old-c
key=d value=new-d
```

## Hint

Use two pointers, one for each list. Compare the current keys: if equal, keep the entry with the higher timestamp and advance both pointers. If one is smaller, take it and advance that pointer. Skip any entry that has `Deleted == true`.

## Solution

```go
package main

import "fmt"

type Entry struct {
	Key       string
	Value     string
	Deleted   bool
	Timestamp int
}

func merge(older, newer []Entry) []Entry {
	var result []Entry
	i, j := 0, 0

	for i < len(older) && j < len(newer) {
		if older[i].Key == newer[j].Key {
			// Same key -- keep the one with the higher timestamp
			var winner Entry
			if newer[j].Timestamp >= older[i].Timestamp {
				winner = newer[j]
			} else {
				winner = older[i]
			}
			// Drop tombstones (bottom level compaction)
			if !winner.Deleted {
				result = append(result, winner)
			}
			i++
			j++
		} else if older[i].Key < newer[j].Key {
			if !older[i].Deleted {
				result = append(result, older[i])
			}
			i++
		} else {
			if !newer[j].Deleted {
				result = append(result, newer[j])
			}
			j++
		}
	}

	for ; i < len(older); i++ {
		if !older[i].Deleted {
			result = append(result, older[i])
		}
	}
	for ; j < len(newer); j++ {
		if !newer[j].Deleted {
			result = append(result, newer[j])
		}
	}

	return result
}

func main() {
	older := []Entry{
		{"a", "old-a", false, 1},
		{"b", "old-b", false, 1},
		{"c", "old-c", false, 1},
	}
	newer := []Entry{
		{"a", "new-a", false, 5},
		{"b", "", true, 5},
		{"d", "new-d", false, 5},
	}

	result := merge(older, newer)
	for _, e := range result {
		fmt.Printf("key=%s value=%s\n", e.Key, e.Value)
	}
}
```
