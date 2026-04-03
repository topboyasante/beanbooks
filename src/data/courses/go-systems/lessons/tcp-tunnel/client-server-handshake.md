---
id: "go-tunnel-handshake"
courseId: "go-systems"
moduleId: "tcp-tunnel"
title: "Client-Server Handshake"
description: "Implement the initial handshake where a tunnel client registers with the server."
order: 2
---

## Scenario

Your tunnel system needs a way for the client to introduce itself to the server. When a tunnel client connects, it must authenticate, tell the server which port or subdomain it wants, and then keep the connection alive so the server knows the client is still there. This initial handshake is the foundation of trust and coordination in the system.

You will implement a JSON-based control protocol over TCP. The client sends a registration request, the server validates it and responds with an assigned tunnel address, and then both sides exchange periodic heartbeats to detect dead connections.

## Content

## Client-Server Handshake

### Control Protocol Messages

Define the control messages as Go structs that serialize to JSON. Each message has a type field so both sides know how to interpret it:

```go
package tunnel

import "time"

// MessageType identifies the kind of control message
type MessageType string

const (
	MsgTypeAuth      MessageType = "auth"
	MsgTypeAuthResp  MessageType = "auth_resp"
	MsgTypeRegister  MessageType = "register"
	MsgTypeRegResp   MessageType = "register_resp"
	MsgTypePing      MessageType = "ping"
	MsgTypePong      MessageType = "pong"
	MsgTypeNewConn   MessageType = "new_conn"
)

// ControlMessage wraps all control messages with a type discriminator
type ControlMessage struct {
	Type    MessageType `json:"type"`
	Payload interface{} `json:"payload"`
}

// AuthRequest is sent by the client to authenticate
type AuthRequest struct {
	Token     string `json:"token"`
	ClientID  string `json:"client_id"`
	Version   string `json:"version"`
}

// AuthResponse is the server's reply to authentication
type AuthResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// RegisterRequest asks the server to allocate a public tunnel
type RegisterRequest struct {
	Subdomain string `json:"subdomain,omitempty"`
	LocalPort int    `json:"local_port"`
	Protocol  string `json:"protocol"` // "tcp" or "http"
}

// RegisterResponse tells the client its assigned public address
type RegisterResponse struct {
	Success   bool   `json:"success"`
	TunnelID  string `json:"tunnel_id"`
	PublicURL string `json:"public_url"`
	Error     string `json:"error,omitempty"`
}

// Ping is sent by either side to check liveness
type Ping struct {
	Timestamp time.Time `json:"timestamp"`
}

// Pong is the reply to a Ping
type Pong struct {
	Timestamp time.Time `json:"timestamp"`
}
```

### Sending and Receiving JSON Over TCP

Combine the framing from the previous lesson with JSON encoding. Each control message is serialized to JSON, then sent as a length-prefixed frame:

```go
package tunnel

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
)

// SendMessage serializes a ControlMessage to JSON and sends it framed
func SendMessage(conn net.Conn, msg ControlMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	// Write 4-byte length prefix
	lenBuf := make([]byte, 4)
	binary.BigEndian.PutUint32(lenBuf, uint32(len(data)))
	if _, err := conn.Write(lenBuf); err != nil {
		return fmt.Errorf("write length: %w", err)
	}

	// Write JSON payload
	if _, err := conn.Write(data); err != nil {
		return fmt.Errorf("write payload: %w", err)
	}
	return nil
}

// RecvMessage reads a framed JSON message from the connection
func RecvMessage(conn net.Conn) (ControlMessage, error) {
	// Read 4-byte length prefix
	lenBuf := make([]byte, 4)
	if _, err := io.ReadFull(conn, lenBuf); err != nil {
		return ControlMessage{}, fmt.Errorf("read length: %w", err)
	}
	length := binary.BigEndian.Uint32(lenBuf)

	// Read JSON payload
	data := make([]byte, length)
	if _, err := io.ReadFull(conn, data); err != nil {
		return ControlMessage{}, fmt.Errorf("read payload: %w", err)
	}

	var msg ControlMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return ControlMessage{}, fmt.Errorf("unmarshal: %w", err)
	}
	return msg, nil
}
```

### The Handshake Sequence

The full handshake is a three-step process: authenticate, register, then begin heartbeating.

