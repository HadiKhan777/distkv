import { Suspense, lazy } from 'react'
import { motion }        from 'framer-motion'
import { useMetrics }    from './hooks/useMetrics'
import StatsPanel        from './components/StatsPanel'
import Terminal          from './components/Terminal'

const ClusterScene = lazy(() => import('./components/r3f/ClusterScene'))

export default function App() {
  const { metrics, error } = useMetrics()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg text-[var(--text)] font-body">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 h-12 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-base text-accent tracking-[0.08em]">DistKV</span>
          <span className="text-[var(--border)] select-none">|</span>
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">cluster dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[0.65rem] font-mono text-[var(--muted)]">:7379</span>
          <motion.span
            animate={{ opacity: error ? [1, 0.3, 1] : 1 }}
            transition={{ repeat: error ? Infinity : 0, duration: 1.2 }}
            className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-accent'}`}
          />
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-[1fr_300px] overflow-hidden">

        {/* Left: 3D scene + terminal stacked */}
        <div className="flex flex-col overflow-hidden border-r border-[var(--border)]">

          {/* 3D Cluster visualization */}
          <div className="flex-1 relative min-h-0">
            <Suspense fallback={null}>
              <ClusterScene metrics={metrics} />
            </Suspense>

            {/* Overlay label */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <p className="text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                {metrics
                  ? `${metrics.keys} keys · ${metrics.ops_per_sec} ops/s`
                  : 'connecting to cluster...'}
              </p>
            </div>
          </div>

          {/* Terminal */}
          <div className="h-72 shrink-0 border-t border-[var(--border)]">
            <Terminal />
          </div>
        </div>

        {/* Right: Stats panel */}
        <div className="p-4 overflow-y-auto">
          <StatsPanel metrics={metrics} error={error} />
        </div>

      </div>
    </div>
  )
}
