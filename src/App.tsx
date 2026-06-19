import { useMemo, useState } from 'react'
import { useUniversities } from './data/useUniversities'
import Sidebar from './components/Sidebar'
import Timeline from './components/Timeline'
import TrendModal from './components/TrendModal'
import type { SystemKey } from './types'

export default function App() {
  const { meta, all, visibleCount, hasMore, loading, error, loadMore } = useUniversities()
  const [year, setYear] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [systems, setSystems] = useState<SystemKey[]>(['qs', 'usnews'])
  const [showList, setShowList] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const activeYear = year ?? (meta ? meta.years[meta.years.length - 1] : 2026)

  // Filter by the search box, then sort by the better of the two ranks for the
  // active year so the strongest universities sit at the left end.
  const sorted = useMemo(() => {
    const y = String(activeYear)
    const q = search.trim().toLowerCase()
    const rankOf = (u: (typeof all)[number]) => {
      const ranks = [u.rankings.qs[y], u.rankings.usnews[y]].filter((r): r is number => r != null)
      return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
    }
    return [...all]
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q))
      .sort((a, b) => rankOf(a) - rankOf(b))
  }, [all, activeYear, search])

  const visible = sorted.slice(0, visibleCount)
  const selected = all.find((u) => u.id === selectedId) ?? null

  const toggleSystem = (s: SystemKey) =>
    setSystems((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  return (
    <div className="flex h-screen overflow-hidden">
      {meta && !loading && (
        <Sidebar
          meta={meta}
          universities={all}
          year={activeYear}
          onYearChange={setYear}
          search={search}
          onSearchChange={setSearch}
          systems={systems}
          onToggleSystem={toggleSystem}
          showList={showList}
          onToggleList={() => setShowList((v) => !v)}
          onSelect={setSelectedId}
          defaultId={meta.defaultUniversity}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">
            Overall ranking · <span className="tabular-nums">{activeYear}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            QS World University Rankings vs US News Best Global Universities. Hover a logo for details and
            links; click to see its trend over the years.
          </p>
        </header>

        {loading && <p className="text-slate-500">Loading rankings…</p>}
        {error && <p className="text-red-600">Could not load data: {error}</p>}

        {meta && !loading && (
          <>
            <Timeline
              universities={visible}
              year={activeYear}
              systems={systems}
              systemLabels={meta.systemLabels}
              defaultId={meta.defaultUniversity}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSelect={setSelectedId}
            />
            <p className="mt-3 text-sm text-slate-400">
              Showing {visible.length} of {all.length} universities.
            </p>
            <TrendModal university={selected} meta={meta} onClose={() => setSelectedId(null)} />
          </>
        )}
      </main>
    </div>
  )
}
