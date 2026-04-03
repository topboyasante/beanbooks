---
id: "go-tunnel-architecture"
courseId: "go-systems"
moduleId: "tcp-tunnel"
title: "Tunnel Architecture"
description: "Design the high-level architecture of an ngrok-style TCP tunnel system."
order: 1
---

## Scenario

You need to expose a local development server to the public internet. Tools like ngrok solve this by creating a tunnel: a public server accepts incoming connections and forwards traffic through a persistent control connection to your local machine, which then proxies it to your local service. In this lesson, you will design the architecture of such a system from scratch.

Your goal is to understand the four key players -- the public server, the control connection, the local tunnel client, and the local service -- and how data flows between them. By the end, you will have a working mental model and a skeleton implementation that frames every subsequent lesson in this module.

## Content

## Tunnel Architecture

### The Four Components

A TCP tunnel system consists of four distinct components that work together:

1. **Public Server** -- listens on a public address, accepts connections from the internet
2. **Control Connection** -- a persistent TCP connection between the tunnel client and server used for coordination
3. **Tunnel Client** -- runs on the developer's machine, maintains the control connection and proxies traffic
4. **Local Service** -- the actual application being exposed (e.g., a web server on `localhost:3000`)

The data flow looks like this:

```
Internet User
     |
     v
Public Server (e.g., tunnel.example.com:8080)
     |
     | (control connection)
     v
Tunnel Client (developer's machine)
     |
     v
Local Service (localhost:3000)
```

### Message Framing

Raw TCP is a byte stream with no built-in message boundaries. To send structured messages over the control connection, you need a framing protocol. A common approach is length-prefixed framing:

```go
package tunnel

import (
	"encoding/binary"
	"io"
	"net"
)

// Frame represents a length-prefixed message
type Frame struct {
	Type    byte
	Payload []byte
}

const (
	FrameTypeControl = 0x01
	FrameTypeData    = 0x02
)

// WriteFrame sends a length-prefixed frame over a connection
func WriteFrame(conn net.Conn, f Frame) error {
	// Header: 4 bytes length + 1 byte type
	header := make([]byte, 5)
	binary.BigEndian.PutUint32(header[:4], uint32(len(f.Payload)))
	header[4] = f.Type

	if _, err := conn.Write(header); err != nil {
		return err
	}
	if _, err := conn.Write(f.Payload); err != nil {
		return err
	}
	return nil
}

// ReadFrame reads a length-prefixed frame from a connection
func ReadFrame(conn net.Conn) (Frame, error) {
	header := make([]byte, 5)
	if _, err := io.ReadFull(conn, header); err != nil {
		return Frame{}, err
	}

	length := binary.BigEndian.Uint32(header[:4])
	payload := make([]byte, length)
	if _, err := io.ReadFull(conn, payload); err != nil {
		return Frame{}, err
	}

	return Frame{
		Type:    header[4],
		Payload: payload,
	}, nil
}
```

### Connection Lifecycle

Every tunnel session follows a predictable lifecycle:

```go
package tunnel

import (
	"fmt"
	"net"
	"time"
)

// TunnelState represents the current phase of the tunnel lifecycle
type TunnelState int

const (
	StateDisconnected TunnelState = iota
	StateConnecting
	StateHandshaking
	StateActive
	StateShuttingDown
)

func (s TunnelState) String() string {
	switch s {
	case StateDisconnected:
		return "DISCONNECTED"
	case StateConnecting:
		return "CONNECTING"
	case StateHandshaking:
		return "HANDSHAKING"
	case StateActive:
		return "ACTIVE"
	case StateShuttingDown:
		return "SHUTTING_DOWN"
	default:
		return "UNKNOWN"
	}
}

// TunnelSession tracks the lifecycle of a tunnel connection
type TunnelSession struct {
	State     TunnelState
	Conn      net.Conn
	CreatedAt time.Time
	TunnelID  string
}

func NewTunnelSession() *TunnelSession {
	return &TunnelSession{
		State:     StateDisconnected,
		CreatedAt: time.Now(),
	}
}

func (ts *TunnelSession) Transition(newState TunnelState) {
	fmt.Printf("[tunnel] %s -> %s\n", ts.State, newState)
	ts.State = newState
}
```

The lifecycle proceeds as follows:
1. **DISCONNECTED** -- initial state, no connection exists
2. **CONNECTING** -- TCP dial to the public server is in progress
3. **HANDSHAKING** -- control connection established, exchanging auth and tunnel config
4. **ACTIVE** -- tunnel is live, forwarding traffic
5. **SHUTTING_DOWN** -- graceful shutdown initiated, draining active connections

### Server-Side Listener Architecture

The public server must handle two types of incoming connections: control connections from tunnel clients and public connections from internet users:

```go
package tunnel

import (
	"fmt"
	"net"
	"sync"
)

// Server manages tunnel registrations and public traffic
type Server struct {
	controlAddr string
	publicAddr  string
	tunnels     map[string]*TunnelSession
	mu          sync.RWMutex
}

func NewServer(controlAddr, publicAddr string) *Server {
	return &Server{
		controlAddr: controlAddr,
		publicAddr:  publicAddr,
		tunnels:     make(map[string]*TunnelSession),
	}
}

func (s *Server) Start() error {
	// Listen for tunnel client control connections
	controlLn, err := net.Listen("tcp", s.controlAddr)
	if err != nil {
		return fmt.Errorf("control listener: %w", err)
	}

	// Listen for public traffic
	publicLn, err := net.Listen("tcp", s.publicAddr)
	if err != nil {
		return fmt.Errorf("public listener: %w", err)
	}

	go s.acceptControlConnections(controlLn)
	go s.acceptPublicConnections(publicLn)

	fmt.Printf("Server started: control=%s public=%s\n", s.controlAddr, s.publicAddr)
	select {} // block forever
}

func (s *Server) acceptControlConnections(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			fmt.Printf("control accept error: %v\n", err)
			continue
		}
		go s.handleControlConnection(conn)
	}
}

func (s *Server) acceptPublicConnections(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			fmt.Printf("public accept error: %v\n", err)
			continue
		}
		go s.handlePublicConnection(conn)
	}
}

func (s *Server) handleControlConnection(conn net.Conn) {
	fmt.Printf("New control connection from %s\n", conn.RemoteAddr())
	// Handshake and registration handled in next lesson
}

func (s *Server) handlePublicConnection(conn net.Conn) {
	fmt.Printf("New public connection from %s\n", conn.RemoteAddr())
	// Route to appropriate tunnel handled in later lessons
}
```

