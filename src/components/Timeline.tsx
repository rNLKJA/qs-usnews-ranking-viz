import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { FiExternalLink, FiBarChart2 } from 'react-icons/fi'
import type { SystemKey, University } from '@/types'
import UniversityLogo from './UniversityLogo'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'

interface TimelineProps {
  universities: University[]
  year: number
  systems: SystemKey[]
  systemLabels: Record<SystemKey, string>
  /** A request to scroll to + highlight a university (from the sidebar). */
  locate: { id: string; nonce: number } | null
  onSelect: (id: string) => void
}

const ALL_SYSTEMS: SystemKey[] = ['qs', 'usnews']
const SYSTEM_COLOR: Record<SystemKey, string> = {
  qs: 'var(--color-qs)',
  usnews: 'var(--color-usnews)',
}
const SYSTEM_SHORT: Record<SystemKey, string> = { qs: 'QS', usnews: 'US News' }

const MARGIN = { left: 48, right: 140 }
const PX_PER_RANK = 30
const MIN_WIDTH = 900
const HEIGHT = 500
const LANE_Y: Record<SystemKey, number> = { qs: 150, usnews: 360 }
const STACK_STEP = 96
const REVEAL_BUFFER = 240

/**
 * Overall view for the selected year: rank 1 at the left end, universities
 * placed along the axis by rank, ties stacked vertically. QS lane on top, US
 * News below. Each university shows as its logo with the full name beneath;
 * hovering opens a card with details and ranking-page links. Reveal is
 * position-aware — universities stream in as their rank scrolls into view.
 */
