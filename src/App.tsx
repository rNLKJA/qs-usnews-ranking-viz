import { useMemo, useState } from 'react'
import { useUniversities } from '@/data/useUniversities'
import Sidebar from '@/components/Sidebar'
import Timeline from '@/components/Timeline'
import TrendModal from '@/components/TrendModal'
import RegionalView from '@/components/RegionalView'
import { ALL_SYSTEMS } from '@/systems'
import type { SystemKey } from '@/types'

type View = 'timeline' | 'regions'

export default function App() {
  const { meta, all, loading, error } = useUniversities()
  const [year, setYear] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [systems, setSystems] = useState<SystemKey[]>(['qs', 'usnews', 'the'])
  const [showList, setShowList] = useState(true)
  const [spacing, setSpacing] = useState(150)
  const [view, setView] = useState<View>('timeline')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locate, setLocate] = useState<{ id: string; nonce: number } | null>(null)

  const activeYear = year ?? meta?.featuredYear ?? (meta ? meta.years[meta.years.length - 1] : 2026)

  const sorted = useMemo(() => {
    const y = String(activeYear)
    const q = search.trim().toLowerCase()
    const rankOf = (u: (typeof all)[number]) => {
      const ranks = ALL_SYSTEMS.map((s) => u.rankings[s][y]).filter((r): r is number => r != null)
      return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
    }
    return [...all]
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q) || (u.city ?? '').toLowerCase().includes(q))
      .sort((a, b) => rankOf(a) - rankOf(b))
  }, [all, activeYear, search])

  const selected = all.find((u) => u.id === selectedId) ?? null
  const toggleSystem = (s: SystemKey) => setSystems((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
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
          spacing={spacing}
          onSpacingChange={setSpacing}
          onLocate={locateUni}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-8 py-10 md:px-14 md:py-12">
        <header className="mb-8 max-w-3xl">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">QS · U.S. News · Times Higher Education</p>
          <h1 className="mt-2 font-display text-4xl font-light tracking-tight md:text-5xl">
            Ranking Radar<span className="text-muted-foreground"> · {activeYear}</span>
          </h1>
          <p className="mt-3 text-lg font-light leading-relaxed">
            Four rankings, four decades. <span className="text-[#ff3c3c]">See the trend, and where they disagree.</span>
          </p>
          <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">
            Click a university for its rank trend across four systems. QS 2016–27, THE 2011–26, U.S. News Best
            Global 2026, and U.S. News National (U.S. only) back to 1984. Lower is better.
          </p>
        </header>

        {loading && <p className="text-muted-foreground">Loading rankings…</p>}
        {error && <p className="text-[#ff3c3c]">Could not load data: {error}</p>}

        {meta && !loading && (
          <>
            <div className="mb-4 flex gap-2">
              {(['timeline', 'regions'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`border px-4 py-1.5 text-[11px] uppercase tracking-widest transition-colors duration-200 ${
                    v === view ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {v === 'timeline' ? 'Timeline' : 'Regions'}
                </button>
              ))}
            </div>

            {view === 'timeline' ? (
              <>
                <Timeline
                  universities={sorted}
                  year={activeYear}
                  systems={systems}
                  systemLabels={meta.systemLabels}
                  pxPerRank={spacing}
                  locate={locate}
                  onSelect={setSelectedId}
                />
                <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                  {all.length} universities · QS {all.filter((u) => u.rankings.qs[String(activeYear)] != null).length} · U.S. News{' '}
                  {all.filter((u) => u.rankings.usnews[String(activeYear)] != null).length} · THE{' '}
                  {all.filter((u) => u.rankings.the[String(activeYear)] != null).length}
                </p>
              </>
            ) : (
              <RegionalView universities={all} meta={meta} />
            )}

            <TrendModal university={selected} meta={meta} onClose={() => setSelectedId(null)} />
          </>
        )}
      </main>
    </div>
  )
}