```go
package tunnel

import (
	"encoding/json"
	"fmt"
	"net"
	"time"
)

// ClientHandshake performs the full client-side handshake
func ClientHandshake(conn net.Conn, token string, localPort int) (string, error) {
	// Step 1: Authenticate
	err := SendMessage(conn, ControlMessage{
		Type: MsgTypeAuth,
		Payload: AuthRequest{
			Token:    token,
			ClientID: "client-001",
			Version:  "1.0.0",
		},
	})
	if err != nil {
		return "", fmt.Errorf("send auth: %w", err)
	}

	authResp, err := RecvMessage(conn)
	if err != nil {
		return "", fmt.Errorf("recv auth response: %w", err)
	}

	// Decode the payload into AuthResponse
	payloadBytes, _ := json.Marshal(authResp.Payload)
	var auth AuthResponse
	json.Unmarshal(payloadBytes, &auth)

	if !auth.Success {
		return "", fmt.Errorf("auth failed: %s", auth.Error)
	}
	fmt.Println("[client] authenticated")

	// Step 2: Register tunnel
	err = SendMessage(conn, ControlMessage{
		Type: MsgTypeRegister,
		Payload: RegisterRequest{
			LocalPort: localPort,
			Protocol:  "tcp",
		},
	})
	if err != nil {
		return "", fmt.Errorf("send register: %w", err)
	}

	regResp, err := RecvMessage(conn)
	if err != nil {
		return "", fmt.Errorf("recv register response: %w", err)
	}

	payloadBytes, _ = json.Marshal(regResp.Payload)
	var reg RegisterResponse
	json.Unmarshal(payloadBytes, &reg)

	if !reg.Success {
		return "", fmt.Errorf("registration failed: %s", reg.Error)
	}
	fmt.Printf("[client] tunnel registered: %s\n", reg.PublicURL)

	return reg.TunnelID, nil
}

// ServerHandshake handles the server side of the handshake
func ServerHandshake(conn net.Conn, validToken string) (string, error) {
	// Step 1: Receive and validate auth
	authMsg, err := RecvMessage(conn)
	if err != nil {
		return "", fmt.Errorf("recv auth: %w", err)
	}

	payloadBytes, _ := json.Marshal(authMsg.Payload)
	var authReq AuthRequest
	json.Unmarshal(payloadBytes, &authReq)

	if authReq.Token != validToken {
		SendMessage(conn, ControlMessage{
			Type:    MsgTypeAuthResp,
			Payload: AuthResponse{Success: false, Error: "invalid token"},
		})
		return "", fmt.Errorf("invalid token from %s", authReq.ClientID)
	}

	SendMessage(conn, ControlMessage{
		Type:    MsgTypeAuthResp,
		Payload: AuthResponse{Success: true},
	})
	fmt.Printf("[server] client %s authenticated\n", authReq.ClientID)

	// Step 2: Handle registration
	regMsg, err := RecvMessage(conn)
	if err != nil {
		return "", fmt.Errorf("recv register: %w", err)
	}

	payloadBytes, _ = json.Marshal(regMsg.Payload)
	var regReq RegisterRequest
	json.Unmarshal(payloadBytes, &regReq)

	tunnelID := fmt.Sprintf("tun_%d", time.Now().UnixNano())
	publicURL := fmt.Sprintf("tcp://tunnel.example.com:%d", 10000+regReq.LocalPort)

	SendMessage(conn, ControlMessage{
		Type: MsgTypeRegResp,
		Payload: RegisterResponse{
			Success:   true,
			TunnelID:  tunnelID,
			PublicURL: publicURL,
		},
	})
	fmt.Printf("[server] tunnel %s registered at %s\n", tunnelID, publicURL)

	return tunnelID, nil
}
```

### Heartbeat / Keepalive

After the handshake completes, both sides must detect if the other disappears. A heartbeat loop sends pings at regular intervals and expects pongs within a timeout:

```go
package tunnel

import (
	"fmt"
	"net"
	"time"
)

const (
	HeartbeatInterval = 5 * time.Second
	HeartbeatTimeout  = 15 * time.Second
)

// StartHeartbeat sends periodic pings and monitors for pongs
func StartHeartbeat(conn net.Conn, done chan struct{}) {
	ticker := time.NewTicker(HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(HeartbeatTimeout))
			err := SendMessage(conn, ControlMessage{
				Type:    MsgTypePing,
				Payload: Ping{Timestamp: time.Now()},
			})
			if err != nil {
				fmt.Printf("[heartbeat] failed to send ping: %v\n", err)
				close(done)
				return
			}
		case <-done:
			return
		}
	}
}

// HandleHeartbeat responds to pings with pongs
func HandleHeartbeat(conn net.Conn, msg ControlMessage) error {
	return SendMessage(conn, ControlMessage{
		Type:    MsgTypePong,
		Payload: Pong{Timestamp: time.Now()},
	})
}
```

### Token Validation Patterns

In production, you would validate tokens against a database or external auth service. Here is a simple in-memory validator to illustrate the pattern:

