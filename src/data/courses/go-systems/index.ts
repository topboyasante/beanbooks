import type { Course } from "@/types/learning"
import { parseLesson } from "@/lib/parse-lesson"

// Module 1: Go Fundamentals
import variablesAndTypesRaw from "./lessons/go-fundamentals/variables-and-types.md?raw"
import functionsRaw from "./lessons/go-fundamentals/functions.md?raw"
import structsRaw from "./lessons/go-fundamentals/structs.md?raw"
import interfacesRaw from "./lessons/go-fundamentals/interfaces.md?raw"
import errorHandlingRaw from "./lessons/go-fundamentals/error-handling.md?raw"

// Module 2: Concurrency
import goroutinesRaw from "./lessons/concurrency/goroutines.md?raw"
import channelsRaw from "./lessons/concurrency/channels.md?raw"
import selectStatementRaw from "./lessons/concurrency/select-statement.md?raw"
import syncPrimitivesRaw from "./lessons/concurrency/sync-primitives.md?raw"
import concurrencyPatternsRaw from "./lessons/concurrency/concurrency-patterns.md?raw"

// Module 3: Networking
import tcpServerRaw from "./lessons/networking/tcp-server.md?raw"
import tcpClientRaw from "./lessons/networking/tcp-client.md?raw"
import udpRaw from "./lessons/networking/udp.md?raw"
import httpFromScratchRaw from "./lessons/networking/http-from-scratch.md?raw"
import dnsResolverRaw from "./lessons/networking/dns-resolver.md?raw"

// Module 4: I/O & File Systems
import readersWritersRaw from "./lessons/io-filesystems/readers-and-writers.md?raw"
import buffersRaw from "./lessons/io-filesystems/buffers.md?raw"
import fileOperationsRaw from "./lessons/io-filesystems/file-operations.md?raw"
import streamingRaw from "./lessons/io-filesystems/streaming.md?raw"

// Module 5: TCP Tunnel
import tunnelArchitectureRaw from "./lessons/tcp-tunnel/tunnel-architecture.md?raw"
import clientServerHandshakeRaw from "./lessons/tcp-tunnel/client-server-handshake.md?raw"
import multiplexingRaw from "./lessons/tcp-tunnel/multiplexing.md?raw"
import reconnectionRaw from "./lessons/tcp-tunnel/reconnection.md?raw"

// Module 6: Storage Engines
import kvStoreRaw from "./lessons/storage-engines/key-value-store.md?raw"
import btreesRaw from "./lessons/storage-engines/btrees.md?raw"
import lsmTreesRaw from "./lessons/storage-engines/lsm-trees.md?raw"
import walRaw from "./lessons/storage-engines/write-ahead-log.md?raw"
import compactionRaw from "./lessons/storage-engines/compaction.md?raw"

// Module 7: Protocols & Serialization
import binaryEncodingRaw from "./lessons/protocols-serialization/binary-encoding.md?raw"
import wireProtocolRaw from "./lessons/protocols-serialization/wire-protocol.md?raw"
import framingRaw from "./lessons/protocols-serialization/framing.md?raw"
import checksumsRaw from "./lessons/protocols-serialization/checksums.md?raw"

// Module 8: Systems Patterns
import connectionPoolsRaw from "./lessons/systems-patterns/connection-pools.md?raw"
import rateLimitersRaw from "./lessons/systems-patterns/rate-limiters.md?raw"
import gracefulShutdownRaw from "./lessons/systems-patterns/graceful-shutdown.md?raw"
import workerPoolsRaw from "./lessons/systems-patterns/worker-pools.md?raw"

// Module 9: Testing Systems Code
import tableDrivenTestsRaw from "./lessons/testing-systems/table-driven-tests.md?raw"
import benchmarksRaw from "./lessons/testing-systems/benchmarks.md?raw"
import raceDetectionRaw from "./lessons/testing-systems/race-detection.md?raw"
import integrationTestsRaw from "./lessons/testing-systems/integration-tests.md?raw"

// Module 10: Capstone
import capstoneProjectRaw from "./lessons/capstone/capstone-project.md?raw"

