'use strict'

const http        = require('http')
const store       = require('./store')
const replication = require('./replication')
const { dispatch } = require('./tcp')

const START_TIME = Date.now()

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'Content-Type',
  })
  res.end(JSON.stringify(data))
}

function createHTTPServer(port) {
  const server = http.createServer((req, res) => {

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' })
      return res.end()
    }

    const url = req.url.split('?')[0]

    // GET /metrics  — dashboard polling
    if (req.method === 'GET' && url === '/metrics') {
      return json(res, {
        role:            replication.role,
        keys:            store.size(),
        ops_total:       store.opsTotal,
        ops_per_sec:     store.opsPerSec(),
        uptime_seconds:  Math.floor((Date.now() - START_TIME) / 1000),
        memory_mb:       (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        replicas:        replication.replicaList(),
      })
    }

    // POST /command  — dashboard terminal
    if (req.method === 'POST' && url === '/command') {
      let body = ''
      req.on('data', d => body += d)
      req.on('end', () => {
        try {
          const { args } = JSON.parse(body)
          if (!Array.isArray(args) || args.length === 0) return json(res, { error: 'args required' }, 400)
          const raw = dispatch(args.map(String))
          // Strip RESP framing for human-readable response
          const readable = raw
            .replace(/^\+/, '')
            .replace(/^-ERR /, 'ERR: ')
            .replace(/^\$-1\r\n$/, '(nil)')
            .replace(/^\$\d+\r\n/, '')
            .replace(/\r\n$/, '')
          json(res, { raw, result: readable })
        } catch (e) {
          json(res, { error: e.message }, 400)
        }
      })
      return
    }

    // GET /health
    if (req.method === 'GET' && url === '/health') {
      return json(res, { status: 'ok', uptime: Date.now() - START_TIME })
    }

    json(res, { error: 'not found' }, 404)
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[http] metrics on :${port}  (GET /metrics · POST /command)`)
  })

  return server
}

module.exports = { createHTTPServer }
