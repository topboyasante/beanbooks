---
id: "go-tunnel-reconnection"
courseId: "go-systems"
moduleId: "tcp-tunnel"
title: "Reconnection"
description: "Make the tunnel resilient to network failures with exponential backoff and session resumption."
order: 4
---

## Scenario

Your tunnel works perfectly on a stable network. But networks are not stable. Wi-Fi drops out, laptops go to sleep, cloud VMs get live-migrated. When the control connection breaks, every active tunnel session dies. Users see errors. In production, this is unacceptable.

You need to build a reconnection system that detects disconnections quickly, retries with exponential backoff so you do not overwhelm the server, tracks reconnection state through a state machine, and -- when possible -- resumes the session so active streams are not lost. This is the difference between a toy project and a production-grade tunnel.

## Content

## Reconnection

### Detecting Disconnections

There are multiple ways a TCP connection can fail, and you need to handle all of them:

```go
package reconnect

import (
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"syscall"
)

// IsDisconnectError checks if an error indicates the connection is dead
func IsDisconnectError(err error) bool {
	if err == nil {
		return false
	}

	// EOF means the remote side closed the connection
	if errors.Is(err, io.EOF) {
		return true
	}

	// Connection reset by peer
	if errors.Is(err, syscall.ECONNRESET) {
		return true
	}

	// Broken pipe -- writing to a closed connection
	if errors.Is(err, syscall.EPIPE) {
		return true
	}

	// Network-level errors
	var netErr *net.OpError
	if errors.As(err, &netErr) {
		return true
	}

	// Catch-all for common error strings
	msg := err.Error()
	disconnectPhrases := []string{
		"connection refused",
		"connection reset",
		"broken pipe",
		"use of closed network connection",
	}
	for _, phrase := range disconnectPhrases {
		if strings.Contains(msg, phrase) {
			return true
		}
	}

	return false
}

// MonitorConnection reads from the connection and signals when it dies
func MonitorConnection(conn net.Conn, dead chan<- error) {
	buf := make([]byte, 1)
	for {
		_, err := conn.Read(buf)
		if err != nil {
			dead <- err
			return
		}
	}
}

func ExampleDetection() {
	dead := make(chan error, 1)

	conn, err := net.Dial("tcp", "127.0.0.1:9000")
	if err != nil {
		fmt.Println("cannot connect:", err)
		return
	}

	go MonitorConnection(conn, dead)

	err = <-dead
	if IsDisconnectError(err) {
		fmt.Println("connection lost, initiating reconnect...")
	}
}
```

### Exponential Backoff

When a connection fails, you should not retry immediately in a tight loop. Exponential backoff spaces out retries, doubling the wait time each attempt, with jitter to prevent thundering herds:

```go
package reconnect

import (
	"fmt"
	"math"
	"math/rand"
	"time"
)

// BackoffConfig controls the retry timing
type BackoffConfig struct {
	InitialDelay time.Duration
	MaxDelay     time.Duration
	MaxRetries   int
	Multiplier   float64
	JitterFactor float64 // 0.0 to 1.0
}

func DefaultBackoffConfig() BackoffConfig {
	return BackoffConfig{
		InitialDelay: 500 * time.Millisecond,
		MaxDelay:     30 * time.Second,
		MaxRetries:   10,
		Multiplier:   2.0,
		JitterFactor: 0.3,
	}
}

// Delay calculates the backoff duration for a given attempt number
func (b BackoffConfig) Delay(attempt int) time.Duration {
	delay := float64(b.InitialDelay) * math.Pow(b.Multiplier, float64(attempt))

	if delay > float64(b.MaxDelay) {
		delay = float64(b.MaxDelay)
	}

	// Add jitter: +-JitterFactor of the delay
	jitter := delay * b.JitterFactor * (2*rand.Float64() - 1)
	delay += jitter

	if delay < 0 {
		delay = 0
	}

	return time.Duration(delay)
}

func DemonstrateBackoff() {
	cfg := DefaultBackoffConfig()

	for attempt := 0; attempt < cfg.MaxRetries; attempt++ {
		delay := cfg.Delay(attempt)
		fmt.Printf("Attempt %d: wait %v\n", attempt+1, delay.Round(time.Millisecond))
	}
}
```

### Reconnection State Machine

Model the reconnection process as a state machine with clear transitions:

