'use strict'

const net            = require('net')
const { RESPParser, R } = require('./protocol')

// ── state ──────────────────────────────────────────────────────────────────
let _role         = process.env.ROLE || 'primary'
const _replicas   = new Map()   // id → { socket, connectedAt, bytesRx }
let _replicaSeq   = 0
let _primaryConn  = null

// ── public interface ────────────────────────────────────────────────────────
const replication = {
  get role()         { return _role },
  replicaCount()     { return _replicas.size },
  replicaList()      {
    return [..._replicas.entries()].map(([id, r]) => ({
      id,
      connectedAt: r.connectedAt,
      uptimeMs: Date.now() - r.connectedAt,
    }))
  },

  // Broadcast a write command to all connected replicas.
  broadcast(args) {
    if (_role !== 'primary') return
    const frame = R.cmd(args)
    for (const [id, r] of _replicas) {
      try {
        r.socket.write(frame)
      } catch (_) {
        _replicas.delete(id)
      }
    }
  },

  // Start the replication listener (primary side).
  startListener(port) {
    if (_role !== 'primary') return
    const server = net.createServer((socket) => {
      const id = `replica-${String(++_replicaSeq).padStart(3, '0')}`
      _replicas.set(id, { socket, connectedAt: Date.now() })
      console.log(`[replication] ${id} connected from ${socket.remoteAddress}`)

      // Full sync: send current store snapshot as SET commands.
      const store = require('./store')
      for (const [k, v] of store.entries()) {
        socket.write(R.cmd(['SET', k, v]))
      }

      socket.on('error', () => { _replicas.delete(id); console.log(`[replication] ${id} error`) })
      socket.on('close', () => { _replicas.delete(id); console.log(`[replication] ${id} disconnected`) })
    })
    server.listen(port, () => console.log(`[replication] listener on :${port}`))
  },

  // Connect to primary (replica side).
  connectToPrimary(host, replPort) {
    _role = 'replica'
    const store = require('./store')
    const WAL   = require('./wal')
    const wal   = new WAL('./data-replica')

    let retryMs = 1000
    function connect() {
      _primaryConn = net.createConnection(replPort, host, () => {
        console.log(`[replication] connected to primary ${host}:${replPort}`)
        retryMs = 1000
      })

      const parser = new RESPParser((args) => {
        const cmd = args[0].toUpperCase()
        if      (cmd === 'SET') { store.set(args[1], args[2]); wal.append('SET', [args[1], args[2]]) }
        else if (cmd === 'DEL') { store.del(args[1]);           wal.append('DEL', [args[1]]) }
      })

      _primaryConn.on('data',  (d) => parser.feed(d.toString()))
      _primaryConn.on('error', () => {
        console.log(`[replication] primary error — retry in ${retryMs}ms`)
        setTimeout(connect, retryMs)
        retryMs = Math.min(retryMs * 2, 30_000)
      })
      _primaryConn.on('close', () => {
        console.log(`[replication] primary closed — retry in ${retryMs}ms`)
        setTimeout(connect, retryMs)
      })
    }
    connect()
  },
}

module.exports = replication
