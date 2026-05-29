# DistKV

[hadikhan777.github.io/portfolio](https://hadikhan777.github.io/portfolio/)

Distributed key-value store built from scratch in Node.js — no server-side dependencies.

Implements the core of a production KV store: custom TCP protocol, write-ahead log, replication, and a browser dashboard.

## Features

**Protocol**
- Custom RESP-like TCP protocol (Redis-compatible subset)
- Pipelined requests — up to 19,312 ops/sec on PING, 7,240 ops/sec on SET with replication
- `SET`, `GET`, `DEL`, `KEYS`, `DBSIZE`, `FLUSHDB`, `INFO`, `PING`

**Persistence**
- Write-ahead log (WAL) — every mutation flushed to `./data/wal.log` before acknowledgement
- WAL replay on restart — survives `SIGKILL -9`, replays all entries on boot
- Verified: kill primary mid-run, restart, keys are fully restored

**Replication**
- Primary/replica architecture — replicas connect to primary over TCP
- Full sync on connect — replica receives all existing keys on join
- Streaming replication — every SET/DEL forwarded to all connected replicas in real-time
- Supports multiple replicas simultaneously

**Dashboard** (`localhost:5175`)
- Live cluster visualisation — nodes rendered as orbiting circles with particle streams
- Terminal widget — send commands directly from the browser
- Real-time ops/sec and key count metrics

## Quick start

```bash
# Start primary (port 7379) + dashboard (port 5175)
cd portfolio-2 && npm run dev   # or start the dashboard separately
node server.js                  # primary KV server

# Add a replica
node server.js --replica --primary-port 7379 --port 7380

# Connect with redis-cli
redis-cli -p 7379 SET user:1 '{"name":"hadi"}'
redis-cli -p 7379 GET user:1
redis-cli -p 7379 KEYS user:*
redis-cli -p 7379 INFO
```

## Benchmark results

Measured with a custom pipelined TCP benchmarker (pipeline depth = 64, 50,000 ops each):

| Operation | Throughput | Latency | Notes |
|-----------|-----------|---------|-------|
| PING → primary | **19,312 ops/sec** | 52 μs | Protocol ceiling, no storage |
| SET → primary | **7,240 ops/sec** | 138 μs | WAL write + fan-out to 5 replicas |
| GET → primary | **11,457 ops/sec** | 87 μs | Read-only, no replication |

## WAL persistence test

```
Before kill:  21 keys, 23 WAL entries flushed to disk
Kill method:  SIGKILL -9 (hard crash, no graceful shutdown)
Restart:      replayed 23 entries from ./data/wal.log
Keys after:   21 — exact match
```

## Architecture

```
Client (TCP)
    │
    ▼
Primary Server
├── Command parser (RESP-like framing)
├── In-memory store (Map)
├── WAL writer (append-only log file)
└── Replication broadcaster
         │
         ├── replica-001 (TCP)
         ├── replica-002 (TCP)
         └── replica-00N (TCP)
```