### Data Flow: End to End

When an internet user connects to the public server, the following sequence occurs:

1. Public server accepts the TCP connection
2. Server determines which tunnel should receive this connection (based on port or subdomain)
3. Server sends a "new connection" control message to the tunnel client over the control connection
4. Tunnel client opens a new TCP connection to the local service
5. Tunnel client signals readiness to the server
6. Server and client begin bidirectional byte copying -- internet user's data flows to local service and back

This bidirectional copy is the core of the data plane:

```go
package tunnel

import (
	"io"
	"net"
	"sync"
)

// Proxy bidirectionally copies data between two connections
func Proxy(conn1, conn2 net.Conn) {
	var wg sync.WaitGroup
	wg.Add(2)

	copy := func(dst, src net.Conn) {
		defer wg.Done()
		io.Copy(dst, src)
		dst.Close()
	}

	go copy(conn1, conn2)
	go copy(conn2, conn1)

	wg.Wait()
}
```

## Why It Matters

TCP tunnels are a foundational building block in modern infrastructure. They power developer tools like ngrok, service meshes like Istio, and SSH tunneling. Understanding the architecture -- how control planes separate from data planes, how framing provides structure over raw TCP, and how connection lifecycles manage state -- gives you the mental framework to build any networked system that routes traffic between endpoints.

## Questions

Q: In a TCP tunnel system, what is the primary purpose of the control connection?
A) To carry user data between the internet and the local service
B) To coordinate tunnel registration, authentication, and signaling between client and server
C) To encrypt all traffic flowing through the tunnel
D) To load balance across multiple local services
Correct: B

Q: Why is message framing necessary on the control connection?
A) TCP automatically delivers messages in discrete packets
B) TCP is a byte stream with no inherent message boundaries, so length-prefixed framing delineates messages
C) Framing compresses data to reduce bandwidth usage
D) Framing is only needed for UDP, not TCP
Correct: B

Q: During bidirectional proxying, why does the `Proxy` function use a `sync.WaitGroup`?
A) To limit the number of concurrent connections
B) To ensure both copy goroutines complete before the function returns
C) To synchronize read and write operations on the same connection
D) To implement flow control between the two connections
Correct: B

## Challenge

Build a skeleton TCP tunnel with a server that accepts control connections and a client that connects and transitions through lifecycle states (DISCONNECTED -> CONNECTING -> HANDSHAKING -> ACTIVE). Print each state transition.

## Starter Code

```go
package main

import (
	"fmt"
	"net"
	"time"
)

type TunnelState int

const (
	StateDisconnected TunnelState = iota
	StateConnecting
	StateHandshaking
	StateActive
)

func (s TunnelState) String() string {
	// TODO: return string name for each state
	return ""
}

func main() {
	// TODO: Start a TCP listener on :9000 (the "server")
	// TODO: Connect to it as a "client"
	// TODO: Print each state transition
}
```

## Expected Output

```
[tunnel] DISCONNECTED -> CONNECTING
[tunnel] CONNECTING -> HANDSHAKING
[tunnel] HANDSHAKING -> ACTIVE
Server: new control connection from 127.0.0.1
Client: tunnel is ACTIVE
```

## Hint

Use `net.Listen` for the server and `net.Dial` for the client. Run the server in a goroutine and add a small `time.Sleep` before the client connects to ensure the server is ready.

## Solution

```go
package main

import (
	"fmt"
	"net"
	"time"
)

type TunnelState int

const (
	StateDisconnected TunnelState = iota
	StateConnecting
	StateHandshaking
	StateActive
)

func (s TunnelState) String() string {
	switch s {
	case StateDisconnected:
		return "DISCONNECTED"
	case StateConnecting:
		return "CONNECTING"
	case StateHandshaking:
		return "HANDSHAKING"
	case StateActive:
		return "ACTIVE"
	default:
		return "UNKNOWN"
	}
}

func transition(from, to TunnelState) {
	fmt.Printf("[tunnel] %s -> %s\n", from, to)
}

func main() {
	// Start server
	ln, err := net.Listen("tcp", "127.0.0.1:9000")
	if err != nil {
		panic(err)
	}
	defer ln.Close()

	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		fmt.Printf("Server: new control connection from %s\n", conn.RemoteAddr().(*net.TCPAddr).IP)
		conn.Close()
	}()

	time.Sleep(50 * time.Millisecond)

	// Client lifecycle
	state := StateDisconnected

	transition(state, StateConnecting)
	state = StateConnecting

	conn, err := net.Dial("tcp", "127.0.0.1:9000")
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	transition(state, StateHandshaking)
	state = StateHandshaking

	// Simulate handshake
	time.Sleep(10 * time.Millisecond)

	transition(state, StateActive)
	state = StateActive

	time.Sleep(50 * time.Millisecond)
	fmt.Printf("Client: tunnel is %s\n", state)
}
```
