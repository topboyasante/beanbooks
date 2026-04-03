---
id: "go-btrees"
courseId: "go-systems"
moduleId: "storage-engines"
title: "B-Trees"
description: "Upgrade your KV store with sorted keys and efficient range queries using B-trees."
order: 2
---

## Scenario

Your key-value store works, but it has a problem: to find a key, you either keep everything in a hash map (no ordering, no range queries) or scan the entire file. Real databases need to answer queries like "give me all users with IDs between 1000 and 2000" efficiently. B-trees solve this by maintaining sorted keys in a tree structure optimized for disk access.

In this lesson, you will build a B-tree from scratch. You will understand why databases universally chose this data structure -- its wide branching factor means fewer disk reads, and its balanced nature guarantees logarithmic performance. PostgreSQL, MySQL InnoDB, and SQLite all use B-trees at their core.

## Content

## B-Trees

### Why B-Trees for Databases

A binary search tree has O(log n) lookup, but each node is a single key, requiring many levels. On disk, each level means a random seek -- the slowest operation on spinning disks and still expensive on SSDs. B-trees solve this by packing hundreds of keys into each node:

```go
package btree

// A binary tree with 1M keys has ~20 levels = 20 disk reads
// A B-tree with order 100 and 1M keys has ~3 levels = 3 disk reads

// B-tree properties:
// 1. All leaves are at the same depth (balanced)
// 2. Each node holds between t-1 and 2t-1 keys (t = minimum degree)
// 3. Each internal node has between t and 2t children
// 4. Keys within a node are sorted
// 5. The root may have fewer than t-1 keys
```

### Node Structure

A B-tree node contains sorted keys, associated values, and pointers to children:

```go
package btree

import "fmt"

const MinDegree = 3 // each node holds 2-5 keys

// Node represents a single node in the B-tree
type Node struct {
	Keys     []string
	Values   [][]byte
	Children []*Node
	IsLeaf   bool
	NumKeys  int
}

func newNode(isLeaf bool) *Node {
	maxKeys := 2*MinDegree - 1
	return &Node{
		Keys:     make([]string, maxKeys),
		Values:   make([][]byte, maxKeys),
		Children: make([]*Node, maxKeys+1),
		IsLeaf:   isLeaf,
		NumKeys:  0,
	}
}

// BTree is the top-level tree structure
type BTree struct {
	Root *Node
}

func New() *BTree {
	return &BTree{
		Root: newNode(true),
	}
}
```

### Search Algorithm

Searching a B-tree is a top-down process. At each node, binary search finds the right key or the child to descend into:

```go
package btree

// Search finds a key in the B-tree, returning its value and whether it exists
func (bt *BTree) Search(key string) ([]byte, bool) {
	return searchNode(bt.Root, key)
}

func searchNode(node *Node, key string) ([]byte, bool) {
	// Find the first key >= search key
	i := 0
	for i < node.NumKeys && key > node.Keys[i] {
		i++
	}

	// Check if we found the exact key
	if i < node.NumKeys && key == node.Keys[i] {
		return node.Values[i], true
	}

	// If this is a leaf, the key does not exist
	if node.IsLeaf {
		return nil, false
	}

	// Recurse into the appropriate child
	return searchNode(node.Children[i], key)
}
```

At each level, you scan at most `2*MinDegree - 1` keys within a node (which fits in a single disk page), then descend one level. Total levels is O(log_t n), where t is the minimum degree.

### Insertion

Insertion is more complex because nodes can overflow. When a node has `2t-1` keys (full), it must be split before inserting:

```go
package btree

// Insert adds a key-value pair to the B-tree
func (bt *BTree) Insert(key string, value []byte) {
	root := bt.Root

	// If root is full, split it and create a new root
	if root.NumKeys == 2*MinDegree-1 {
		newRoot := newNode(false)
		newRoot.Children[0] = root
		splitChild(newRoot, 0, root)

		// Determine which child gets the new key
		i := 0
		if key > newRoot.Keys[0] {
			i = 1
		}
		insertNonFull(newRoot.Children[i], key, value)
		bt.Root = newRoot
	} else {
		insertNonFull(root, key, value)
	}
}

// insertNonFull inserts into a node that is guaranteed not to be full
func insertNonFull(node *Node, key string, value []byte) {
	i := node.NumKeys - 1

	if node.IsLeaf {
		// Shift keys right to make room
		for i >= 0 && key < node.Keys[i] {
			node.Keys[i+1] = node.Keys[i]
			node.Values[i+1] = node.Values[i]
			i--
		}

		// Check for update (key already exists)
		if i >= 0 && node.Keys[i+1] == key {
			node.Values[i+1] = value
			return
		}

		node.Keys[i+1] = key
		node.Values[i+1] = value
		node.NumKeys++
	} else {
		// Find the child to descend into
		for i >= 0 && key < node.Keys[i] {
			i--
		}
		i++

		// Split child if it is full
		if node.Children[i].NumKeys == 2*MinDegree-1 {
			splitChild(node, i, node.Children[i])
			if key > node.Keys[i] {
				i++
			}
		}
		insertNonFull(node.Children[i], key, value)
	}
}
```

