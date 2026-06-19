import { useMemo, useState } from 'react'
import { useUniversities } from './data/useUniversities'
import Timeline from './components/Timeline'
import TrendModal from './components/TrendModal'

export default function App() {
  const { meta, all, visibleCount, hasMore, loading, error, loadMore } = useUniversities()
  const [year, setYear] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const activeYear = year ?? (meta ? meta.years[meta.years.length - 1] : 2026)

  // Sort by the better of the two ranks for the active year so the strongest
  // universities sit at the left end; reveal only the first `visibleCount`.
  const sorted = useMemo(() => {
    const y = String(activeYear)
    const rankOf = (u: (typeof all)[number]) => {
      const ranks = [u.rankings.qs[y], u.rankings.usnews[y]].filter((r): r is number => r != null)
      return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
    }
    return [...all].sort((a, b) => rankOf(a) - rankOf(b))
  }, [all, activeYear])

  const visible = sorted.slice(0, visibleCount)
  const selected = all.find((u) => u.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">University Rankings Timeline</h1>
        <p className="mt-1 text-slate-500">
          QS World University Rankings vs US News Best Global Universities. Click any university to see its
          trend.
        </p>
      </header>

      {loading && <p className="text-slate-500">Loading rankings…</p>}
      {error && <p className="text-red-600">Could not load data: {error}</p>}

      {meta && !loading && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <label htmlFor="year" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Year
            </label>
            <input
              id="year"
              type="range"
              min={meta.years[0]}
              max={meta.years[meta.years.length - 1]}
              step={1}
              value={activeYear}
              onChange={(e) => setYear(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="w-14 text-right text-lg font-semibold tabular-nums">{activeYear}</span>
          </div>

          <Timeline
            universities={visible}
            year={activeYear}
            systemLabels={meta.systemLabels}
            defaultId={meta.defaultUniversity}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onSelect={setSelectedId}
          />

          <p className="mt-3 text-center text-sm text-slate-400">
            Showing {visible.length} of {all.length} universities ·{' '}
            <button onClick={() => setSelectedId(meta.defaultUniversity)} className="text-blue-600 underline">
              View {all.find((u) => u.id === meta.defaultUniversity)?.shortName} trend
            </button>
          </p>

          <TrendModal university={selected} meta={meta} onClose={() => setSelectedId(null)} />
        </>
      )}

      <footer className="mt-10 text-center text-xs text-slate-400">
        Rank data compiled from public QS &amp; US News sources — see Notes/data-sourcing.md for provenance.
      </footer>
    </div>
  )
}
