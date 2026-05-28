'use strict'

// Subset of RESP2 (Redis Serialization Protocol).
// Compatible with redis-cli: redis-cli -p 7379
//
// Parser handles:
//   *<n>\r\n   array (standard RESP command)
//   inline     space-separated (netcat / telnet testing)

class RESPParser {
  constructor(onCommand) {
    this.buf       = ''
    this.onCommand = onCommand
  }

  feed(chunk) {
    this.buf += chunk
    this._drain()
  }

  _drain() {
    while (this.buf.length > 0) {
      const cmd = this.buf[0] === '*' ? this._parseArray() : this._parseInline()
      if (cmd === null) break
      if (cmd.length > 0) this.onCommand(cmd)
    }
  }

  _parseInline() {
    const nl = this.buf.indexOf('\n')
    if (nl === -1) return null
    const line = this.buf.slice(0, nl).replace(/\r$/, '').trim()
    this.buf = this.buf.slice(nl + 1)
    return line ? line.split(/\s+/) : []
  }

  _parseArray() {
    const parts = this.buf.split('\r\n')
    let i = 0
    if (!parts[i] || !parts[i].startsWith('*')) return null
    const n = parseInt(parts[i].slice(1), 10)
    i++

    const args = []
    for (let j = 0; j < n; j++) {
      if (i >= parts.length || !parts[i].startsWith('$')) return null
      const len = parseInt(parts[i].slice(1), 10)
      i++
      if (i >= parts.length) return null
      args.push(parts[i].slice(0, len))
      i++
    }
    if (args.length < n) return null

    this.buf = parts.slice(i).join('\r\n')
    return args
  }
}

// RESP response builders
const R = {
  ok:      ()      => '+OK\r\n',
  pong:    ()      => '+PONG\r\n',
  err:     (msg)   => `-ERR ${msg}\r\n`,
  nil:     ()      => '$-1\r\n',
  str:     (s)     => `$${Buffer.byteLength(String(s))}\r\n${s}\r\n`,
  int:     (n)     => `:${n}\r\n`,
  arr:     (items) => !items || items.length === 0
                        ? '*0\r\n'
                        : `*${items.length}\r\n` + items.map(s => R.str(s)).join(''),
  // Serialize a command as RESP (for replication stream)
  cmd:     (args)  => `*${args.length}\r\n` + args.map(a => `$${Buffer.byteLength(String(a))}\r\n${a}\r\n`).join(''),
}

module.exports = { RESPParser, R }