### Node Splitting

When a node is full, it splits into two nodes and pushes the median key up to the parent:

```go
package btree

// splitChild splits a full child node into two nodes
func splitChild(parent *Node, childIndex int, child *Node) {
	t := MinDegree

	// Create a new node to hold the right half
	newChild := newNode(child.IsLeaf)
	newChild.NumKeys = t - 1

	// Copy the right half of keys/values to the new child
	for j := 0; j < t-1; j++ {
		newChild.Keys[j] = child.Keys[j+t]
		newChild.Values[j] = child.Values[j+t]
	}

	// Copy the right half of children if not a leaf
	if !child.IsLeaf {
		for j := 0; j < t; j++ {
			newChild.Children[j] = child.Children[j+t]
		}
	}

	child.NumKeys = t - 1

	// Make room in parent for the new child pointer
	for j := parent.NumKeys; j > childIndex; j-- {
		parent.Children[j+1] = parent.Children[j]
	}
	parent.Children[childIndex+1] = newChild

	// Move the median key up to the parent
	for j := parent.NumKeys - 1; j >= childIndex; j-- {
		parent.Keys[j+1] = parent.Keys[j]
		parent.Values[j+1] = parent.Values[j]
	}
	parent.Keys[childIndex] = child.Keys[t-1]
	parent.Values[childIndex] = child.Values[t-1]
	parent.NumKeys++
}
```

### Range Queries

One of the biggest advantages of B-trees over hash maps is range queries. Because keys are sorted, you can efficiently find all keys in a range:

```go
package btree

// Range returns all key-value pairs where startKey <= key <= endKey
func (bt *BTree) Range(startKey, endKey string) []KeyValue {
	var results []KeyValue
	rangeSearch(bt.Root, startKey, endKey, &results)
	return results
}

type KeyValue struct {
	Key   string
	Value []byte
}

func rangeSearch(node *Node, startKey, endKey string, results *[]KeyValue) {
	i := 0

	// Find the first key >= startKey
	for i < node.NumKeys && node.Keys[i] < startKey {
		i++
	}

	for i < node.NumKeys {
		// Visit left child first (in-order traversal)
		if !node.IsLeaf {
			rangeSearch(node.Children[i], startKey, endKey, results)
		}

		// If current key is past endKey, we are done
		if node.Keys[i] > endKey {
			return
		}

		// Include this key in results
		*results = append(*results, KeyValue{
			Key:   node.Keys[i],
			Value: node.Values[i],
		})
		i++
	}

	// Visit the rightmost child
	if !node.IsLeaf && i <= node.NumKeys {
		rangeSearch(node.Children[i], startKey, endKey, results)
	}
}

// InOrder traverses the entire tree in sorted order
func (bt *BTree) InOrder(fn func(key string, value []byte)) {
	inOrderWalk(bt.Root, fn)
}

func inOrderWalk(node *Node, fn func(string, []byte)) {
	for i := 0; i < node.NumKeys; i++ {
		if !node.IsLeaf {
			inOrderWalk(node.Children[i], fn)
		}
		fn(node.Keys[i], node.Values[i])
	}
	if !node.IsLeaf {
		inOrderWalk(node.Children[node.NumKeys], fn)
	}
}
```

## Why It Matters

B-trees are the backbone of nearly every relational database. PostgreSQL uses B-trees for its default index type. MySQL InnoDB stores the entire table in a B-tree (clustered index). SQLite is essentially a B-tree library. Understanding how B-trees work -- the splitting, the balanced growth, the disk-friendly wide fan-out -- gives you direct insight into why databases perform the way they do and how to choose the right indexes for your queries.

## Questions

Q: Why do B-trees use wide nodes with many keys instead of binary nodes with two children?
A) Binary trees cannot store key-value pairs
B) Wide nodes minimize the number of disk reads by matching the size of a disk page
C) B-trees require less memory than binary trees
D) Binary trees cannot be balanced
Correct: B