```go
package reconnect

import (
	"fmt"
	"net"
	"sync"
	"time"
)

type ReconnState int

const (
	Connected ReconnState = iota
	Detecting
	Backoff
	Reconnecting
	Resuming
	Failed
)

func (s ReconnState) String() string {
	names := []string{"CONNECTED", "DETECTING", "BACKOFF", "RECONNECTING", "RESUMING", "FAILED"}
	if int(s) < len(names) {
		return names[s]
	}
	return "UNKNOWN"
}

// ReconnManager manages the reconnection lifecycle
type ReconnManager struct {
	state       ReconnState
	serverAddr  string
	sessionID   string
	backoff     BackoffConfig
	attempt     int
	conn        net.Conn
	mu          sync.Mutex
	onReconnect func(net.Conn) error
}

func NewReconnManager(serverAddr string, cfg BackoffConfig) *ReconnManager {
	return &ReconnManager{
		state:      Connected,
		serverAddr: serverAddr,
		backoff:    cfg,
	}
}

func (rm *ReconnManager) transition(newState ReconnState) {
	fmt.Printf("[reconn] %s -> %s (attempt %d)\n", rm.state, newState, rm.attempt)
	rm.state = newState
}

// HandleDisconnect is called when a connection loss is detected
func (rm *ReconnManager) HandleDisconnect() error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	rm.transition(Detecting)
	rm.attempt = 0

	for rm.attempt < rm.backoff.MaxRetries {
		// Backoff
		rm.transition(Backoff)
		delay := rm.backoff.Delay(rm.attempt)
		time.Sleep(delay)

		// Attempt reconnection
		rm.transition(Reconnecting)
		conn, err := net.DialTimeout("tcp", rm.serverAddr, 5*time.Second)
		if err != nil {
			fmt.Printf("[reconn] attempt %d failed: %v\n", rm.attempt+1, err)
			rm.attempt++
			continue
		}

		// Try to resume session
		rm.transition(Resuming)
		if rm.onReconnect != nil {
			if err := rm.onReconnect(conn); err != nil {
				fmt.Printf("[reconn] resume failed: %v\n", err)
				conn.Close()
				rm.attempt++
				continue
			}
		}

		rm.conn = conn
		rm.attempt = 0
		rm.transition(Connected)
		return nil
	}

	rm.transition(Failed)
	return fmt.Errorf("failed after %d attempts", rm.backoff.MaxRetries)
}
```

### Session Resumption

When you reconnect, you want to avoid a full re-handshake. The server can issue a session token that the client presents on reconnection:

```go
package reconnect

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// SessionState holds everything needed to resume a session
type SessionState struct {
	SessionID    string    `json:"session_id"`
	TunnelID     string    `json:"tunnel_id"`
	CreatedAt    time.Time `json:"created_at"`
	LastSeen     time.Time `json:"last_seen"`
	ResumeToken  string    `json:"resume_token"`
	ActiveStreams []uint32  `json:"active_streams"`
}

// SessionStore manages resumable sessions on the server side
type SessionStore struct {
	sessions map[string]*SessionState
	mu       sync.RWMutex
	ttl      time.Duration
}

func NewSessionStore(ttl time.Duration) *SessionStore {
	s := &SessionStore{
		sessions: make(map[string]*SessionState),
		ttl:      ttl,
	}
	go s.cleanup()
	return s
}

func (ss *SessionStore) Save(state *SessionState) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	state.LastSeen = time.Now()
	ss.sessions[state.SessionID] = state
}

func (ss *SessionStore) Resume(sessionID, resumeToken string) (*SessionState, error) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	state, exists := ss.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	if state.ResumeToken != resumeToken {
		return nil, fmt.Errorf("invalid resume token")
	}

	if time.Since(state.LastSeen) > ss.ttl {
		delete(ss.sessions, sessionID)
		return nil, fmt.Errorf("session %s expired", sessionID)
	}

	state.LastSeen = time.Now()
	return state, nil
}

// cleanup removes expired sessions periodically
func (ss *SessionStore) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		ss.mu.Lock()
		for id, state := range ss.sessions {
			if time.Since(state.LastSeen) > ss.ttl {
				delete(ss.sessions, id)
			}
		}
		ss.mu.Unlock()
	}
}

// ResumeRequest is sent by the client to resume a previous session
type ResumeRequest struct {
	SessionID   string `json:"session_id"`
	ResumeToken string `json:"resume_token"`
}

func (r ResumeRequest) Marshal() []byte {
	data, _ := json.Marshal(r)
	return data
}
```

### Graceful Degradation

Sometimes reconnection fails entirely. Your system should degrade gracefully rather than crash:

