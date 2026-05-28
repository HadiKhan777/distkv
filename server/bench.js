'use strict'
// Pipelined RESP benchmark — SET, GET, or PING.
// Usage: node bench.js [host] [port] [total] [pipeline] [cmd]
//   cmd: set | get | ping  (default: set)

const net = require('net')

const HOST     = process.argv[2] || '127.0.0.1'
const PORT     = parseInt(process.argv[3], 10) || 7379
const TOTAL    = parseInt(process.argv[4], 10) || 50_000
const PIPELINE = parseInt(process.argv[5], 10) || 64
const CMD      = (process.argv[6] || 'set').toLowerCase()

// ── Command builders ────────────────────────────────────────────────────────
function buildCmd(i) {
  switch (CMD) {
    case 'set':  return `*3\r\n$3\r\nSET\r\n$${`b:${i}`.length}\r\nb:${i}\r\n$${`v${i}`.length}\r\nv${i}\r\n`
    case 'get':  return `*2\r\n$3\r\nGET\r\n$${`b:${i%50000}`.length}\r\nb:${i%50000}\r\n`
    case 'ping': return `*1\r\n$4\r\nPING\r\n`
    default:     throw new Error(`unknown cmd: ${CMD}`)
  }
}

// ── RESP response counter ────────────────────────────────────────────────────
// Properly skip multi-line bulk strings instead of counting raw \r\n.
function countResponses(buf) {
  let count = 0
  let i     = 0
  while (i < buf.length) {
    const nl = buf.indexOf('\r\n', i)
    if (nl === -1) break
    const line = buf.slice(i, nl)
    i = nl + 2

    if (line[0] === '+' || line[0] === '-' || line[0] === ':') {
      count++                               // simple string / error / integer
    } else if (line[0] === '$') {
      const len = parseInt(line.slice(1), 10)
      if (len === -1) { count++; continue } // nil bulk
      i += len + 2                          // skip data + trailing \r\n
      count++
    } else if (line[0] === '*') {
      // Not expected in benchmark responses but handle gracefully
    }
  }
  return { count, remaining: buf.slice(i) }
}

// ── Main ────────────────────────────────────────────────────────────────────
const socket = net.createConnection(PORT, HOST)
let sent = 0, acked = 0, inflight = 0, startedAt = 0, rawBuf = ''

socket.on('connect', () => {
  startedAt = Date.now()
  console.log(`\n  cmd=${CMD.toUpperCase()}  host=${HOST}:${PORT}  total=${TOTAL.toLocaleString()}  pipeline=${PIPELINE}\n`)
  pump()
})

function pump() {
  while (inflight < PIPELINE && sent < TOTAL) {
    socket.write(buildCmd(sent++))
    inflight++
  }
}

socket.on('data', (chunk) => {
  rawBuf += chunk.toString()
  const { count, remaining } = countResponses(rawBuf)
  rawBuf  = remaining
  acked  += count
  inflight -= count
  if (acked >= TOTAL) return done()
  pump()
})

function done() {
  const elapsed    = (Date.now() - startedAt) / 1000
  const opsPerSec  = Math.round(TOTAL / elapsed)
  const latencyUs  = Math.round((elapsed / TOTAL) * 1_000_000)
  console.log('  ' + '─'.repeat(40))
  console.log(`  Completed   ${TOTAL.toLocaleString()} ops`)
  console.log(`  Elapsed     ${elapsed.toFixed(3)} s`)
  console.log(`  Throughput  ${opsPerSec.toLocaleString()} ops/sec`)
  console.log(`  Avg latency ${latencyUs} μs / op`)
  console.log('  ' + '─'.repeat(40) + '\n')
  socket.destroy()
}

socket.on('error', (e) => { console.error('ERR:', e.message); process.exit(1) })
