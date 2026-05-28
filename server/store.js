'use strict'

// Thread-safe in Node.js (single-threaded event loop).
// Ops-per-second tracked with a sliding 1-second window.
class Store {
  constructor() {
    this.data    = new Map()
    this.opsTotal = 0
    this._opsTs  = [] // timestamps of recent ops (sliding window)
  }

  set(key, value) {
    this.data.set(key, value)
    this._tick()
  }

  get(key) {
    this._tick()
    return this.data.has(key) ? this.data.get(key) : null
  }

  del(key) {
    const existed = this.data.delete(key)
    this._tick()
    return existed ? 1 : 0
  }

  keys(pattern) {
    if (!pattern || pattern === '*') return [...this.data.keys()]
    // Minimal glob: only * wildcard
    const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
    return [...this.data.keys()].filter(k => re.test(k))
  }

  flush() {
    this.data.clear()
    this._tick()
  }

  size()         { return this.data.size }
  entries()      { return [...this.data.entries()] }

  opsPerSec() {
    const now    = Date.now()
    const cutoff = now - 1000
    // Prune stale entries
    let i = 0
    while (i < this._opsTs.length && this._opsTs[i] < cutoff) i++
    this._opsTs = this._opsTs.slice(i)
    return this._opsTs.length
  }

  _tick() {
    this.opsTotal++
    this._opsTs.push(Date.now())
  }
}

module.exports = new Store()
