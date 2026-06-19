import { useMemo } from 'react'
import { Search, Star } from 'lucide-react'
import type { DatasetMeta, SystemKey, University } from '@/types'
import UniversityLogo from './UniversityLogo'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  onSelect,
  defaultId,
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
    <aside className="flex h-full w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo & site name */}
      <div className="flex items-center gap-3 p-5">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary p-2 shadow-sm">
          <img src="/brand-logo.svg" alt="Site logo" className="size-full object-contain" />
        </div>
        <div className="leading-tight">
          <p className="text-base font-semibold tracking-tight">Ranking Radar</p>
          <p className="text-xs text-muted-foreground">QS · US News, side by side</p>
        </div>
      </div>

      <div className="px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search a university…"
            className="rounded-xl bg-card pl-9"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Year</span>
            <span className="rounded-md bg-accent px-1.5 py-0.5 font-semibold tabular-nums text-accent-foreground">
              {year}
            </span>
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
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-medium transition"
                style={{
                  borderColor: SYSTEM_COLOR[s],
                  background: on ? SYSTEM_COLOR[s] : 'transparent',
                  color: on ? 'white' : SYSTEM_COLOR[s],
                }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: on ? 'white' : SYSTEM_COLOR[s] }}
                />
                {s === 'qs' ? 'QS' : 'US News'}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-list" className="text-xs font-medium text-muted-foreground">
            Show ranked list
          </Label>
          <Switch id="show-list" checked={showList} onCheckedChange={onToggleList} />
        </div>
      </div>

      {showList && (
        <>
          <Separator />
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {year} ranking · {list.length}
            </p>
            <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
              <ul className="space-y-1">
                {list.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => onSelect(u.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-accent/70"
                    >
                      <UniversityLogo university={u} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                          <span className="truncate">{u.name}</span>
                          {u.id === defaultId && (
                            <Star className="size-3 shrink-0 fill-[var(--color-home)] stroke-[var(--color-home)]" />
                          )}
                        </span>
                        <span className="flex gap-2 text-[11px]">
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
    </aside>
  )
}

function fmt(r: number | null): string {
  return r != null ? `#${r}` : '—'
}
