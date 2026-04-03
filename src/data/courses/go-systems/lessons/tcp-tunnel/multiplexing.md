---
id: "go-tunnel-multiplexing"
courseId: "go-systems"
moduleId: "tcp-tunnel"
title: "Multiplexing"
description: "Handle multiple simultaneous connections through a single tunnel using stream multiplexing."
order: 3
---

## Scenario

Your tunnel is working -- a single user can connect through it and reach your local service. But what happens when ten users connect simultaneously? You cannot open a new control connection for each one. Instead, you need to multiplex: carry multiple logical streams over the single TCP connection between the server and client, tagging each chunk of data with a stream ID so both sides know which connection it belongs to.

This is the same problem HTTP/2 solves with stream multiplexing, and the same pattern used by SSH, QUIC, and gRPC. In this lesson, you will build a multiplexer that assigns stream IDs, frames data with headers, and manages concurrent streams using goroutines and channels.

## Content

## Multiplexing

### Why Multiplexing Is Necessary

Without multiplexing, each public connection through the tunnel requires a separate TCP connection between the server and the client. This creates several problems:

- **Connection overhead** -- TCP handshakes and TLS negotiations for each new stream
- **Port exhaustion** -- operating systems limit the number of open connections
- **Coordination complexity** -- matching each data connection back to the right control session

Multiplexing solves all of these by carrying many logical streams inside one physical connection.

### Frame Header Design

Every chunk of data needs a header that identifies which stream it belongs to and how many bytes follow:

```go
package mux

import (
	"encoding/binary"
	"io"
	"net"
)

// FrameHeader is 9 bytes: 4 for stream ID, 1 for flags, 4 for length
type FrameHeader struct {
	StreamID uint32
	Flags    byte
	Length   uint32
}

const (
	FlagData     byte = 0x00
	FlagOpen     byte = 0x01
	FlagClose    byte = 0x02
	FlagReset    byte = 0x03
	HeaderSize        = 9
)

func (h FrameHeader) Encode() []byte {
	buf := make([]byte, HeaderSize)
	binary.BigEndian.PutUint32(buf[0:4], h.StreamID)
	buf[4] = h.Flags
	binary.BigEndian.PutUint32(buf[5:9], h.Length)
	return buf
}

func DecodeHeader(buf []byte) FrameHeader {
	return FrameHeader{
		StreamID: binary.BigEndian.Uint32(buf[0:4]),
		Flags:    buf[4],
		Length:   binary.BigEndian.Uint32(buf[5:9]),
	}
}

// WriteFrame sends a framed message with stream ID
func WriteFrame(conn net.Conn, streamID uint32, flags byte, data []byte) error {
	header := FrameHeader{
		StreamID: streamID,
		Flags:    flags,
		Length:   uint32(len(data)),
	}
	if _, err := conn.Write(header.Encode()); err != nil {
		return err
	}
	if len(data) > 0 {
		if _, err := conn.Write(data); err != nil {
			return err
		}
	}
	return nil
}

// ReadFrame reads a single framed message
func ReadFrame(conn net.Conn) (FrameHeader, []byte, error) {
	headerBuf := make([]byte, HeaderSize)
	if _, err := io.ReadFull(conn, headerBuf); err != nil {
		return FrameHeader{}, nil, err
	}

	header := DecodeHeader(headerBuf)

	var data []byte
	if header.Length > 0 {
		data = make([]byte, header.Length)
		if _, err := io.ReadFull(conn, data); err != nil {
			return FrameHeader{}, nil, err
		}
	}

	return header, data, nil
}
```

### The Stream Abstraction

Each logical connection becomes a "stream" with its own read buffer. Streams are identified by a numeric ID and managed by the multiplexer:

```go
package mux

import (
	"errors"
	"sync"
)

// Stream represents a single logical connection within the multiplexed tunnel
type Stream struct {
	ID     uint32
	readCh chan []byte // incoming data arrives here
	mux    *Multiplexer
	closed bool
	mu     sync.Mutex
}

func newStream(id uint32, m *Multiplexer) *Stream {
	return &Stream{
		ID:     id,
		readCh: make(chan []byte, 64), // buffered channel for incoming data
		mux:    m,
	}
}

// Read receives data from the stream's channel
func (s *Stream) Read() ([]byte, error) {
	data, ok := <-s.readCh
	if !ok {
		return nil, errors.New("stream closed")
	}
	return data, nil
}

// Write sends data through the multiplexer tagged with this stream's ID
func (s *Stream) Write(data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return errors.New("stream closed")
	}
	return s.mux.writeToConn(s.ID, FlagData, data)
}

// Close signals the remote side that this stream is done
func (s *Stream) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true
	close(s.readCh)
	return s.mux.writeToConn(s.ID, FlagClose, nil)
}
```

### The Multiplexer

