import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { max as d3max, min as d3min } from 'd3-array'
import { FiExternalLink } from 'react-icons/fi'
import type { DatasetMeta, SystemKey, University } from '@/types'
import { ALL_SYSTEMS, SYSTEM_COLOR, SYSTEM_SHORT, profileUrl } from '@/systems'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import UniversityLogo from './UniversityLogo'

interface TrendModalProps {
  university: University | null
  meta: DatasetMeta
  onClose: () => void
}

const W = 860
const H = 470
const M = { top: 28, right: 28, bottom: 46, left: 52 }

/**
 * Per-university trend: rank (y, rank 1 at top) vs year (x), one series per
 * ranking system. THE carries multi-year history (a real trend line); QS and
 * U.S. News carry the current edition. A faint vertical bar at each year shows
 * how far the systems disagree. Dots at the latest year are labelled with rank.
 */
export default function TrendModal({ university, meta, onClose }: TrendModalProps) {
  const years = meta.years
  const latest = years[years.length - 1]

  const data = useMemo(() => {
    if (!university) return null
    const series: Record<SystemKey, { year: number; rank: number | null }[]> = {
      qs: [],
      usnews: [],
      the: [],
      usnatl: [],
    }
    const ranks: number[] = []
    for (const s of ALL_SYSTEMS)
      series[s] = years.map((yr) => {
        const rank = university.rankings[s][String(yr)] ?? null
        if (rank != null) ranks.push(rank)
        return { year: yr, rank }
      })
    return { series, lo: d3min(ranks) ?? 1, hi: d3max(ranks) ?? 50 }
  }, [university, years])

  const x = useMemo(() => {
    const lo = years[0]
    const hi = years[years.length - 1]
    return scaleLinear()
      .domain(lo === hi ? [lo - 1, hi + 1] : [lo, hi])
      .range([M.left, W - M.right])
  }, [years])
  const y = useMemo(() => {
    const lo = data?.lo ?? 1
    const hi = data?.hi ?? 50
    const pad = Math.max(1, Math.round((hi - lo) * 0.12))
    return scaleLinear()
      .domain([Math.max(1, lo - pad), hi + pad])
      .range([M.top, H - M.bottom])
  }, [data])

  const lineGen = useMemo(
    () =>
      line<{ year: number; rank: number | null }>()
        .defined((d) => d.rank != null)
        .x((d) => x(d.year))
        .y((d) => y(d.rank as number)),
    [x, y],
  )

  return (
    <Dialog open={!!university} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-5 overflow-auto rounded-none border-border p-6 shadow-none sm:max-w-4xl">
        {university && data && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <UniversityLogo university={university} size={40} />
                <div className="text-left">
                  <DialogTitle className="text-lg font-medium tracking-tight">
                    {university.name}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] uppercase tracking-widest">
                    {[university.city, university.country].filter(Boolean).join(' · ')} · {years[0]}
                    –{latest}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              {ALL_SYSTEMS.map((s) => (
                <span key={s} className="inline-flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ background: SYSTEM_COLOR[s] }}
                  />
                  {meta.systemLabels[s]}
                </span>
              ))}
            </div>

            <svg
              width="100%"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`Rank trend for ${university.name}`}
            >
              {y.ticks(6).map((t) => (
                <g key={t}>
                  <line
                    x1={M.left}
                    x2={W - M.right}
                    y1={y(t)}
                    y2={y(t)}
                    className="stroke-border"
                  />
                  <text
                    x={M.left - 10}
                    y={y(t) + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[11px]"
                  >
                    #{t}
                  </text>
                </g>
              ))}
              {years.map((yr, i) => {
                const show = (yr - years[0]) % 3 === 0 || i === years.length - 1
                return (
                  <g key={yr}>
                    <line
                      x1={x(yr)}
                      x2={x(yr)}
                      y1={H - M.bottom}
                      y2={H - M.bottom + 5}
                      className="stroke-border"
                    />
                    {show && (
                      <text
                        x={x(yr)}
                        y={H - M.bottom + 20}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[11px]"
                      >
                        {yr}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* cross-system spread per year */}
              {years.map((yr) => {
                const rs = ALL_SYSTEMS.map((s) => university.rankings[s][String(yr)]).filter(
                  (r): r is number => r != null,
                )
                if (rs.length < 2) return null
                return (
                  <line
                    key={`sp-${yr}`}
                    x1={x(yr)}
                    x2={x(yr)}
                    y1={y(Math.min(...rs))}
                    y2={y(Math.max(...rs))}
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={10}
                    strokeLinecap="round"
                    opacity={0.18}
                  />
                )
              })}

              {/* trend line + points per system */}
              {ALL_SYSTEMS.map((s) => {
                const pts = data.series[s]
                const present = pts.filter((p) => p.rank != null)
                const single = present.length <= 1
                return (
                  <g key={s}>
                    {present.length > 1 && (
                      <path
                        d={lineGen(pts) ?? undefined}
                        fill="none"
                        stroke={SYSTEM_COLOR[s]}
                        strokeWidth={2.5}
                        strokeOpacity={0.85}
                      />
                    )}
                    {pts.map((p) => {
                      if (p.rank == null) return null
                      const labelled = single || p.year === latest
                      return (
                        <g key={`${s}-${p.year}`}>
                          <circle
                            cx={x(p.year)}
                            cy={y(p.rank)}
                            r={labelled ? 13 : 4.5}
                            fill={SYSTEM_COLOR[s]}
                            stroke="white"
                            strokeWidth={labelled ? 2 : 1}
                          >
                            <title>
                              {meta.systemLabels[s]} {p.year}: #{p.rank}
                            </title>
                          </circle>
                          {labelled && (
                            <text
                              x={x(p.year)}
                              y={y(p.rank)}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-white text-[10px] font-semibold"
                            >
                              {p.rank}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </svg>

            {university.description && (
              <p className="max-h-28 overflow-y-auto text-sm font-light leading-relaxed text-muted-foreground">
                {university.description}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {ALL_SYSTEMS.map((s) => {
                const url = profileUrl(university, s)
                return url ? (
                  <a
                    key={s}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[11px] uppercase tracking-widest transition-colors duration-200 hover:bg-foreground hover:text-background"
                  >
                    <FiExternalLink className="size-3.5" /> {SYSTEM_SHORT[s]} page
                  </a>
                ) : null
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
