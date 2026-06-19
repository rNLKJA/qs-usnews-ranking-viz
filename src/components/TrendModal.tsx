import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { max as d3max, min as d3min } from 'd3-array'
import type { DatasetMeta, SystemKey, University } from '@/types'
import { ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import UniversityLogo from './UniversityLogo'

interface TrendModalProps {
  university: University | null
  meta: DatasetMeta
  onClose: () => void
}

const SYSTEMS: SystemKey[] = ['qs', 'usnews']
const SYSTEM_COLOR: Record<SystemKey, string> = {
  qs: 'var(--color-qs)',
  usnews: 'var(--color-usnews)',
}
const GAP_COLOR = 'var(--color-gap)'

const W = 660
const H = 420
const M = { top: 32, right: 24, bottom: 44, left: 48 }

/**
 * Per-university trend: scatter of rank (y, rank 1 at top) vs year (x). QS and
 * US News each get a trend line, and for every year where both have a value a
 * vertical error bar connects the two points, labelled with the rank gap.
 */
export default function TrendModal({ university, meta, onClose }: TrendModalProps) {
  const years = meta.years

  const series = useMemo(() => {
    if (!university) return null
    const points: Record<SystemKey, { year: number; rank: number | null }[]> = {
      qs: years.map((yr) => ({ year: yr, rank: university.rankings.qs[String(yr)] ?? null })),
      usnews: years.map((yr) => ({ year: yr, rank: university.rankings.usnews[String(yr)] ?? null })),
    }
    const allRanks = [...points.qs, ...points.usnews]
      .map((p) => p.rank)
      .filter((r): r is number => r != null)
    return { points, lo: d3min(allRanks) ?? 1, hi: d3max(allRanks) ?? 50 }
  }, [university, years])

  const x = useMemo(
    () => scaleLinear().domain([years[0], years[years.length - 1]]).range([M.left, W - M.right]),
    [years],
  )
  const y = useMemo(() => {
    const lo = series?.lo ?? 1
    const hi = series?.hi ?? 50
    const pad = Math.max(1, Math.round((hi - lo) * 0.12))
    return scaleLinear().domain([Math.max(1, lo - pad), hi + pad]).range([M.top, H - M.bottom])
  }, [series])

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
      <DialogContent className="max-h-[92vh] gap-4 overflow-auto rounded-3xl sm:max-w-3xl">
        {university && series && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <UniversityLogo university={university} size={44} />
                <div className="text-left">
                  <DialogTitle className="text-lg">{university.name}</DialogTitle>
                  <DialogDescription>
                    {university.country} · rank trend {years[0]}–{years[years.length - 1]}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm">
              {SYSTEMS.map((s) => (
                <span key={s} className="inline-flex items-center gap-2">
                  <span className="inline-block size-3 rounded-full" style={{ background: SYSTEM_COLOR[s] }} />
                  {meta.systemLabels[s]}
                </span>
              ))}
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span className="inline-block h-3 w-[2px]" style={{ background: GAP_COLOR }} /> gap between systems
              </span>
            </div>

            <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rank trend for ${university.name}`}>
              {y.ticks(6).map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="stroke-border/70" />
                  <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                    #{t}
                  </text>
                </g>
              ))}

              {years.map((yr, i) => {
                // Thin the labels when the range is long (e.g. 2000–2026).
                const isLast = i === years.length - 1
                const show = years.length <= 10 || (yr - years[0]) % 4 === 0 || isLast
                return (
                  <g key={yr}>
                    <line x1={x(yr)} x2={x(yr)} y1={H - M.bottom} y2={H - M.bottom + 5} className="stroke-border" />
                    {show && (
                      <text x={x(yr)} y={H - M.bottom + 20} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                        {yr}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Error bars between QS and US News */}
              {years.map((yr) => {
                const q = university.rankings.qs[String(yr)]
                const u = university.rankings.usnews[String(yr)]
                if (q == null || u == null) return null
                const yq = y(q)
                const yu = y(u)
                const cx = x(yr)
                return (
                  <g key={`gap-${yr}`}>
                    <line x1={cx} x2={cx} y1={yq} y2={yu} stroke={GAP_COLOR} strokeWidth={1.5} />
                    <line x1={cx - 4} x2={cx + 4} y1={yq} y2={yq} stroke={GAP_COLOR} strokeWidth={1.5} />
                    <line x1={cx - 4} x2={cx + 4} y1={yu} y2={yu} stroke={GAP_COLOR} strokeWidth={1.5} />
                    <text x={cx + 7} y={(yq + yu) / 2 + 3} className="fill-muted-foreground text-[10px] font-medium">
                      {Math.abs(q - u)}
                    </text>
                  </g>
                )
              })}

              {/* Trend lines + points */}
              {SYSTEMS.map((s) => (
                <g key={s}>
                  <path d={lineGen(series.points[s]) ?? undefined} fill="none" stroke={SYSTEM_COLOR[s]} strokeWidth={2.5} strokeOpacity={0.9} />
                  {series.points[s].map((p) =>
                    p.rank == null ? null : (
                      <circle key={`${s}-${p.year}`} cx={x(p.year)} cy={y(p.rank)} r={5} fill={SYSTEM_COLOR[s]} stroke="white" strokeWidth={1.5}>
                        <title>
                          {meta.systemLabels[s]} {p.year}: #{p.rank}
                        </title>
                      </circle>
                    ),
                  )}
                </g>
              ))}
            </svg>

            {/* Links to the source ranking pages */}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <a href={university.qsUrl} target="_blank" rel="noreferrer" style={{ color: SYSTEM_COLOR.qs }}>
                  <ExternalLink className="size-3.5" /> QS ranking page
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <a href={university.usnewsUrl} target="_blank" rel="noreferrer" style={{ color: SYSTEM_COLOR.usnews }}>
                  <ExternalLink className="size-3.5" /> US News ranking page
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
