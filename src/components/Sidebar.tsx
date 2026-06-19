import { useMemo } from 'react'
import type { DatasetMeta, SystemKey, University } from '../types'
import UniversityLogo from './UniversityLogo'

interface SidebarProps {
  meta: DatasetMeta
  universities: University[]
  year: number
  onYearChange: (y: number) => void
  search: string
  onSearchChange: (s: string) => void
  systems: SystemKey[]
  onToggleSystem: (s: SystemKey) => void
  showList: boolean
  onToggleList: () => void
  onSelect: (id: string) => void
  defaultId: string
}

const SYSTEM_COLOR: Record<SystemKey, string> = { qs: '#2563eb', usnews: '#dc2626' }

export default function Sidebar({
  meta,
  universities,
  year,
  onYearChange,
  search,
  onSearchChange,
  systems,
  onToggleSystem,
  showList,
  onToggleList,
  onSelect,
  defaultId,
}: SidebarProps) {
  const y = String(year)

  // Ranked list for the selected year, filtered by the search box.
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const bestRank = (u: University) => {
      const ranks = [u.rankings.qs[y], u.rankings.usnews[y]].filter((r): r is number => r != null)
      return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
    }
    return universities
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q))
      .sort((a, b) => bestRank(a) - bestRank(b))
  }, [universities, search, y])

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Logo & site name */}
      <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-red-500 font-bold text-white">
          R
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Ranking Radar</p>
          <p className="text-xs text-slate-500">QS vs US News</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search a university…"
          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3 border-b border-slate-200 px-3 pb-3 dark:border-slate-700">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Year</span>
            <span className="tabular-nums text-slate-900 dark:text-slate-100">{year}</span>
          </div>
          <input
            type="range"
            min={meta.years[0]}
            max={meta.years[meta.years.length - 1]}
            step={1}
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
        <div className="flex gap-2">
          {(['qs', 'usnews'] as SystemKey[]).map((s) => {
            const on = systems.includes(s)
            return (
              <button
                key={s}
                onClick={() => onToggleSystem(s)}
                className="flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition"
                style={{
                  borderColor: SYSTEM_COLOR[s],
                  background: on ? SYSTEM_COLOR[s] : 'transparent',
                  color: on ? 'white' : SYSTEM_COLOR[s],
                }}
                aria-pressed={on}
              >
                {s === 'qs' ? 'QS' : 'US News'}
              </button>
            )
          })}
        </div>
        <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
          Show ranked list
          <input type="checkbox" checked={showList} onChange={onToggleList} className="h-4 w-4 accent-blue-600" />
        </label>
      </div>

      {/* Ranked list */}
      {showList && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {year} ranking · {list.length}
          </p>
          <ul className="space-y-1">
            {list.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => onSelect(u.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <UniversityLogo university={u} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {u.name}
                      {u.id === defaultId && <span className="ml-1 text-amber-500" title="Home university">★</span>}
                    </span>
                    <span className="flex gap-2 text-[11px]">
                      <span style={{ color: SYSTEM_COLOR.qs }}>QS {fmt(u.rankings.qs[y])}</span>
                      <span style={{ color: SYSTEM_COLOR.usnews }}>USN {fmt(u.rankings.usnews[y])}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-2 py-4 text-center text-sm text-slate-400">No matches.</li>}
          </ul>
        </div>
      )}
    </aside>
  )
}

function fmt(r: number | null): string {
  return r != null ? `#${r}` : '—'
}
