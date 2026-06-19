import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { max as d3max, min as d3min } from 'd3-array'
import { FiExternalLink } from 'react-icons/fi'
import type { DatasetMeta, SystemKey, University } from '@/types'
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

const SYSTEMS: SystemKey[] = ['qs', 'usnews']
const SYSTEM_COLOR: Record<SystemKey, string> = {
  qs: 'var(--color-qs)',
  usnews: 'var(--color-usnews)',
}
const UP = 'var(--color-up)'
const DOWN = 'var(--color-down)'

const W = 820
const H = 470
const M = { top: 28, right: 28, bottom: 46, left: 52 }
const R = 14 // dot radius

/**
 * Per-university trend: a dot plot of rank (y, rank 1 at top) vs year (x).
 * Each dot is labelled with the rank. No trend line. For every year where both
 * systems have a value, a thick connector (the same width as a dot) joins the
 * QS and US News dots — coloured blue when the rank increases from QS to US
 * News, red when it decreases.
 */
export default function TrendModal({ university, meta, onClose }: TrendModalProps) {
  const years = meta.years

  const bounds = useMemo(() => {
    if (!university) return null
    const all = SYSTEMS.flatMap((s) => years.map((yr) => university.rankings[s][String(yr)]))
      .filter((r): r is number => r != null)
    return { lo: d3min(all) ?? 1, hi: d3max(all) ?? 50 }
  }, [university, years])

  const x = useMemo(
    () => scaleLinear().domain([years[0], years[years.length - 1]]).range([M.left, W - M.right]),
    [years],
  )
  const y = useMemo(() => {
    const lo = bounds?.lo ?? 1
    const hi = bounds?.hi ?? 50
    const pad = Math.max(1, Math.round((hi - lo) * 0.12))
    return scaleLinear().domain([Math.max(1, lo - pad), hi + pad]).range([M.top, H - M.bottom])
  }, [bounds])

  return (
    <Dialog open={!!university} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-5 overflow-auto rounded-none border-border p-6 shadow-none sm:max-w-4xl">
        {university && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <UniversityLogo university={university} size={44} />
                <div className="text-left">
                  <DialogTitle className="text-lg font-medium tracking-tight">{university.name}</DialogTitle>
                  <DialogDescription className="text-[11px] uppercase tracking-widest">
                    {university.country} · {years[0]}–{years[years.length - 1]}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              {SYSTEMS.map((s) => (
                <span key={s} className="inline-flex items-center gap-2">
                  <span className="inline-block size-3 rounded-full" style={{ background: SYSTEM_COLOR[s] }} />
                  {s === 'qs' ? 'QS' : 'US News'}
                </span>
              ))}
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2.5 w-4" style={{ background: UP }} /> increase
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2.5 w-4" style={{ background: DOWN }} /> decrease
              </span>
            </div>

            <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rank dot plot for ${university.name}`}>
              {/* Y gridlines + labels */}
              {y.ticks(6).map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="stroke-border" />
                  <text x={M.left - 10} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                    #{t}
                  </text>
                </g>
              ))}

              {/* X ticks + thinned labels */}
              {years.map((yr, i) => {
                const isLast = i === years.length - 1
                const show = (yr - years[0]) % 3 === 0 || isLast
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

              {/* Connectors between QS and US News (same width as a dot) */}
              {years.map((yr) => {
                const q = university.rankings.qs[String(yr)]
                const u = university.rankings.usnews[String(yr)]
                if (q == null || u == null) return null
                const dir = u > q ? UP : DOWN
                return (
                  <line
                    key={`bar-${yr}`}
                    x1={x(yr)}
                    x2={x(yr)}
                    y1={y(q)}
                    y2={y(u)}
                    stroke={dir}
                    strokeWidth={R * 2}
                    strokeLinecap="round"
                    opacity={0.4}
                  />
                )
              })}

              {/* Dots with rank data labels */}
              {SYSTEMS.map((s) =>
                years.map((yr) => {
                  const r = university.rankings[s][String(yr)]
                  if (r == null) return null
                  return (
                    <g key={`${s}-${yr}`}>
                      <circle cx={x(yr)} cy={y(r)} r={R} fill={SYSTEM_COLOR[s]} stroke="white" strokeWidth={2} />
                      <text
                        x={x(yr)}
                        y={y(r)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-white text-[11px] font-semibold"
                      >
                        {r}
                      </text>
                    </g>
                  )
                }),
              )}
            </svg>

            {/* Source links — outlined, invert on hover (Nothing) */}
            <div className="flex flex-wrap gap-3">
              <a
                href={university.qsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[11px] uppercase tracking-widest transition-colors duration-200 hover:bg-foreground hover:text-background"
              >
                <FiExternalLink className="size-3.5" /> QS ranking page
              </a>
              <a
                href={university.usnewsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[11px] uppercase tracking-widest transition-colors duration-200 hover:bg-foreground hover:text-background"
              >
                <FiExternalLink className="size-3.5" /> US News ranking page
              </a>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
