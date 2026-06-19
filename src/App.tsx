import { useMemo, useState } from 'react'
import { useUniversities } from '@/data/useUniversities'
import Sidebar from '@/components/Sidebar'
import Timeline from '@/components/Timeline'
import TrendModal from '@/components/TrendModal'
import type { SystemKey } from '@/types'

export default function App() {
  const { meta, all, loading, error } = useUniversities()
  const [year, setYear] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [systems, setSystems] = useState<SystemKey[]>(['qs', 'usnews'])
  const [showList, setShowList] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Locate request from the sidebar — scrolls the timeline to a university.
  const [locate, setLocate] = useState<{ id: string; nonce: number } | null>(null)

  const activeYear = year ?? (meta ? meta.years[meta.years.length - 1] : 2026)

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

  const selected = all.find((u) => u.id === selectedId) ?? null

  const toggleSystem = (s: SystemKey) =>
    setSystems((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  const locateUni = (id: string) => setLocate((p) => ({ id, nonce: (p?.nonce ?? 0) + 1 }))

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
          onLocate={locateUni}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-8 py-10 md:px-14 md:py-12">
        <header className="mb-10 max-w-3xl">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            QS × US News · 2004–2026
          </p>
          <h1 className="mt-2 font-display text-4xl font-light tracking-tight md:text-5xl">
            Overall ranking<span className="text-muted-foreground"> · {activeYear}</span>
          </h1>
          <p className="mt-3 text-lg font-light leading-relaxed">
            See how far your university’s ranking slipped this year —{' '}
            <span className="text-[#ff3c3c]">did your school pay to win again?</span>
          </p>
          <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">
            QS World University Rankings vs US News Best Global Universities. Pick a university from the list to
            find it on the timeline, then hover or click its logo to see its rank trend over the years. Lower is
            better.
          </p>
        </header>

        {loading && <p className="text-muted-foreground">Loading rankings…</p>}
        {error && <p className="text-[#ff3c3c]">Could not load data: {error}</p>}

        {meta && !loading && (
          <>
            <Timeline
              universities={sorted}
              year={activeYear}
              systems={systems}
              systemLabels={meta.systemLabels}
              locate={locate}
              onSelect={setSelectedId}
            />
            <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
              {sorted.length} universities · QS from 2004 · US News Best Global from 2015
            </p>
            <TrendModal university={selected} meta={meta} onClose={() => setSelectedId(null)} />
          </>
        )}
      </main>
    </div>
  )
}
