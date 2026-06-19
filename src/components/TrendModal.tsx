import { useEffect, useMemo, useRef } from 'react'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { max as d3max, min as d3min } from 'd3-array'
import type { DatasetMeta, SystemKey, University } from '../types'

interface TrendModalProps {
  university: University | null
  meta: DatasetMeta
  onClose: () => void
}

const SYSTEMS: SystemKey[] = ['qs', 'usnews']
const SYSTEM_COLOR: Record<SystemKey, string> = { qs: '#2563eb', usnews: '#dc2626' }

const W = 660
const H = 420
const M = { top: 32, right: 24, bottom: 44, left: 48 }

/**
 * Per-university trend: a scatter plot with x = year and y = rank (rank 1 at the
 * top). QS and US News each get a trend line through their non-null years, and
 * for every year where both systems have a value a vertical error bar connects
 * the two points, labelled with the rank gap between the systems.
 */
export default function TrendModal({ university, meta, onClose }: TrendModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  // Open/close the native dialog in sync with the selected university.
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    dlg.setAttribute('closedby', 'any') // declarative light-dismiss where supported
    if (university && !dlg.open) dlg.showModal()
    if (!university && dlg.open) dlg.close()
  }, [university])

  // Light-dismiss fallback for browsers without <dialog closedby> (e.g. Safari).
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if ('closedBy' in HTMLDialogElement.prototype) return
    const onClick = (event: MouseEvent) => {
      if (event.target !== dlg) return
      const r = dlg.getBoundingClientRect()
      const inside =
        r.top <= event.clientY &&
        event.clientY <= r.top + r.height &&
        r.left <= event.clientX &&
        event.clientX <= r.left + r.width
      if (!inside) dlg.close()
    }
    dlg.addEventListener('click', onClick)
    return () => dlg.removeEventListener('click', onClick)
  }, [])

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
    const lo = d3min(allRanks) ?? 1
    const hi = d3max(allRanks) ?? 50
    return { points, lo, hi }
  }, [university, years])

  const x = useMemo(
    () => scaleLinear().domain([years[0], years[years.length - 1]]).range([M.left, W - M.right]),
    [years],
  )
  const y = useMemo(() => {
    const lo = series?.lo ?? 1
    const hi = series?.hi ?? 50
    const pad = Math.max(1, Math.round((hi - lo) * 0.12))
    // Inverted: best rank (small number) at the top.
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
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="trend-title"
      className="w-[92vw] max-w-3xl rounded-2xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100"
    >
      {university && series && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="trend-title" className="text-xl font-semibold">
                {university.name}
              </h2>
              <p className="text-sm text-slate-500">{university.country} · rank trend {years[0]}–{years[years.length - 1]}</p>
            </div>
            <button
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Legend */}
          <div className="mb-2 flex gap-5 text-sm">
            {SYSTEMS.map((s) => (
              <span key={s} className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: SYSTEM_COLOR[s] }} />
                {meta.systemLabels[s]}
              </span>
            ))}
            <span className="inline-flex items-center gap-2 text-slate-500">
              <span className="inline-block h-3 w-[2px] bg-slate-400" /> gap between systems
            </span>
          </div>

          <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rank trend chart for ${university.name}`}>
            {/* Y gridlines + labels */}
            {y.ticks(6).map((t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="stroke-slate-100 dark:stroke-slate-800" />
                <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
                  #{t}
                </text>
              </g>
            ))}

            {/* X labels (years) */}
            {years.map((yr) => (
              <text key={yr} x={x(yr)} y={H - M.bottom + 20} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {yr}
              </text>
            ))}

            {/* Error bars: gap between QS and US News for shared years */}
            {years.map((yr) => {
              const q = university.rankings.qs[String(yr)]
              const u = university.rankings.usnews[String(yr)]
              if (q == null || u == null) return null
              const yq = y(q)
              const yu = y(u)
              const cx = x(yr)
              const midY = (yq + yu) / 2
              return (
                <g key={`gap-${yr}`}>
                  <line x1={cx} x2={cx} y1={yq} y2={yu} stroke="#94a3b8" strokeWidth={1.5} />
                  <line x1={cx - 4} x2={cx + 4} y1={yq} y2={yq} stroke="#94a3b8" strokeWidth={1.5} />
                  <line x1={cx - 4} x2={cx + 4} y1={yu} y2={yu} stroke="#94a3b8" strokeWidth={1.5} />
                  <text x={cx + 7} y={midY + 3} className="fill-slate-500 text-[10px] font-medium">
                    {Math.abs(q - u)}
                  </text>
                </g>
              )
            })}

            {/* Trend lines + points per system */}
            {SYSTEMS.map((s) => (
              <g key={s}>
                <path
                  d={lineGen(series.points[s]) ?? undefined}
                  fill="none"
                  stroke={SYSTEM_COLOR[s]}
                  strokeWidth={2.5}
                  strokeOpacity={0.85}
                />
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
        </div>
      )}
    </dialog>
  )
}
