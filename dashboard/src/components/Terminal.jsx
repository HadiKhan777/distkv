import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const HISTORY_MAX = 80

const HELP = `Commands: SET key value · GET key · DEL key · KEYS [pattern] · DBSIZE · FLUSHDB · INFO · PING
Type a command and press Enter.`

async function runCommand(raw) {
  const args = raw.trim().split(/\s+/)
  if (!args[0]) return null
  try {
    const res  = await fetch('/command', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ args }),
    })
    const { result, error } = await res.json()
    return error ? `ERR: ${error}` : result
  } catch {
    return 'ERR: server unreachable'
  }
}

export default function Terminal() {
  const [history, setHistory]   = useState([{ type: 'info', text: HELP }])
  const [input,   setInput]     = useState('')
  const [cmdHist, setCmdHist]   = useState([])
  const [histIdx, setHistIdx]   = useState(-1)
  const bottomRef               = useRef()
  const inputRef                = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const push = (type, text) =>
    setHistory(h => [...h.slice(-(HISTORY_MAX - 1)), { type, text }])

  async function submit(e) {
    e.preventDefault()
    const raw = input.trim()
    if (!raw) return
    push('cmd', raw)
    setCmdHist(h => [raw, ...h].slice(0, 50))
    setHistIdx(-1)
    setInput('')

    if (raw.toLowerCase() === 'clear') { setHistory([]); return }

    const result = await runCommand(raw)
    if (result !== null) push('result', result ?? '(nil)')
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(histIdx + 1, cmdHist.length - 1)
      setHistIdx(idx)
      setInput(cmdHist[idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx)
      setInput(idx === -1 ? '' : cmdHist[idx])
    }
  }

  return (
    <div
      className="flex flex-col h-full bg-[#0a0a0a] border border-[var(--border)] overflow-hidden"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-accent" />
        <span className="ml-2 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
          distkv terminal
        </span>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[0.78rem] leading-[1.7] space-y-0.5">
        <AnimatePresence initial={false}>
          {history.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className={
                item.type === 'cmd'    ? 'text-accent' :
                item.type === 'info'   ? 'text-[var(--muted)] whitespace-pre-line' :
                item.type === 'result' && item.text.startsWith('ERR')
                                       ? 'text-red-400' :
                                         'text-[var(--text)]/80'
              }
            >
              {item.type === 'cmd' ? `> ${item.text}` : item.text}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)] shrink-0">
        <span className="text-accent font-mono text-sm select-none">{'>'}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          spellCheck={false}
          className="flex-1 bg-transparent font-mono text-[0.8rem] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          placeholder="SET key value"
        />
      </form>
    </div>
  )
}
