# DistKV

A distributed key-value store built from scratch in Node.js — no dependencies on the server side.

## What it does

- **RESP protocol** — wire-compatible with `redis-cli`
- **Write-ahead log** — survives hard crashes (`SIGKILL`), replays on restart
- **Primary/replica replication** — full sync on connect, live command stream
- **HTTP metrics API** — polled by the dashboard every second
- **React + Three.js dashboard** — live cluster visualization, REPL terminal, stats panel

## Benchmark results (50k ops, pipeline=64)

| Test | Throughput | Latency |
|---|---|---|
| PING (protocol ceiling) | 19,312 ops/sec | 52 μs |
| SET → primary (WAL + 5 replicas) | 7,240 ops/sec | 138 μs |
| GET → primary | 11,457 ops/sec | 87 μs |
| GET → replica (idle) | 17,271 ops/sec | 58 μs |

## Quick start

```bash
# Start primary
cd server && node index.js

# Start a replica (new terminal)
PORT=7389 METRICS_PORT=7390 ROLE=replica PRIMARY_HOST=127.0.0.1 node index.js

# Start dashboard
cd dashboard && npm install && npm run dev

# Test with redis-cli
redis-cli -p 7379 SET foo bar
redis-cli -p 7379 GET foo
```

## Architecture

```
server/
  index.js        entry point — starts TCP + HTTP + replication
  store.js        thread-safe HashMap with sliding ops/sec window
  wal.js          append-only write-ahead log, synchronous flush
  protocol.js     RESP2 parser + response builders
  tcp.js          TCP server + command dispatcher
  http.js         /metrics and /command HTTP endpoints
  replication.js  primary listener + replica connector with backoff
  bench.js        pipelined RESP benchmark (SET / GET / PING)

dashboard/        React 19 + Vite + React Three Fiber
  src/
    components/r3f/ClusterScene.jsx   Three.js cluster visualization
    components/Terminal.jsx           live REPL
    components/StatsPanel.jsx         metrics + replica list
    hooks/useMetrics.js               1-second polling hook
```

## Key design decisions

**Sync WAL on primary, async fan-out to replicas.** Each write is flushed to disk before ACK. Replica sockets receive the command asynchronously — the primary does not wait for replica confirmation (async replication, same model as Redis).

**Full sync on replica connect.** When a replica connects, the primary streams all current key-value pairs as SET commands before switching to live replication. No snapshot file needed.

**Exponential backoff reconnect.** Replicas retry with 1s → 30s backoff on primary disconnect. The primary re-sends the full snapshot on every reconnect.
