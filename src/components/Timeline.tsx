import { useEffect, useMemo, useRef } from 'react'
import { scaleLinear } from 'd3-scale'
import type { SystemKey, University } from '../types'

interface TimelineProps {
  universities: University[]
  year: number
  systemLabels: Record<SystemKey, string>
  defaultId: string
  hasMore: boolean
  onLoadMore: () => void
  onSelect: (id: string) => void
}

const SYSTEMS: SystemKey[] = ['qs', 'usnews']
const SYSTEM_COLOR: Record<SystemKey, string> = { qs: '#2563eb', usnews: '#dc2626' }

const MARGIN = { left: 56, right: 80, top: 56 }
const PX_PER_RANK = 24
const MIN_WIDTH = 920
const HEIGHT = 440
const LANE_Y: Record<SystemKey, number> = { qs: 150, usnews: 340 }
const STACK_STEP = 30

/**
 * Horizontal rank timeline: rank 1 sits at the left end, universities are placed
 * along the line by their rank for the selected year, and ties stack vertically.
 * Two lanes — QS on top, US News below. Wider than the viewport, so the user
 * scrolls right toward higher ranks; a sentinel at the right edge lazily reveals
 * more universities.
 */
export default function Timeline({
  universities,
  year,
  systemLabels,
  defaultId,
  hasMore,
  onLoadMore,
  onSelect,
}: TimelineProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Build placed points per system for the selected year (skip null editions).
  const { laid, maxRank } = useMemo(() => {
    const y = String(year)
    let max = 1
    const laid: Record<SystemKey, { uni: University; rank: number; offset: number }[]> = {
      qs: [],
      usnews: [],
    }
    for (const system of SYSTEMS) {
      const points = universities
        .map((uni) => ({ uni, rank: uni.rankings[system][y] }))
        .filter((p): p is { uni: University; rank: number } => p.rank != null)
        .sort((a, b) => a.rank - b.rank)
      // Stack ties: items sharing a rank get an increasing vertical offset.
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

  // Lazy-load more universities when the right-edge sentinel scrolls into view.
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

  // Rank gridline ticks (1, then multiples of 5).
  const ticks = useMemo(() => {
    const t = [1]
    for (let r = 5; r <= maxRank; r += 5) t.push(r)
    return t
  }, [maxRank])

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Pinned lane labels (stay put while the chart scrolls). */}
      {SYSTEMS.map((system) => (
        <div
          key={system}
          className="pointer-events-none absolute left-0 z-10 -translate-y-1/2 rounded-r-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white"
          style={{ top: LANE_Y[system], background: SYSTEM_COLOR[system] }}
        >
          {system === 'qs' ? 'QS' : 'US News'}
        </div>
      ))}

      <div data-scroll-root className="overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width: chartWidth }}>
          <svg width={chartWidth} height={HEIGHT} role="img" aria-label={`Rank timeline for ${year}`}>
            {/* Rank gridlines + axis labels */}
            {ticks.map((r) => (
              <g key={r}>
                <line
                  x1={x(r)}
                  x2={x(r)}
                  y1={MARGIN.top - 16}
                  y2={HEIGHT - 24}
                  className="stroke-slate-100 dark:stroke-slate-800"
                />
                <text
                  x={x(r)}
                  y={MARGIN.top - 24}
                  textAnchor="middle"
                  className="fill-slate-400 text-[11px]"
                >
                  #{r}
                </text>
              </g>
            ))}

            {/* Lane baselines */}
            {SYSTEMS.map((system) => (
              <line
                key={system}
                x1={MARGIN.left}
                x2={chartWidth - MARGIN.right}
                y1={LANE_Y[system]}
                y2={LANE_Y[system]}
                stroke={SYSTEM_COLOR[system]}
                strokeOpacity={0.25}
                strokeWidth={2}
              />
            ))}

            {/* Markers */}
            {SYSTEMS.map((system) =>
              laid[system].map(({ uni, rank, offset }) => {
                const cx = x(rank)
                const cy = LANE_Y[system] - offset * STACK_STEP
                const isHome = uni.id === defaultId
                return (
                  <g
                    key={`${system}-${uni.id}`}
                    className="cursor-pointer"
                    onClick={() => onSelect(uni.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelect(uni.id)
                    }}
                    aria-label={`${uni.name}, ${systemLabels[system]} rank ${rank} in ${year}`}
                  >
                    {offset > 0 && (
                      <line
                        x1={cx}
                        x2={cx}
                        y1={LANE_Y[system]}
                        y2={cy}
                        stroke={SYSTEM_COLOR[system]}
                        strokeOpacity={0.35}
                        strokeDasharray="2 2"
                      />
                    )}
                    {isHome && (
                      <circle cx={cx} cy={cy} r={12} fill="none" stroke={SYSTEM_COLOR[system]} strokeWidth={2} strokeOpacity={0.5} />
                    )}
                    <circle cx={cx} cy={cy} r={7} fill={SYSTEM_COLOR[system]} stroke="white" strokeWidth={1.5} />
                    <text x={cx} y={cy - 14} textAnchor="middle" className="fill-slate-700 text-[12px] font-medium dark:fill-slate-200">
                      {uni.shortName}
                    </text>
                    <text x={cx} y={cy + 4} textAnchor="middle" className="fill-white text-[9px] font-bold">
                      {rank}
                    </text>
                  </g>
                )
              }),
            )}
          </svg>

          {/* Right-edge sentinel for lazy loading */}
          <div ref={sentinelRef} className="absolute right-0 top-0 h-full w-1" aria-hidden />
        </div>
      </div>

      {hasMore && (
        <div className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-400 dark:border-slate-800">
          Scroll right to load more universities…
        </div>
      )}
    </div>
  )
}
