import { useEffect, useMemo, useRef } from 'react'
import { scaleLinear } from 'd3-scale'
import type { SystemKey, University } from '../types'
import UniversityLogo from './UniversityLogo'

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
const SYSTEM_COLOR: Record<SystemKey, string> = { qs: '#2563eb', usnews: '#dc2626' }

const MARGIN = { left: 48, right: 140 }
const PX_PER_RANK = 30
const MIN_WIDTH = 900
const HEIGHT = 500
const LANE_Y: Record<SystemKey, number> = { qs: 150, usnews: 360 }
const STACK_STEP = 96

/**
 * Overall view for the selected year: rank 1 at the left end, universities
 * placed along the axis by their rank, ties stacked vertically. Two lanes —
 * QS on top, US News below. Each university shows as its logo with the full
 * name beneath; hovering reveals a card with details and links to its QS and
 * US News ranking pages. No error bars here — those live in the per-university
 * trend modal. Wider than the viewport, so scrolling right lazily reveals more.
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
    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {activeSystems.map((system) => (
        <div
          key={system}
          className="pointer-events-none absolute left-0 z-20 -translate-y-1/2 rounded-r-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white"
          style={{ top: LANE_Y[system], background: SYSTEM_COLOR[system] }}
        >
          {system === 'qs' ? 'QS' : 'US News'}
        </div>
      ))}

      <div data-scroll-root className="overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width: chartWidth, height: HEIGHT }}>
          {/* Background axis layer */}
          <svg width={chartWidth} height={HEIGHT} className="absolute inset-0" aria-hidden>
            {ticks.map((r) => (
              <g key={r}>
                <line x1={x(r)} x2={x(r)} y1={28} y2={HEIGHT - 20} className="stroke-slate-100 dark:stroke-slate-800" />
                <text x={x(r)} y={20} textAnchor="middle" className="fill-slate-400 text-[11px]">
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
                strokeOpacity={0.25}
                strokeWidth={2}
              />
            ))}
          </svg>

          {/* HTML markers: logo + full name, with hover card */}
          {activeSystems.map((system) =>
            laid[system].map(({ uni, rank, offset }) => {
              const cx = x(rank)
              const cy = LANE_Y[system] - offset * STACK_STEP
              const openDown = system === 'qs'
              const isHome = uni.id === defaultId
              return (
                <div
                  key={`${system}-${uni.id}`}
                  className="group absolute hover:z-50"
                  style={{ left: cx, top: cy, width: 0, height: 0 }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(uni.id)}
                    className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg p-1 text-center transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 dark:hover:bg-slate-800"
                    style={{ outlineColor: SYSTEM_COLOR[system] }}
                  >
                    <span className="relative">
                      <UniversityLogo university={uni} size={46} />
                      <span
                        className="absolute -bottom-1.5 -right-1.5 rounded-full px-1.5 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900"
                        style={{ background: SYSTEM_COLOR[system] }}
                      >
                        {rank}
                      </span>
                      {isHome && (
                        <span
                          className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900"
                          style={{ background: SYSTEM_COLOR[system] }}
                          title="Your home university"
                        />
                      )}
                    </span>
                    <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-200">
                      {uni.name}
                    </span>
                  </button>

                  {/* Hover / focus info card */}
                  <div
                    className="invisible absolute left-0 z-50 w-60 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-800"
                    style={openDown ? { top: 64 } : { bottom: 64 }}
                  >
                    <div className="flex items-center gap-2">
                      <UniversityLogo university={uni} size={32} />
                      <div>
                        <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">{uni.name}</p>
                        <p className="text-xs text-slate-500">{uni.country}</p>
                      </div>
                    </div>
                    <dl className="mt-2 space-y-0.5 text-xs">
                      {ALL_SYSTEMS.map((s) => (
                        <div key={s} className="flex justify-between gap-2">
                          <dt className="text-slate-500">{s === 'qs' ? 'QS' : 'US News'} {year}</dt>
                          <dd className="font-semibold" style={{ color: SYSTEM_COLOR[s] }}>
                            {uni.rankings[s][String(year)] != null ? `#${uni.rankings[s][String(year)]}` : '—'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2 flex flex-col gap-1 text-xs">
                      <a href={uni.qsUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">
                        QS ranking page ↗
                      </a>
                      <a href={uni.usnewsUrl} target="_blank" rel="noreferrer" className="font-medium text-red-600 hover:underline">
                        US News ranking page ↗
                      </a>
                      <button onClick={() => onSelect(uni.id)} className="mt-1 rounded-md bg-slate-900 py-1 text-center text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900">
                        View trend over years
                      </button>
                    </div>
                    <span className="sr-only">{systemLabels[system]}</span>
                  </div>
                </div>
              )
            }),
          )}

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
