'use strict'

const fs   = require('fs')
const path = require('path')

// Append-only write-ahead log.
// Each entry is a newline-delimited JSON record: { ts, cmd, args }
// On startup we replay all entries to restore state.
class WAL {
  constructor(dir) {
    this.file = path.join(dir, 'wal.log')
    fs.mkdirSync(dir, { recursive: true })
    this._fd = fs.openSync(this.file, 'a')
  }

  // Synchronous append — durability before ACK.
  append(cmd, args) {
    const line = JSON.stringify({ ts: Date.now(), cmd, args }) + '\n'
    fs.writeSync(this._fd, line)
  }

  // Returns count of entries replayed.
  replay(store) {
    if (!fs.existsSync(this.file)) return 0
    const lines = fs.readFileSync(this.file, 'utf8').split('\n').filter(Boolean)
    let count = 0
    for (const line of lines) {
      try {
        const { cmd, args } = JSON.parse(line)
        if      (cmd === 'SET')     store.set(args[0], args[1])
        else if (cmd === 'DEL')     store.del(args[0])
        else if (cmd === 'FLUSHDB') store.flush()
        count++
      } catch (_) { /* skip corrupt entry */ }
    }
    return count
  }

  close() {
    try { fs.closeSync(this._fd) } catch (_) {}
  }
}

module.exports = WAL