Q: What happens when you insert a key into a B-tree node that is already full?
A) The insertion fails with an error
B) The node is split into two nodes and the median key is pushed up to the parent
C) The oldest key in the node is deleted to make room
D) A new B-tree is created with the old and new data
Correct: B

Q: What is the key advantage of B-trees over hash-based key-value stores?
A) B-trees use less memory
B) B-trees support efficient range queries because keys are stored in sorted order
C) B-trees have O(1) lookup time
D) B-trees do not require persistence
Correct: B

## Challenge

Build a simple B-tree that supports insertion and in-order traversal. Insert 7 keys and print them in sorted order to verify the tree maintains order correctly.

## Starter Code

```go
package main

import "fmt"

const T = 2 // minimum degree: nodes hold 1-3 keys

type Node struct {
	keys     []int
	children []*Node
	leaf     bool
}

type BTree struct {
	root *Node
}

func NewBTree() *BTree {
	// TODO: create tree with empty leaf root
	return nil
}

func (bt *BTree) Insert(key int) {
	// TODO: insert key, handle root split
}

func (bt *BTree) InOrder() []int {
	// TODO: return all keys in sorted order
	return nil
}

func main() {
	bt := NewBTree()
	for _, k := range []int{10, 20, 5, 6, 12, 30, 7} {
		bt.Insert(k)
	}
	fmt.Println("Sorted keys:", bt.InOrder())
}
```

## Expected Output

```
Sorted keys: [5 6 7 10 12 20 30]
```

## Hint

For insertion, first check if the root is full (has `2*T - 1` keys). If so, create a new root and split the old root. Then use `insertNonFull` which either inserts directly into a leaf or recurses into the correct child (splitting it first if needed).

## Solution

```go
package main

import "fmt"

const T = 2

type Node struct {
	keys     []int
	children []*Node
	leaf     bool
}

type BTree struct {
	root *Node
}

func NewBTree() *BTree {
	return &BTree{root: &Node{leaf: true}}
}

func (bt *BTree) Insert(key int) {
	r := bt.root
	if len(r.keys) == 2*T-1 {
		s := &Node{leaf: false, children: []*Node{r}}
		splitChild(s, 0)
		bt.root = s
		insertNonFull(s, key)
	} else {
		insertNonFull(r, key)
	}
}

func splitChild(parent *Node, i int) {
	child := parent.children[i]
	mid := T - 1

	right := &Node{
		leaf: child.leaf,
		keys: append([]int{}, child.keys[mid+1:]...),
	}
	if !child.leaf {
		right.children = append([]*Node{}, child.children[mid+1:]...)
	}

	medianKey := child.keys[mid]
	child.keys = child.keys[:mid]
	if !child.leaf {
		child.children = child.children[:mid+1]
	}

	// Insert median key and right child into parent
	parent.keys = append(parent.keys, 0)
	copy(parent.keys[i+1:], parent.keys[i:])
	parent.keys[i] = medianKey

	parent.children = append(parent.children, nil)
	copy(parent.children[i+2:], parent.children[i+1:])
	parent.children[i+1] = right
}

func insertNonFull(node *Node, key int) {
	if node.leaf {
		// Find position and insert
		pos := len(node.keys)
		for pos > 0 && key < node.keys[pos-1] {
			pos--
		}
		node.keys = append(node.keys, 0)
		copy(node.keys[pos+1:], node.keys[pos:])
		node.keys[pos] = key
	} else {
		i := len(node.keys) - 1
		for i >= 0 && key < node.keys[i] {
			i--
		}
		i++
		if len(node.children[i].keys) == 2*T-1 {
			splitChild(node, i)
			if key > node.keys[i] {
				i++
			}
		}
		insertNonFull(node.children[i], key)
	}
}

func (bt *BTree) InOrder() []int {
	var result []int
	inOrder(bt.root, &result)
	return result
}

func inOrder(node *Node, result *[]int) {
	if node == nil {
		return
	}
	for i := 0; i < len(node.keys); i++ {
		if !node.leaf {
			inOrder(node.children[i], result)
		}
		*result = append(*result, node.keys[i])
	}
	if !node.leaf {
		inOrder(node.children[len(node.keys)], result)
	}
}

func main() {
	bt := NewBTree()
	for _, k := range []int{10, 20, 5, 6, 12, 30, 7} {
		bt.Insert(k)
	}
	fmt.Println("Sorted keys:", bt.InOrder())
}
```