The multiplexer sits on top of a single TCP connection and routes frames to the appropriate streams:

```go
package mux

import (
	"fmt"
	"net"
	"sync"
	"sync/atomic"
)

// Multiplexer manages multiple streams over a single TCP connection
type Multiplexer struct {
	conn     net.Conn
	streams  map[uint32]*Stream
	mu       sync.RWMutex
	nextID   uint32
	writeMu  sync.Mutex
	acceptCh chan *Stream // new streams from the remote side
}

func NewMultiplexer(conn net.Conn, isServer bool) *Multiplexer {
	m := &Multiplexer{
		conn:     conn,
		streams:  make(map[uint32]*Stream),
		acceptCh: make(chan *Stream, 16),
	}
	// Servers use even IDs, clients use odd IDs to avoid collisions
	if isServer {
		m.nextID = 2
	} else {
		m.nextID = 1
	}
	return m
}

// OpenStream creates a new outgoing stream
func (m *Multiplexer) OpenStream() (*Stream, error) {
	id := atomic.AddUint32(&m.nextID, 2) - 2

	s := newStream(id, m)
	m.mu.Lock()
	m.streams[id] = s
	m.mu.Unlock()

	// Send OPEN frame to notify remote side
	if err := m.writeToConn(id, FlagOpen, nil); err != nil {
		return nil, err
	}

	fmt.Printf("[mux] opened stream %d\n", id)
	return s, nil
}

// AcceptStream waits for a new incoming stream from the remote side
func (m *Multiplexer) AcceptStream() (*Stream, error) {
	s, ok := <-m.acceptCh
	if !ok {
		return nil, fmt.Errorf("multiplexer closed")
	}
	return s, nil
}

// writeToConn sends a frame over the underlying connection (thread-safe)
func (m *Multiplexer) writeToConn(streamID uint32, flags byte, data []byte) error {
	m.writeMu.Lock()
	defer m.writeMu.Unlock()
	return WriteFrame(m.conn, streamID, flags, data)
}

// Serve reads frames from the connection and dispatches them to streams
func (m *Multiplexer) Serve() error {
	for {
		header, data, err := ReadFrame(m.conn)
		if err != nil {
			return fmt.Errorf("read frame: %w", err)
		}

		switch header.Flags {
		case FlagOpen:
			s := newStream(header.StreamID, m)
			m.mu.Lock()
			m.streams[header.StreamID] = s
			m.mu.Unlock()
			m.acceptCh <- s
			fmt.Printf("[mux] accepted stream %d\n", header.StreamID)

		case FlagData:
			m.mu.RLock()
			s, exists := m.streams[header.StreamID]
			m.mu.RUnlock()
			if exists && !s.closed {
				s.readCh <- data
			}

		case FlagClose:
			m.mu.Lock()
			s, exists := m.streams[header.StreamID]
			if exists {
				s.closed = true
				close(s.readCh)
				delete(m.streams, header.StreamID)
			}
			m.mu.Unlock()
			fmt.Printf("[mux] closed stream %d\n", header.StreamID)

		case FlagReset:
			m.mu.Lock()
			s, exists := m.streams[header.StreamID]
			if exists {
				s.closed = true
				close(s.readCh)
				delete(m.streams, header.StreamID)
			}
			m.mu.Unlock()
			fmt.Printf("[mux] reset stream %d\n", header.StreamID)
		}
	}
}
```

### Concurrent Stream Handling

The power of multiplexing is handling many streams simultaneously. Each stream runs in its own goroutine, but all share the same TCP connection:

```go
package mux

import (
	"fmt"
	"net"
	"sync"
)

// HandleTunnelStreams shows how the tunnel client manages multiple
// concurrent streams from the server
func HandleTunnelStreams(tunnelConn net.Conn, localAddr string) {
	m := NewMultiplexer(tunnelConn, false)

	go m.Serve()

	var wg sync.WaitGroup

	for {
		stream, err := m.AcceptStream()
		if err != nil {
			fmt.Println("accept stream error:", err)
			break
		}

		wg.Add(1)
		go func(s *Stream) {
			defer wg.Done()
			defer s.Close()

			// Connect to the local service
			localConn, err := net.Dial("tcp", localAddr)
			if err != nil {
				fmt.Printf("[stream %d] failed to connect to local: %v\n", s.ID, err)
				return
			}
			defer localConn.Close()

			// Bidirectional proxy between stream and local connection
			done := make(chan struct{}, 2)

			// Stream -> Local
			go func() {
				for {
					data, err := s.Read()
					if err != nil {
						break
					}
					localConn.Write(data)
				}
				done <- struct{}{}
			}()

			// Local -> Stream
			go func() {
				buf := make([]byte, 32*1024)
				for {
					n, err := localConn.Read(buf)
					if err != nil {
						break
					}
					s.Write(buf[:n])
				}
				done <- struct{}{}
			}()

			<-done
		}(stream)
	}

	wg.Wait()
}
```