export default function Timeline({ universities, year, systems, systemLabels, locate, onSelect }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [revealRank, setRevealRank] = useState(60)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const activeSystems = ALL_SYSTEMS.filter((s) => systems.includes(s))

  const { laid, maxRank } = useMemo(() => {
    const y = String(year)
    let max = 1
    const laid: Record<SystemKey, { uni: University; rank: number; offset: number }[]> = { qs: [], usnews: [] }
    for (const system of ALL_SYSTEMS) {
      const points = universities
        .map((uni) => ({ uni, rank: uni.rankings[system][y] }))
        .filter((p): p is { uni: University; rank: number } => p.rank != null)
        .sort((a, b) => a.rank - b.rank)
      const seen = new Map<number, number>()
      for (const p of points) {
        const offset = seen.get(p.rank) ?? 0
        seen.set(p.rank, offset + 1)
        laid[system].push({ ...p, offset })
        if (p.rank > max) max = p.rank
      }
    }
    return { laid, maxRank: max }
  }, [universities, year])

  const chartWidth = Math.max(MIN_WIDTH, MARGIN.left + maxRank * PX_PER_RANK + MARGIN.right)
  const x = useMemo(
    () => scaleLinear().domain([1, maxRank]).range([MARGIN.left, chartWidth - MARGIN.right]),
    [maxRank, chartWidth],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () =>
      setRevealRank(Math.max(1, Math.ceil(x.invert(el.scrollLeft + el.clientWidth + REVEAL_BUFFER))))
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [x, year, systems])

  // Sidebar locate: reveal the university, scroll it into view, and flag it.
  useEffect(() => {
    if (!locate) return
    const el = scrollRef.current
    const uni = universities.find((u) => u.id === locate.id)
    if (!el || !uni) return
    const ranks = activeSystems
      .map((s) => uni.rankings[s][String(year)])
      .filter((r): r is number => r != null)
    if (!ranks.length) return
    setRevealRank((prev) => Math.max(prev, Math.max(...ranks)))
    el.scrollTo({ left: Math.max(0, x(Math.min(...ranks)) - el.clientWidth / 2), behavior: 'smooth' })
    setHighlightId(locate.id)
    const t = setTimeout(() => setHighlightId(null), 2800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locate?.nonce])

  const ticks = useMemo(() => {
    const t = [1]
    for (let r = 5; r <= maxRank; r += 5) t.push(r)
    return t
  }, [maxRank])

  const totalShown = activeSystems.reduce((n, s) => n + laid[s].filter((p) => p.rank <= revealRank).length, 0)
  const totalAll = activeSystems.reduce((n, s) => n + laid[s].length, 0)
  const isEmpty = laid.qs.length === 0 && laid.usnews.length === 0

  return (
    <div className="relative overflow-hidden border border-border bg-card">
      {activeSystems.map((system) => (
        <div
          key={system}
          className="pointer-events-none absolute left-0 z-20 -translate-y-1/2 px-2.5 py-1 text-[11px] font-medium uppercase tracking-widest text-white"
          style={{ top: LANE_Y[system], background: SYSTEM_COLOR[system] }}
        >
          {SYSTEM_SHORT[system]}
        </div>
      ))}

      <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width: chartWidth, height: HEIGHT }}>
          <svg width={chartWidth} height={HEIGHT} className="absolute inset-0" aria-hidden>
            {ticks.map((r) => (
              <g key={r}>
                <line x1={x(r)} x2={x(r)} y1={28} y2={HEIGHT - 20} className="stroke-border" />
                <text x={x(r)} y={20} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  #{r}
                </text>
              </g>
            ))}
            {activeSystems.map((system) => (
              <line
                key={system}
                x1={MARGIN.left}
                x2={chartWidth - MARGIN.right}
                y1={LANE_Y[system]}
                y2={LANE_Y[system]}
                stroke={SYSTEM_COLOR[system]}
                strokeOpacity={0.3}
                strokeWidth={1.5}
              />
            ))}
          </svg>

          {activeSystems.map((system) =>
            laid[system]
              .filter((p) => p.rank <= revealRank)
              .map(({ uni, rank, offset }) => {
                const cx = x(rank)
                const cy = LANE_Y[system] - offset * STACK_STEP
                return (
                  <div key={`${system}-${uni.id}`} className="absolute" style={{ left: cx, top: cy }}>
                    <HoverCard openDelay={100} closeDelay={80}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSelect(uni.id)}
                          className={`absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 p-1.5 text-center transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            uni.id === highlightId ? 'bg-accent ring-2 ring-foreground' : ''
                          }`}
                          aria-label={`${uni.name}, ${systemLabels[system]} rank ${rank} in ${year}`}
                        >
                          <span className="relative">
                            <UniversityLogo university={uni} size={48} />
                            <span
                              className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[10px] font-semibold text-white ring-2 ring-card"
                              style={{ background: SYSTEM_COLOR[system] }}
                            >
                              #{rank}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                            {uni.name}
                          </span>
                        </button>
                      </HoverCardTrigger>

                      <HoverCardContent
                        side={system === 'qs' ? 'bottom' : 'top'}
                        className="w-64 rounded-none border-border shadow-none"
                      >
                        <div className="flex items-center gap-3">
                          <UniversityLogo university={uni} size={40} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{uni.name}</p>
                            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{uni.country}</p>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <dl className="space-y-1 text-xs">
                          {ALL_SYSTEMS.map((s) => (
                            <div key={s} className="flex items-center justify-between">
                              <dt className="uppercase tracking-widest text-muted-foreground text-[10px]">{SYSTEM_SHORT[s]} · {year}</dt>
                              <dd className="font-semibold" style={{ color: SYSTEM_COLOR[s] }}>
                                {uni.rankings[s][String(year)] != null ? `#${uni.rankings[s][String(year)]}` : '—'}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <Separator className="my-3" />
                        <div className="flex flex-col gap-2 text-[11px] uppercase tracking-widest">
                          <a href={uni.qsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:opacity-60" style={{ color: SYSTEM_COLOR.qs }}>
                            <FiExternalLink className="size-3" /> QS ranking page
                          </a>
                          <a href={uni.usnewsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:opacity-60" style={{ color: SYSTEM_COLOR.usnews }}>
                            <FiExternalLink className="size-3" /> US News ranking page
                          </a>
                          <button
                            onClick={() => onSelect(uni.id)}
                            className="mt-1 inline-flex items-center justify-center gap-1.5 border border-foreground px-3 py-1.5 text-foreground transition-colors duration-200 hover:bg-foreground hover:text-background"
                          >
                            <FiBarChart2 className="size-3" /> View trend
                          </button>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                )
              }),
          )}

          {isEmpty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-foreground">No ranking data for {year}</p>
              <p className="max-w-xs text-xs text-muted-foreground">Drag the year forward.</p>
            </div>
          )}
        </div>
      </div>

      {!isEmpty && totalShown < totalAll && (
        <div className="border-t border-border px-4 py-2 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          Scroll right to reveal more ({totalShown}/{totalAll})
        </div>
      )}
    </div>
  )
}
