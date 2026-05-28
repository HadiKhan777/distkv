'use strict'

const net                = require('net')
const { RESPParser, R }  = require('./protocol')
const store              = require('./store')
const replication        = require('./replication')

let _wal = null  // injected by index.js after WAL init

function setWAL(wal) { _wal = wal }

function dispatch(args) {
  const cmd = args[0].toUpperCase()

  switch (cmd) {

    case 'PING':
      return args[1] ? R.str(args[1]) : R.pong()

    case 'SET': {
      if (args.length < 3) return R.err('wrong number of arguments for SET')
      const [, k, v] = args
      store.set(k, v)
      _wal && _wal.append('SET', [k, v])
      replication.broadcast(['SET', k, v])
      return R.ok()
    }

    case 'GET':
      if (args.length < 2) return R.err('wrong number of arguments for GET')
      return store.get(args[1]) !== null ? R.str(store.get(args[1])) : R.nil()

    case 'DEL': {
      if (args.length < 2) return R.err('wrong number of arguments for DEL')
      const n = store.del(args[1])
      _wal && _wal.append('DEL', [args[1]])
      replication.broadcast(['DEL', args[1]])
      return R.int(n)
    }

    case 'KEYS':
      return R.arr(store.keys(args[1] || '*'))

    case 'DBSIZE':
      return R.int(store.size())

    case 'FLUSHDB': {
      store.flush()
      _wal && _wal.append('FLUSHDB', [])
      replication.broadcast(['FLUSHDB'])
      return R.ok()
    }

    case 'INFO': {
      const lines = [
        `# Server`,
        `role:${replication.role}`,
        ``,
        `# Stats`,
        `keys:${store.size()}`,
        `ops_total:${store.opsTotal}`,
        `ops_per_sec:${store.opsPerSec()}`,
        `connected_replicas:${replication.replicaCount()}`,
      ]
      return R.str(lines.join('\r\n'))
    }

    case 'COMMAND':
      return R.ok()

    default:
      return R.err(`unknown command '${args[0]}'`)
  }
}

function createTCPServer(port) {
  const server = net.createServer((socket) => {
    const parser = new RESPParser((args) => {
      try {
        socket.write(dispatch(args))
      } catch (e) {
        socket.write(R.err(e.message))
      }
    })

    socket.on('data',  (d) => parser.feed(d.toString()))
    socket.on('error', () => {})
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[tcp]  RESP server on :${port}  (test: redis-cli -p ${port})`)
  })

  return server
}

module.exports = { createTCPServer, setWAL, dispatch }