### Stream ID Allocation Strategy

Using odd/even stream IDs avoids collisions when both sides can create streams:

```go
package mux

import "fmt"

// Demonstrate ID allocation
func ExplainIDAllocation() {
	// Client-initiated streams: 1, 3, 5, 7, ...
	// Server-initiated streams: 2, 4, 6, 8, ...
	//
	// This is the same strategy used by HTTP/2:
	// - Client uses odd stream IDs
	// - Server uses even stream IDs
	// - Stream 0 is reserved for the connection itself

	fmt.Println("Client streams: 1, 3, 5, 7, ...")
	fmt.Println("Server streams: 2, 4, 6, 8, ...")
	fmt.Println("No coordination needed -- no collisions possible")
}
```

## Why It Matters

Multiplexing is one of the most important patterns in systems programming. HTTP/2 multiplexes requests over a single TCP connection. SSH multiplexes shell sessions, port forwards, and file transfers. gRPC multiplexes RPC calls. Understanding how to build a multiplexer -- assigning stream IDs, framing data with headers, dispatching frames to the right handler -- equips you to work with (or build) any protocol that needs to carry multiple conversations over a single connection.

## Questions

Q: Why do servers use even stream IDs and clients use odd stream IDs?
A) Even numbers are faster to process on server hardware
B) It prevents ID collisions without requiring coordination between the two sides
C) The TCP protocol requires even-numbered streams for servers
D) It makes load balancing easier across multiple servers
Correct: B

Q: What problem does the `writeMu` mutex in the Multiplexer solve?
A) It prevents two goroutines from reading the same stream simultaneously
B) It prevents concurrent writes from interleaving frame bytes on the shared TCP connection
C) It ensures streams are opened in sequential order
D) It limits the total number of active streams
Correct: B

Q: When the multiplexer receives a frame with `FlagClose`, what must it do?
A) Send a RST packet to the operating system
B) Close the underlying TCP connection entirely
C) Close the stream's read channel and remove it from the stream map
D) Reopen the stream with a new ID
Correct: C

## Challenge

Build a simple multiplexer that opens 3 streams over a single TCP connection. Each stream sends a unique message, and the receiving side prints which stream each message came from.

## Starter Code

```go
package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"time"
)

const headerSize = 8 // 4 bytes stream ID + 4 bytes length

func writeFrame(conn net.Conn, streamID uint32, data []byte) error {
	// TODO: Write 4-byte stream ID + 4-byte length + data
	return nil
}

func readFrame(conn net.Conn) (uint32, []byte, error) {
	// TODO: Read stream ID, length, then data
	return 0, nil, nil
}

func main() {
	// TODO: Start server, open 3 streams from client, send a
	// message on each, print received messages with stream IDs
}
```

## Expected Output

```
[stream 1] Hello from stream 1
[stream 2] Hello from stream 2
[stream 3] Hello from stream 3
```

## Hint

Use `binary.BigEndian.PutUint32` for both the stream ID and the length. On the server side, read frames in a loop and use the stream ID from each frame header to print which stream the message came from.

## Solution

```go
package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"sync"
	"time"
)

const headerSize = 8

func writeFrame(conn net.Conn, streamID uint32, data []byte) error {
	header := make([]byte, headerSize)
	binary.BigEndian.PutUint32(header[0:4], streamID)
	binary.BigEndian.PutUint32(header[4:8], uint32(len(data)))
	if _, err := conn.Write(header); err != nil {
		return err
	}
	_, err := conn.Write(data)
	return err
}

func readFrame(conn net.Conn) (uint32, []byte, error) {
	header := make([]byte, headerSize)
	if _, err := io.ReadFull(conn, header); err != nil {
		return 0, nil, err
	}
	streamID := binary.BigEndian.Uint32(header[0:4])
	length := binary.BigEndian.Uint32(header[4:8])
	data := make([]byte, length)
	if _, err := io.ReadFull(conn, data); err != nil {
		return 0, nil, err
	}
	return streamID, data, nil
}

func main() {
	ln, err := net.Listen("tcp", "127.0.0.1:9002")
	if err != nil {
		panic(err)
	}
	defer ln.Close()

	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()

		for i := 0; i < 3; i++ {
			streamID, data, err := readFrame(conn)
			if err != nil {
				fmt.Println("read error:", err)
				return
			}
			fmt.Printf("[stream %d] %s\n", streamID, string(data))
		}
	}()

	time.Sleep(50 * time.Millisecond)

	conn, err := net.Dial("tcp", "127.0.0.1:9002")
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	for i := uint32(1); i <= 3; i++ {
		msg := fmt.Sprintf("Hello from stream %d", i)
		writeFrame(conn, i, []byte(msg))
	}

	wg.Wait()
}
```