```go
package reconnect

import (
	"fmt"
	"sync"
)

// TunnelStatus represents what the user sees
type TunnelStatus int

const (
	StatusOnline TunnelStatus = iota
	StatusReconnecting
	StatusOffline
)

func (s TunnelStatus) String() string {
	switch s {
	case StatusOnline:
		return "ONLINE"
	case StatusReconnecting:
		return "RECONNECTING"
	case StatusOffline:
		return "OFFLINE"
	}
	return "UNKNOWN"
}

// StatusReporter notifies the application of tunnel health changes
type StatusReporter struct {
	status    TunnelStatus
	listeners []func(TunnelStatus)
	mu        sync.RWMutex
}

func NewStatusReporter() *StatusReporter {
	return &StatusReporter{status: StatusOnline}
}

func (sr *StatusReporter) OnStatusChange(fn func(TunnelStatus)) {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	sr.listeners = append(sr.listeners, fn)
}

func (sr *StatusReporter) SetStatus(s TunnelStatus) {
	sr.mu.Lock()
	defer sr.mu.Unlock()

	if sr.status == s {
		return
	}

	old := sr.status
	sr.status = s
	fmt.Printf("[status] %s -> %s\n", old, s)

	for _, fn := range sr.listeners {
		go fn(s)
	}
}

// GracefulDegradation queues requests during reconnection
// and returns errors only after the tunnel is fully offline
type GracefulDegradation struct {
	status   *StatusReporter
	pending  [][]byte
	mu       sync.Mutex
	maxQueue int
}

func NewGracefulDegradation(sr *StatusReporter, maxQueue int) *GracefulDegradation {
	return &GracefulDegradation{
		status:   sr,
		maxQueue: maxQueue,
	}
}

func (gd *GracefulDegradation) Send(data []byte) error {
	gd.mu.Lock()
	defer gd.mu.Unlock()

	switch gd.status.status {
	case StatusOnline:
		// Send immediately
		return nil
	case StatusReconnecting:
		if len(gd.pending) >= gd.maxQueue {
			return fmt.Errorf("queue full, dropping message")
		}
		gd.pending = append(gd.pending, data)
		fmt.Printf("[degrade] queued message (%d pending)\n", len(gd.pending))
		return nil
	case StatusOffline:
		return fmt.Errorf("tunnel offline")
	}
	return nil
}

func (gd *GracefulDegradation) Flush() [][]byte {
	gd.mu.Lock()
	defer gd.mu.Unlock()
	pending := gd.pending
	gd.pending = nil
	return pending
}
```

## Why It Matters

Reliability separates production systems from demos. Every long-lived network connection will eventually break. The patterns in this lesson -- exponential backoff, state machines for reconnection, session resumption, graceful degradation -- appear everywhere: database drivers reconnecting to servers, gRPC channels recovering from transient failures, WebSocket clients handling dropped connections. Building these patterns yourself gives you a deep understanding of what your production dependencies do under the hood when the network inevitably fails.

## Questions

Q: Why is jitter added to exponential backoff delays?
A) To make the delays more predictable for logging purposes
B) To prevent many clients from retrying at the exact same time after a shared outage (thundering herd)
C) To reduce the total number of retry attempts
D) To ensure the backoff delay never exceeds the maximum
Correct: B

Q: What is the purpose of a session resume token?
A) To encrypt all data in the reconnected session
B) To allow the client to skip the full handshake and restore its previous tunnel state after reconnecting
C) To load balance the client across multiple servers
D) To prevent the client from ever disconnecting
Correct: B

Q: Why does `IsDisconnectError` check for multiple error types instead of just `io.EOF`?
A) Some errors are more important than others and need different handling
B) TCP connections can fail in many different ways, each surfacing as a different Go error type
C) Only `io.EOF` is a real disconnection; the others are warnings
D) Multiple checks make the function run faster
Correct: B

## Challenge

Build a reconnection loop with exponential backoff. A "client" tries to connect to a server that only becomes available after 3 failed attempts. Print each attempt with its delay.

## Starter Code

```go
package main

import (
	"fmt"
	"math"
	"net"
	"time"
)

func backoffDelay(attempt int) time.Duration {
	// TODO: Calculate exponential backoff: 100ms * 2^attempt, max 2s
	return 0
}

func main() {
	// TODO: Start server after a 1-second delay (goroutine)
	// TODO: Retry loop with backoff, printing each attempt
}
```

## Expected Output

```
Attempt 1: dial failed, retrying in 100ms
Attempt 2: dial failed, retrying in 200ms
Attempt 3: dial failed, retrying in 400ms
Attempt 4: connected successfully!
```

## Hint

Use a goroutine with `time.Sleep(1 * time.Second)` before starting the listener. In the retry loop, call `net.DialTimeout` and compute the delay with `100ms * 2^attempt`, capped at 2 seconds.

## Solution

```go
package main

import (
	"fmt"
	"math"
	"net"
	"time"
)

func backoffDelay(attempt int) time.Duration {
	delay := float64(100*time.Millisecond) * math.Pow(2, float64(attempt))
	max := float64(2 * time.Second)
	if delay > max {
		delay = max
	}
	return time.Duration(delay)
}

func main() {
	addr := "127.0.0.1:9003"

	// Start server after a delay (simulating it being temporarily unavailable)
	go func() {
		time.Sleep(700 * time.Millisecond)
		ln, err := net.Listen("tcp", addr)
		if err != nil {
			panic(err)
		}
		defer ln.Close()
		conn, _ := ln.Accept()
		if conn != nil {
			conn.Close()
		}
	}()

	for attempt := 0; attempt < 10; attempt++ {
		conn, err := net.DialTimeout("tcp", addr, 100*time.Millisecond)
		if err != nil {
			delay := backoffDelay(attempt)
			fmt.Printf("Attempt %d: dial failed, retrying in %v\n", attempt+1, delay.Round(time.Millisecond))
			time.Sleep(delay)
			continue
		}
		fmt.Printf("Attempt %d: connected successfully!\n", attempt+1)
		conn.Close()
		return
	}

	fmt.Println("Failed to connect after all attempts")
}
```
