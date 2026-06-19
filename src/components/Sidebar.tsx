import { useMemo } from 'react'
import { FiSearch, FiGithub, FiCoffee } from 'react-icons/fi'
import type { DatasetMeta, SystemKey, University } from '@/types'
import UniversityLogo from './UniversityLogo'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

const GITHUB_URL = 'https://github.com/rNLKJA/qs-usnews-ranking-viz'
const COFFEE_URL = 'https://buymeacoffee.com/rnlkja'

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
  /** Locate the university on the timeline (does not open the trend modal). */
  onLocate: (id: string) => void
}

const SYSTEM_COLOR: Record<SystemKey, string> = {
  qs: 'var(--color-qs)',
  usnews: 'var(--color-usnews)',
}

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
  onLocate,
}: SidebarProps) {
  const y = String(year)

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
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Logo & site name */}
      <div className="flex items-center gap-3 p-5">
        <div className="flex size-11 items-center justify-center border border-border bg-white p-2" style={{ borderRadius: '22%' }}>
          <img src="/brand-logo.svg" alt="Ranking Radar logo" className="size-full object-contain [filter:invert(1)]" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-lg font-light tracking-tight">Ranking Radar</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">QS · US News · 2004–2026</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search a university…"
            className="rounded-none border-border bg-card pl-9"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Year</span>
            <span className="font-medium tabular-nums text-foreground">{year}</span>
          </div>
          <Slider
            min={meta.years[0]}
            max={meta.years[meta.years.length - 1]}
            step={1}
            value={[year]}
            onValueChange={([v]) => onYearChange(v)}
          />
        </div>

        <div className="flex gap-2">
          {(['qs', 'usnews'] as SystemKey[]).map((s) => {
            const on = systems.includes(s)
            return (
              <button
                key={s}
                onClick={() => onToggleSystem(s)}
                aria-pressed={on}
                className={`flex flex-1 items-center justify-center gap-2 border px-2 py-2 text-[11px] uppercase tracking-widest transition-colors duration-200 ${
                  on ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-accent'
                }`}
              >
                <span className="size-2 rounded-full" style={{ background: SYSTEM_COLOR[s] }} />
                {s === 'qs' ? 'QS' : 'US News'}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-list" className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Show ranked list
          </Label>
          <Switch id="show-list" checked={showList} onCheckedChange={onToggleList} />
        </div>
      </div>

      {showList && (
        <>
          <Separator />
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="px-5 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {year} ranking · {list.length}
            </p>
            <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
              <ul>
                {list.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => onLocate(u.id)}
                      title="Find on the timeline"
                      className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors duration-200 hover:bg-accent"
                    >
                      <UniversityLogo university={u} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                        <span className="flex gap-2 text-[10px] uppercase tracking-widest">
                          <span style={{ color: SYSTEM_COLOR.qs }}>QS {fmt(u.rankings.qs[y])}</span>
                          <span style={{ color: SYSTEM_COLOR.usnews }}>USN {fmt(u.rankings.usnews[y])}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</li>
                )}
              </ul>
            </ScrollArea>
          </div>
        </>
      )}

      {/* Footer — open source + support */}
      <Separator />
      <div className="flex items-center gap-2 p-3">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 border border-border px-2 py-2 text-[10px] uppercase tracking-widest transition-colors duration-200 hover:bg-foreground hover:text-background"
        >
          <FiGithub className="size-3.5" /> GitHub
        </a>
        <a
          href={COFFEE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 border border-[#ff3c3c] px-2 py-2 text-[10px] uppercase tracking-widest text-[#ff3c3c] transition-colors duration-200 hover:bg-[#ff3c3c] hover:text-white"
        >
          <FiCoffee className="size-3.5" /> Coffee
        </a>
      </div>
    </aside>
  )
}

function fmt(r: number | null): string {
  return r != null ? `#${r}` : '—'
}
