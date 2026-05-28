import { motion, AnimatePresence } from 'framer-motion'

function Stat({ label, value, unit, accent }) {
  return (
    <div className="border border-[var(--border)] p-4">
      <p className="text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)] mb-1.5">{label}</p>
      <p className={`font-display font-bold text-2xl leading-none ${accent ? 'text-accent' : 'text-[var(--text)]'}`}>
        {value}
        {unit && <span className="text-sm font-body font-light ml-1 text-[var(--muted)]">{unit}</span>}
      </p>
    </div>
  )
}

function ReplicaBadge({ replica }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 px-3 py-2 border border-cyan/20 bg-cyan/5"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
      <span className="text-xs font-mono text-cyan">{replica.id}</span>
      <span className="text-[0.6rem] text-[var(--muted)] ml-auto">
        {Math.floor(replica.uptimeMs / 1000)}s
      </span>
    </motion.div>
  )
}

function formatUptime(s) {
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export default function StatsPanel({ metrics, error }) {
  if (error || !metrics) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="border border-red-500/20 bg-red-500/5 p-4 text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-red-400">
            {error ? 'server offline' : 'connecting...'}
          </p>
        </div>
      </div>
    )
  }

  const isPrimary = metrics.role === 'primary'

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      {/* Role badge */}
      <div className={`flex items-center gap-2 px-4 py-3 border ${
        isPrimary
          ? 'border-accent/25 bg-accent/5'
          : 'border-cyan/25 bg-cyan/5'
      }`}>
        <span className={`w-2 h-2 rounded-full animate-pulse ${isPrimary ? 'bg-accent' : 'bg-cyan'}`} />
        <span className={`text-[0.65rem] uppercase tracking-[0.2em] font-mono ${isPrimary ? 'text-accent' : 'text-cyan'}`}>
          {metrics.role}
        </span>
        <span className="ml-auto text-[0.6rem] text-[var(--muted)]">
          up {formatUptime(metrics.uptime_seconds)}
        </span>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Keys"       value={metrics.keys.toLocaleString()} accent />
        <Stat label="Ops / sec"  value={metrics.ops_per_sec} />
        <Stat label="Total ops"  value={metrics.ops_total.toLocaleString()} />
        <Stat label="Memory"     value={metrics.memory_mb} unit="MB" />
      </div>

      {/* Replicas */}
      <div>
        <p className="text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)] mb-2">
          Replicas ({metrics.replicas.length})
        </p>
        <div className="flex flex-col gap-1.5">
          <AnimatePresence mode="popLayout">
            {metrics.replicas.length === 0 ? (
              <p className="text-[0.72rem] text-[var(--muted)] px-1">
                none connected — run a replica to see it appear
              </p>
            ) : (
              metrics.replicas.map(r => <ReplicaBadge key={r.id} replica={r} />)
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* How to start a replica */}
      {isPrimary && metrics.replicas.length === 0 && (
        <div className="border border-[var(--border)] p-3 mt-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Start a replica</p>
          <code className="block text-[0.68rem] font-mono text-accent/80 leading-relaxed">
            cd server &&{'\n'}npm run replica
          </code>
        </div>
      )}
    </div>
  )
}
