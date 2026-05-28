'use strict'

const { createTCPServer, setWAL } = require('./tcp')
const { createHTTPServer }        = require('./http')
const replication                 = require('./replication')
const WAL                         = require('./wal')
const store                       = require('./store')

const TCP_PORT     = parseInt(process.env.PORT,         10) || 7379
const METRICS_PORT = parseInt(process.env.METRICS_PORT, 10) || 7380
const REPL_PORT    = parseInt(process.env.REPL_PORT,    10) || 7381
const ROLE         = replication.role

// ── WAL replay ─────────────────────────────────────────────────────────────
const walDir = ROLE === 'primary' ? './data' : './data-replica'
const wal    = new WAL(walDir)
setWAL(wal)

const replayed = wal.replay(store)
if (replayed > 0) console.log(`[wal]  replayed ${replayed} entries from ${walDir}/wal.log`)

// ── Start servers ──────────────────────────────────────────────────────────
console.log(`\n  DistKV  [${ROLE.toUpperCase()}]\n`)

createTCPServer(TCP_PORT)
createHTTPServer(METRICS_PORT)

if (ROLE === 'primary') {
  replication.startListener(REPL_PORT)
} else {
  const host = process.env.PRIMARY_HOST || '127.0.0.1'
  replication.connectToPrimary(host, REPL_PORT)
}

console.log(`
  ┌───────────────────────────────────────────────────┐
  │  TCP  (RESP)   →  localhost:${TCP_PORT}                 │
  │  HTTP metrics  →  localhost:${METRICS_PORT}                 │
  │  Replication   →  localhost:${REPL_PORT}                 │
  ├───────────────────────────────────────────────────┤
  │  redis-cli -p ${TCP_PORT}                              │
  │  curl localhost:${METRICS_PORT}/metrics                    │
  └───────────────────────────────────────────────────┘
`)

// ── Graceful shutdown ──────────────────────────────────────────────────────
process.on('SIGINT',  () => { wal.close(); process.exit(0) })
process.on('SIGTERM', () => { wal.close(); process.exit(0) })