export const goSystemsCourse: Course = {
  id: "go-systems",
  title: "Go for Low-Level Systems",
  description:
    "Learn Go by building real infrastructure tools — TCP tunnels, storage engines, and network protocols.",
  icon: "server",
  scenarioLabel: "Systems Scenario",
  scenarioIcon: "server",
  modules: [
    {
      id: "go-fundamentals",
      title: "Go Fundamentals",
      description:
        "Master Go's syntax, types, structs, interfaces, and error handling.",
      icon: "code-2",
      lessons: [
        parseLesson(variablesAndTypesRaw),
        parseLesson(functionsRaw),
        parseLesson(structsRaw),
        parseLesson(interfacesRaw),
        parseLesson(errorHandlingRaw),
      ],
    },
    {
      id: "concurrency",
      title: "Concurrency",
      description:
        "Goroutines, channels, select statements, and sync primitives.",
      icon: "zap",
      lessons: [
        parseLesson(goroutinesRaw),
        parseLesson(channelsRaw),
        parseLesson(selectStatementRaw),
        parseLesson(syncPrimitivesRaw),
        parseLesson(concurrencyPatternsRaw),
      ],
    },
    {
      id: "networking",
      title: "Networking",
      description:
        "Build TCP/UDP servers, HTTP from scratch, and DNS resolvers.",
      icon: "server",
      lessons: [
        parseLesson(tcpServerRaw),
        parseLesson(tcpClientRaw),
        parseLesson(udpRaw),
        parseLesson(httpFromScratchRaw),
        parseLesson(dnsResolverRaw),
      ],
    },
    {
      id: "io-filesystems",
      title: "I/O & File Systems",
      description:
        "Readers, writers, buffers, streaming, and file operations.",
      icon: "cpu",
      lessons: [
        parseLesson(readersWritersRaw),
        parseLesson(buffersRaw),
        parseLesson(fileOperationsRaw),
        parseLesson(streamingRaw),
      ],
    },
    {
      id: "tcp-tunnel",
      title: "TCP Tunnel (ngrok-style)",
      description:
        "Build a working TCP tunnel with multiplexing and reconnection.",
      icon: "rocket",
      lessons: [
        parseLesson(tunnelArchitectureRaw),
        parseLesson(clientServerHandshakeRaw),
        parseLesson(multiplexingRaw),
        parseLesson(reconnectionRaw),
      ],
    },
    {
      id: "storage-engines",
      title: "Storage Engines",
      description:
        "Key-value stores, B-trees, LSM trees, and write-ahead logs.",
      icon: "boxes",
      lessons: [
        parseLesson(kvStoreRaw),
        parseLesson(btreesRaw),
        parseLesson(lsmTreesRaw),
        parseLesson(walRaw),
        parseLesson(compactionRaw),
      ],
    },
    {
      id: "protocols-serialization",
      title: "Protocols & Serialization",
      description:
        "Binary encoding, custom wire protocols, framing, and checksums.",
      icon: "git-branch",
      lessons: [
        parseLesson(binaryEncodingRaw),
        parseLesson(wireProtocolRaw),
        parseLesson(framingRaw),
        parseLesson(checksumsRaw),
      ],
    },
    {
      id: "systems-patterns",
      title: "Systems Patterns",
      description:
        "Connection pools, rate limiters, graceful shutdown, and worker pools.",
      icon: "leaf",
      lessons: [
        parseLesson(connectionPoolsRaw),
        parseLesson(rateLimitersRaw),
        parseLesson(gracefulShutdownRaw),
        parseLesson(workerPoolsRaw),
      ],
    },
    {
      id: "testing-systems",
      title: "Testing Systems Code",
      description:
        "Table-driven tests, benchmarks, race detection, and integration testing.",
      icon: "test-tube",
      lessons: [
        parseLesson(tableDrivenTestsRaw),
        parseLesson(benchmarksRaw),
        parseLesson(raceDetectionRaw),
        parseLesson(integrationTestsRaw),
      ],
    },
    {
      id: "go-capstone",
      title: "Capstone Project",
      description:
        "Build a complete systems tool combining everything you've learned.",
      icon: "trophy",
      lessons: [parseLesson(capstoneProjectRaw)],
    },
  ],
}
