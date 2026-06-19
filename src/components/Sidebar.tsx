import { useMemo } from 'react'
import { FiSearch, FiGithub, FiCoffee, FiDownload } from 'react-icons/fi'
import type { SystemKey, University } from '@/types'
import UniversityLogo from './UniversityLogo'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

const GITHUB_URL = 'https://github.com/rNLKJA/qs-usnews-ranking-viz'
const COFFEE_URL = 'https://buymeacoffee.com/rnlkja'
const DATA_URL = `${import.meta.env.BASE_URL}data/universities.csv`
const MAX_LIST = 80

interface SidebarProps {
  universities: University[]
  year: number
  search: string
  onSearchChange: (s: string) => void
  systems: SystemKey[]
  onToggleSystem: (s: SystemKey) => void
  showList: boolean
  onToggleList: () => void
  spacing: number
  onSpacingChange: (n: number) => void
  onLocate: (id: string) => void
}

const SYSTEM_COLOR: Record<SystemKey, string> = {
  qs: 'var(--color-qs)',
  usnews: 'var(--color-usnews)',
}

export default function Sidebar({
  universities,
  year,
  search,
  onSearchChange,
  systems,
  onToggleSystem,
  showList,
  onToggleList,
  spacing,
  onSpacingChange,
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
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.country.toLowerCase().includes(q) ||
          (u.city ?? '').toLowerCase().includes(q),
      )
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
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">QS · U.S. News · {year}</p>
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
            placeholder="Search name, country, city…"
            className="rounded-none border-border bg-card pl-9"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 p-4">
        <div className="flex gap-2">
          {(['qs', 'usnews'] as SystemKey[]).map((s) => {
            const on = systems.includes(s)
            return (
              <button
                key={s}
                onClick={() => onToggleSystem(s)}
                aria-pressed={on}
                className={`flex flex-1 items-center justify-center gap-2 border bg-card px-2 py-2 text-[11px] uppercase tracking-widest transition-all duration-200 ${
                  on ? 'font-semibold' : 'border-border text-muted-foreground opacity-60 hover:opacity-100'
                }`}
                style={on ? { borderColor: SYSTEM_COLOR[s], color: SYSTEM_COLOR[s], borderWidth: 2 } : undefined}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: on ? SYSTEM_COLOR[s] : 'transparent', border: on ? 'none' : '1.5px solid currentColor' }}
                />
                {s === 'qs' ? 'QS' : 'U.S. News'}
              </button>
            )
          })}
        </div>

        {/* Rank spacing control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Spacing</span>
            <span className="font-medium tabular-nums text-foreground">{spacing}px</span>
          </div>
          <Slider min={70} max={320} step={10} value={[spacing]} onValueChange={([v]) => onSpacingChange(v)} />
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
                {list.slice(0, MAX_LIST).map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => onLocate(u.id)}
                      title="Find on the timeline"
                      className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors duration-200 hover:bg-accent"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                        <UniversityLogo university={u} size={24} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                        <span className="flex gap-2 text-[10px] uppercase tracking-widest">
                          <span style={{ color: SYSTEM_COLOR.qs }}>QS {fmt(u.rankings.qs[y])}</span>
                          <span style={{ color: SYSTEM_COLOR.usnews }}>USN {fmt(u.rankings.usnews[y])}</span>
                          {u.city && <span className="truncate text-muted-foreground normal-case tracking-normal">{u.city}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</li>
                )}
                {list.length > MAX_LIST && (
                  <li className="px-2 py-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                    +{list.length - MAX_LIST} more · search to narrow
                  </li>
                )}
              </ul>
            </ScrollArea>
          </div>
        </>
      )}

      {/* Footer — open source · data · support */}
      <Separator />
      <div className="grid grid-cols-3 gap-2 p-3">
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 border border-border px-2 py-2 text-[10px] uppercase tracking-widest transition-colors duration-200 hover:bg-foreground hover:text-background">
          <FiGithub className="size-3.5" /> Code
        </a>
        <a href={DATA_URL} download className="inline-flex items-center justify-center gap-1.5 border border-border px-2 py-2 text-[10px] uppercase tracking-widest transition-colors duration-200 hover:bg-foreground hover:text-background">
          <FiDownload className="size-3.5" /> Data
        </a>
        <a href={COFFEE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 border border-[#ff3c3c] px-2 py-2 text-[10px] uppercase tracking-widest text-[#ff3c3c] transition-colors duration-200 hover:bg-[#ff3c3c] hover:text-white">
          <FiCoffee className="size-3.5" /> Coffee
        </a>
      </div>
    </aside>
  )
}

function fmt(r: number | null): string {
  return r != null ? `#${r}` : '—'
}
