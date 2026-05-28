import { useState, useEffect, useRef } from 'react'

const POLL_MS = 1000

export function useMetrics() {
  const [metrics, setMetrics] = useState(null)
  const [error,   setError]   = useState(false)
  const prevOps = useRef(0)
  const [delta, setDelta] = useState(0)

  useEffect(() => {
    let id

    async function poll() {
      try {
        const res  = await fetch('/metrics')
        const data = await res.json()
        setDelta(data.ops_total - prevOps.current)
        prevOps.current = data.ops_total
        setMetrics(data)
        setError(false)
      } catch {
        setError(true)
      }
      id = setTimeout(poll, POLL_MS)
    }

    poll()
    return () => clearTimeout(id)
  }, [])

  return { metrics, error, delta }
}