```go
package tunnel

import (
	"crypto/subtle"
	"sync"
)

// TokenValidator manages valid authentication tokens
type TokenValidator struct {
	tokens map[string]bool
	mu     sync.RWMutex
}

func NewTokenValidator() *TokenValidator {
	return &TokenValidator{
		tokens: make(map[string]bool),
	}
}

func (tv *TokenValidator) AddToken(token string) {
	tv.mu.Lock()
	defer tv.mu.Unlock()
	tv.tokens[token] = true
}

func (tv *TokenValidator) RevokeToken(token string) {
	tv.mu.Lock()
	defer tv.mu.Unlock()
	delete(tv.tokens, token)
}

// Validate uses constant-time comparison to prevent timing attacks
func (tv *TokenValidator) Validate(token string) bool {
	tv.mu.RLock()
	defer tv.mu.RUnlock()

	for valid := range tv.tokens {
		if subtle.ConstantTimeCompare([]byte(token), []byte(valid)) == 1 {
			return true
		}
	}
	return false
}
```

## Why It Matters

Every networked system needs a handshake phase where participants establish identity, negotiate capabilities, and set up the parameters for their session. Whether you are building a database driver, an RPC framework, or a tunnel, the pattern is the same: authenticate, configure, then maintain liveness. Understanding how to layer structured JSON messages over raw TCP using framing is a skill that transfers directly to building any custom network protocol.

## Questions

Q: Why does the tunnel use length-prefixed framing instead of sending raw JSON directly over TCP?
A) JSON is too large to send over TCP without compression
B) TCP is a byte stream, so without framing the receiver cannot know where one JSON message ends and the next begins
C) Length-prefixed framing encrypts the JSON payload
D) Raw JSON can only be sent over HTTP, not TCP
Correct: B

Q: What is the purpose of using `crypto/subtle.ConstantTimeCompare` for token validation?
A) It compresses the token for faster comparison
B) It prevents timing attacks that could guess the token by measuring comparison duration
C) It allows comparison of tokens with different lengths
D) It provides encryption for the token during validation
Correct: B

Q: In the heartbeat system, what happens if a ping goes unanswered beyond the timeout?
A) The system automatically reconnects
B) The heartbeat goroutine closes the done channel, signaling the connection is dead
C) The server allocates a new tunnel ID
D) The ping is retransmitted with a larger payload
Correct: B

## Challenge

Build a minimal client-server handshake over TCP. The client sends an auth token as a length-prefixed JSON message, the server validates it and responds with success or failure, and then the client prints the result.

## Starter Code

```go
package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"time"
)

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

func sendMsg(conn net.Conn, msg Message) error {
	// TODO: Marshal to JSON, write 4-byte length prefix, write payload
	return nil
}

func recvMsg(conn net.Conn) (Message, error) {
	// TODO: Read 4-byte length prefix, read payload, unmarshal
	return Message{}, nil
}

func main() {
	// TODO: Server goroutine that accepts, reads auth, responds
	// TODO: Client that sends auth and prints response
}
```

## Expected Output

```
[server] received auth token: my-secret-token
[server] auth success
[client] server response: auth granted
```

## Hint

Use `binary.BigEndian.PutUint32` and `binary.BigEndian.Uint32` for the length prefix. Use `io.ReadFull` to ensure you read exactly the expected number of bytes.

## Solution

```go
package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"time"
)

type Message struct {
	Type    string `json:"type"`
	Payload string `json:"payload"`
}

func sendMsg(conn net.Conn, msg Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	lenBuf := make([]byte, 4)
	binary.BigEndian.PutUint32(lenBuf, uint32(len(data)))
	if _, err := conn.Write(lenBuf); err != nil {
		return err
	}
	_, err = conn.Write(data)
	return err
}

func recvMsg(conn net.Conn) (Message, error) {
	lenBuf := make([]byte, 4)
	if _, err := io.ReadFull(conn, lenBuf); err != nil {
		return Message{}, err
	}
	length := binary.BigEndian.Uint32(lenBuf)
	data := make([]byte, length)
	if _, err := io.ReadFull(conn, data); err != nil {
		return Message{}, err
	}
	var msg Message
	err := json.Unmarshal(data, &msg)
	return msg, err
}

func main() {
	ln, err := net.Listen("tcp", "127.0.0.1:9001")
	if err != nil {
		panic(err)
	}
	defer ln.Close()

	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()

		msg, err := recvMsg(conn)
		if err != nil {
			fmt.Println("server recv error:", err)
			return
		}
		fmt.Printf("[server] received auth token: %s\n", msg.Payload)
		fmt.Println("[server] auth success")

		sendMsg(conn, Message{Type: "auth_resp", Payload: "auth granted"})
	}()

	time.Sleep(50 * time.Millisecond)

	conn, err := net.Dial("tcp", "127.0.0.1:9001")
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	sendMsg(conn, Message{Type: "auth", Payload: "my-secret-token"})

	resp, err := recvMsg(conn)
	if err != nil {
		panic(err)
	}
	fmt.Printf("[client] server response: %s\n", resp.Payload)
}
```
