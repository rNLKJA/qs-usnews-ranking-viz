import { useMemo, useState } from 'react'
import { useUniversities } from '@/data/useUniversities'
import Sidebar from '@/components/Sidebar'
import Timeline from '@/components/Timeline'
import TrendModal from '@/components/TrendModal'
import type { SystemKey } from '@/types'

export default function App() {
  const { meta, all, loading, error } = useUniversities()
  const [search, setSearch] = useState('')
  const [systems, setSystems] = useState<SystemKey[]>(['qs', 'usnews'])
  const [showList, setShowList] = useState(true)
  const [spacing, setSpacing] = useState(150)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locate, setLocate] = useState<{ id: string; nonce: number } | null>(null)

  const activeYear = meta ? meta.years[meta.years.length - 1] : 2026

  const sorted = useMemo(() => {
    const y = String(activeYear)
    const q = search.trim().toLowerCase()
    const rankOf = (u: (typeof all)[number]) => {
      const ranks = [u.rankings.qs[y], u.rankings.usnews[y]].filter((r): r is number => r != null)
      return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
    }
    return [...all]
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.country.toLowerCase().includes(q) ||
          (u.city ?? '').toLowerCase().includes(q),
      )
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
          universities={all}
          year={activeYear}
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
        <header className="mb-10 max-w-3xl">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            QS × U.S. News · {activeYear} edition
          </p>
          <h1 className="mt-2 font-display text-4xl font-light tracking-tight md:text-5xl">
            Ranking Radar<span className="text-muted-foreground"> · {activeYear}</span>
          </h1>
          <p className="mt-3 text-lg font-light leading-relaxed">
            How does your university rank — and how far do the two systems disagree?{' '}
            <span className="text-[#ff3c3c]">Two takes, side by side.</span>
          </p>
          <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">
            QS World University Rankings vs U.S. News Best Global Universities. Pick a university from the list
            to find it on the timeline, then hover or click its logo for details and the cross-system gap.
            Lower is better.
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
              pxPerRank={spacing}
              locate={locate}
              onSelect={setSelectedId}
            />
            <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
              {sorted.length} universities · QS {all.filter((u) => u.rankings.qs[String(activeYear)] != null).length}{' '}
              · U.S. News {all.filter((u) => u.rankings.usnews[String(activeYear)] != null).length}
            </p>
            <TrendModal university={selected} meta={meta} onClose={() => setSelectedId(null)} />
          </>
        )}
      </main>
    </div>
  )
}
