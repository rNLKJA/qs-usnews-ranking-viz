import { useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import type { DatasetMeta, University } from '@/types'

interface RegionalViewProps {
  universities: University[]
  meta: DatasetMeta
}

const W = 900
const H = 460
const M = { top: 24, right: 150, bottom: 40, left: 44 }
const TOPS = [50, 100, 200]
const PALETTE = [
  '#1a4fa0',
  '#ce1126',
  '#1f9d8f',
  '#e0a33d',
  '#7c4dff',
  '#0aa5c9',
  '#d6457f',
  '#5a8f29',
]

/**
 * Regional rank-change over time: for each macro region, how many of its
 * universities sit in the global top-N each year. Uses Times Higher Education
 * (the only multi-year system), so the rise/fall of regions is visible across
 * 2011–2026 — e.g. when a region overtakes another.
 */
export default function RegionalView({ universities, meta }: RegionalViewProps) {
  const years = meta.years
  const [top, setTop] = useState(100)

  const { series, maxCount } = useMemo(() => {
    const regions = [...new Set(universities.map((u) => u.region).filter((r): r is string => !!r))]
    let maxCount = 1
    const series = regions
      .map((region) => {
        const values = years.map((yr) => {
          const count = universities.filter(
            (u) => u.region === region && (u.rankings.the[String(yr)] ?? 1e9) <= top,
          ).length
          if (count > maxCount) maxCount = count
          return { year: yr, count }
        })
        return { region, values, total: values[values.length - 1].count }
      })
      .filter((s) => s.values.some((v) => v.count > 0))
      .sort((a, b) => b.total - a.total)
    return { series, maxCount }
  }, [universities, years, top])

  const x = scaleLinear()
    .domain([years[0], years[years.length - 1]])
    .range([M.left, W - M.right])
  const y = scaleLinear()
    .domain([0, maxCount])
    .range([H - M.bottom, M.top])
    .nice()
  const lineGen = line<{ year: number; count: number }>()
    .x((d) => x(d.year))
    .y((d) => y(d.count))

  return (
    <div className="border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Universities in the global top {top} by region · Times Higher Education · {years[0]}–
          {years[years.length - 1]}
        </p>
        <div className="flex gap-1">
          {TOPS.map((t) => (
            <button
              key={t}
              onClick={() => setTop(t)}
              className={`border px-2.5 py-1 text-[10px] uppercase tracking-widest transition-colors duration-200 ${
                t === top
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              Top {t}
            </button>
          ))}
        </div>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Regional share of the global top ${top}`}
      >
        {y.ticks(5).map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="stroke-border" />
            <text
              x={M.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {t}
            </text>
          </g>
        ))}
        {years.map((yr, i) =>
          (yr - years[0]) % 3 === 0 || i === years.length - 1 ? (
            <text
              key={yr}
              x={x(yr)}
              y={H - M.bottom + 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {yr}
            </text>
          ) : null,
        )}
        {series.map((s, i) => {
          const color = PALETTE[i % PALETTE.length]
          const lastY = y(s.values[s.values.length - 1].count)
          return (
            <g key={s.region}>
              <path
                d={lineGen(s.values) ?? undefined}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeOpacity={0.9}
              />
              <circle cx={x(years[years.length - 1])} cy={lastY} r={3.5} fill={color} />
              <text
                x={W - M.right + 8}
                y={lastY + 4}
                className="text-[11px] font-medium"
                fill={color}
              >
                {s.region} ({s.total})
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
