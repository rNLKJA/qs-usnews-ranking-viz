import { useEffect, useMemo, useRef } from 'react'
import { scaleLinear } from 'd3-scale'
import { ExternalLink, LineChart, Star } from 'lucide-react'
import type { SystemKey, University } from '@/types'
import UniversityLogo from './UniversityLogo'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface TimelineProps {
  universities: University[]
  year: number
  systems: SystemKey[]
  systemLabels: Record<SystemKey, string>
  defaultId: string
  hasMore: boolean
  onLoadMore: () => void
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

/**
 * Overall view for the selected year: rank 1 at the left end, universities
 * placed along the axis by rank, ties stacked vertically. QS lane on top, US
 * News below. Each university shows as its logo with the full name beneath;
 * hovering opens a card with details and links to its QS / US News pages. No
 * error bars here — those live in the per-university trend modal.
 */
export default function Timeline({
  universities,
  year,
  systems,
  systemLabels,
  defaultId,
  hasMore,
  onLoadMore,
  onSelect,
}: TimelineProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const activeSystems = ALL_SYSTEMS.filter((s) => systems.includes(s))

  const { laid, maxRank } = useMemo(() => {
    const y = String(year)
    let max = 1
    const laid: Record<SystemKey, { uni: University; rank: number; offset: number }[]> = {
      qs: [],
      usnews: [],
    }
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
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore()
      },
      { root: el.closest('[data-scroll-root]'), rootMargin: '0px 240px 0px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, onLoadMore])

  const ticks = useMemo(() => {
    const t = [1]
    for (let r = 5; r <= maxRank; r += 5) t.push(r)
    return t
  }, [maxRank])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      {activeSystems.map((system) => (
        <div
          key={system}
          className="pointer-events-none absolute left-0 z-20 -translate-y-1/2 rounded-r-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
          style={{ top: LANE_Y[system], background: SYSTEM_COLOR[system] }}
        >
          {SYSTEM_SHORT[system]}
        </div>
      ))}

      <div data-scroll-root className="overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width: chartWidth, height: HEIGHT }}>
          <svg width={chartWidth} height={HEIGHT} className="absolute inset-0" aria-hidden>
            {ticks.map((r) => (
              <g key={r}>
                <line x1={x(r)} x2={x(r)} y1={28} y2={HEIGHT - 20} className="stroke-border/60" />
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
                strokeWidth={2}
              />
            ))}
          </svg>

          {activeSystems.map((system) =>
            laid[system].map(({ uni, rank, offset }) => {
              const cx = x(rank)
              const cy = LANE_Y[system] - offset * STACK_STEP
              const isHome = uni.id === defaultId
              return (
                <div key={`${system}-${uni.id}`} className="absolute" style={{ left: cx, top: cy }}>
                  <HoverCard openDelay={100} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelect(uni.id)}
                        className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl p-1.5 text-center transition hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`${uni.name}, ${systemLabels[system]} rank ${rank} in ${year}`}
                      >
                        <span className="relative">
                          <UniversityLogo university={uni} size={48} />
                          <span
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[10px] font-bold text-white shadow ring-2 ring-card"
                            style={{ background: SYSTEM_COLOR[system] }}
                          >
                            #{rank}
                          </span>
                          {isHome && (
                            <Star
                              className="absolute -right-1.5 -top-1.5 size-4 fill-[var(--color-home)] stroke-[var(--color-home)] drop-shadow"
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                          {uni.name}
                        </span>
                      </button>
                    </HoverCardTrigger>

                    <HoverCardContent
                      side={system === 'qs' ? 'bottom' : 'top'}
                      className="w-64 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <UniversityLogo university={uni} size={40} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{uni.name}</p>
                          <p className="text-xs text-muted-foreground">{uni.country}</p>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <dl className="space-y-1 text-xs">
                        {ALL_SYSTEMS.map((s) => (
                          <div key={s} className="flex items-center justify-between">
                            <dt className="text-muted-foreground">{SYSTEM_SHORT[s]} · {year}</dt>
                            <dd className="font-semibold" style={{ color: SYSTEM_COLOR[s] }}>
                              {uni.rankings[s][String(year)] != null
                                ? `#${uni.rankings[s][String(year)]}`
                                : '—'}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <Separator className="my-3" />
                      <div className="flex flex-col gap-1.5 text-xs">
                        <a
                          href={uni.qsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium hover:underline"
                          style={{ color: SYSTEM_COLOR.qs }}
                        >
                          <ExternalLink className="size-3" /> QS ranking page
                        </a>
                        <a
                          href={uni.usnewsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium hover:underline"
                          style={{ color: SYSTEM_COLOR.usnews }}
                        >
                          <ExternalLink className="size-3" /> US News ranking page
                        </a>
                        <Button size="sm" className="mt-1.5 h-8 rounded-xl" onClick={() => onSelect(uni.id)}>
                          <LineChart className="size-3.5" /> View trend over years
                        </Button>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              )
            }),
          )}

          <div ref={sentinelRef} className="absolute right-0 top-0 h-full w-1" aria-hidden />
        </div>
      </div>

      {hasMore && (
        <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
          Scroll right to load more universities…
        </div>
      )}
    </div>
  )
}
