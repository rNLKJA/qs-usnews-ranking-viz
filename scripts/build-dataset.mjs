#!/usr/bin/env node
/**
 * build-dataset.mjs — generate the FAIR ranking dataset + the website JSON.
 *
 * NO data is hard-coded. Everything is pulled live from official endpoints:
 *  - QS World University Rankings  (topuniversities.com REST endpoint)
 *  - U.S. News Best Global Universities  (usnews.com JSON API; needs Node fetch,
 *    curl is Cloudflare-blocked)
 *
 * Both APIs only serve their CURRENT edition, so this is a current-year
 * (2026) cross-system snapshot. Historical years and Times Higher Education are
 * documented as a backfill step (see Notes/DATA_PIPELINE.md) — they require
 * archived public datasets, not these live APIs.
 *
 * Outputs (all under public/data/, so they are downloadable = FAIR Accessible):
 *  - universities.json   the website data
 *  - universities.csv    one row per university (info)            [FAIR]
 *  - rankings.csv         tidy long format: id, system, year, rank [FAIR]
 *  - datapackage.json     Frictionless Data descriptor + metadata  [FAIR]
 *  - README.md, LICENSE   provenance + CC-BY-4.0                   [FAIR]
 *
 * Run: npm run data
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(__dirname, '..', 'public', 'data')
const QS_NID = '4153156' // QS World University Rankings 2026 edition
const DATA_YEAR = 2026
const YEARS = [DATA_YEAR] // current edition only; see Notes/DATA_PIPELINE.md
const VERSION = `${DATA_YEAR}.1`
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const parseRank = (s) => {
  const m = String(s ?? '').replace(/[,\s]/g, '').match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}
const slugOf = (p) => String(p || '').split('/').filter(Boolean).pop() || ''
const shortNameOf = (title) => {
  const m = title.match(/\(([^)]+)\)/)
  if (m && m[1].length <= 8) return m[1]
  return title.replace(/\([^)]*\)/g, '').trim().split(/\s+/).slice(0, 2).join(' ')
}
const normKey = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(universit\w*|the|of|at)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

async function fetchQs() {
  const perPage = 500
  let page = 0
  let total = Infinity
  const nodes = []
  while (nodes.length < total && page <= 50) {
    const url = `https://www.topuniversities.com/rankings/endpoint?nid=${QS_NID}&page=${page}&items_per_page=${perPage}&tab=indicators`
    const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.topuniversities.com/world-university-rankings', Accept: 'application/json' } })
    if (!res.ok) throw new Error(`QS fetch failed: ${res.status}`)
    const data = await res.json()
    total = data.total_record
    nodes.push(...data.score_nodes)
    process.stdout.write(`\rQS: ${nodes.length}/${total}`)
    page += 1
    await new Promise((r) => setTimeout(r, 250))
  }
  process.stdout.write('\n')
  return nodes
}

async function fetchUsNews() {
  const items = []
  let page = 1
  let totalPages = 1
  do {
    const url = `https://www.usnews.com/education/best-global-universities/api/search?format=json&page=${page}`
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.usnews.com/education/best-global-universities/rankings' } })
    if (!res.ok) {
      if (page === 1) throw new Error(`U.S. News fetch failed: ${res.status}`)
      break
    }
    const data = await res.json()
    totalPages = data.total_pages
    for (const it of data.items || []) {
      const rk = (it.ranks || []).find((r) => /best global/i.test(r.label))
      const rank = parseRank(rk?.value)
      if (rank == null) continue
      items.push({ name: it.name, country: it.country_name || '', city: clean(it.city), url: it.url, rank, blurb: clean(it.blurb) })
    }
    process.stdout.write(`\rU.S. News: page ${page}/${totalPages} (${items.length})`)
    page += 1
    await new Promise((r) => setTimeout(r, 180))
  } while (page <= totalPages && page <= 300)
  process.stdout.write('\n')
  return items
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n'

async function main() {
  const nodes = await fetchQs()
  const usnItems = await fetchUsNews()

  // country -> region, learned from QS (no hard-coded geography).
  const regionByCountry = new Map()
  for (const n of nodes) if (n.country && n.region) regionByCountry.set(n.country, n.region)

  const usnByKey = new Map()
  for (const u of usnItems) {
    const k = normKey(u.name)
    if (k && !usnByKey.has(k)) usnByKey.set(k, u)
  }
  const usedUsn = new Set()
  const universities = []
  const seen = new Set()
  let matched = 0

  for (const n of nodes) {
    const slug = slugOf(n.path)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    const rank = parseRank(n.rank_display ?? n.rank)
    if (rank == null) continue
    const key = normKey(n.title)
    const usn = usnByKey.get(key)
    if (usn) {
      usedUsn.add(key)
      matched += 1
    }
    universities.push({
      id: slug,
      name: clean(n.title),
      country: clean(n.country),
      region: clean(n.region),
      city: clean(n.city) || (usn ? usn.city : ''),
      description: usn ? usn.blurb : '',
      logo: n.logo || undefined,
      qsUrl: `https://www.topuniversities.com${n.path}`,
      ...(usn ? { usnewsUrl: usn.url } : {}),
      rankings: {
        qs: { [DATA_YEAR]: rank },
        usnews: { [DATA_YEAR]: usn ? usn.rank : null },
      },
    })
  }

  let usnOnly = 0
  for (const u of usnItems) {
    const key = normKey(u.name)
    if (!key || usedUsn.has(key)) continue
    usedUsn.add(key)
    universities.push({
      id: `usn-${slugOf(u.url) || key.replace(/\s+/g, '-')}`,
      name: clean(u.name),
      country: clean(u.country),
      region: regionByCountry.get(u.country) || '',
      city: clean(u.city),
      description: u.blurb,
      usnewsUrl: u.url,
      rankings: { qs: { [DATA_YEAR]: null }, usnews: { [DATA_YEAR]: u.rank } },
    })
    usnOnly += 1
  }

  const best = (u) => Math.min(u.rankings.qs[DATA_YEAR] ?? 9e9, u.rankings.usnews[DATA_YEAR] ?? 9e9)
  universities.sort((a, b) => best(a) - best(b))
  for (const u of universities) if (!u.description) delete u.description

  const meta = {
    years: YEARS,
    systems: ['qs', 'usnews'],
    systemLabels: { qs: 'QS World University Rankings', usnews: 'U.S. News & World Report' },
    systemShort: { qs: 'QS', usnews: 'U.S. News' },
    defaultUniversity: universities[0]?.id ?? null,
    version: VERSION,
    license: 'CC-BY-4.0',
    sources: {
      qs: 'https://www.topuniversities.com/world-university-rankings',
      usnews: 'https://www.usnews.com/education/best-global-universities/rankings',
    },
    coverage: `QS (${nodes.length}) and U.S. News (${usnItems.length}) ${DATA_YEAR} editions; ${matched} matched across both. Current edition only — the live APIs do not expose historical years.`,
  }

  // ---- website JSON ----
  await writeFile(path.join(DIR, 'universities.json'), JSON.stringify({ meta, universities }) + '\n')

  // ---- FAIR: universities.csv (info) + rankings.csv (long) ----
  const uniRows = universities.map((u) => ({
    id: u.id, name: u.name, country: u.country, region: u.region, city: u.city,
    description: u.description || '', qs_url: u.qsUrl || '', usnews_url: u.usnewsUrl || '',
  }))
  await writeFile(path.join(DIR, 'universities.csv'), toCsv(uniRows, ['id', 'name', 'country', 'region', 'city', 'description', 'qs_url', 'usnews_url']))

  const rankRows = []
  for (const u of universities)
    for (const sys of ['qs', 'usnews'])
      for (const yr of YEARS) {
        const rank = u.rankings[sys][yr]
        if (rank != null) rankRows.push({ university_id: u.id, system: sys, year: yr, rank })
      }
  await writeFile(path.join(DIR, 'rankings.csv'), toCsv(rankRows, ['university_id', 'system', 'year', 'rank']))

  // ---- FAIR: Frictionless datapackage descriptor ----
  const datapackage = {
    name: 'world-university-rankings',
    title: 'World University Rankings — QS & U.S. News',
    description: meta.coverage,
    version: VERSION,
    licenses: [{ name: 'CC-BY-4.0', path: 'https://creativecommons.org/licenses/by/4.0/', title: 'Creative Commons Attribution 4.0' }],
    homepage: 'https://github.com/rNLKJA/qs-usnews-ranking-viz',
    sources: [
      { title: 'QS World University Rankings', path: meta.sources.qs },
      { title: 'U.S. News Best Global Universities', path: meta.sources.usnews },
    ],
    resources: [
      {
        name: 'universities', path: 'universities.csv', format: 'csv', mediatype: 'text/csv',
        schema: { primaryKey: 'id', fields: [
          { name: 'id', type: 'string', description: 'Stable identifier (QS profile slug, or usn-<slug>)' },
          { name: 'name', type: 'string' }, { name: 'country', type: 'string' },
          { name: 'region', type: 'string' }, { name: 'city', type: 'string', title: 'Location' },
          { name: 'description', type: 'string' }, { name: 'qs_url', type: 'string', format: 'uri' },
          { name: 'usnews_url', type: 'string', format: 'uri' },
        ] },
      },
      {
        name: 'rankings', path: 'rankings.csv', format: 'csv', mediatype: 'text/csv',
        schema: { foreignKeys: [{ fields: 'university_id', reference: { resource: 'universities', fields: 'id' } }], fields: [
          { name: 'university_id', type: 'string' },
          { name: 'system', type: 'string', constraints: { enum: ['qs', 'usnews'] } },
          { name: 'year', type: 'integer' }, { name: 'rank', type: 'integer', description: 'World rank (lower is better)' },
        ] },
      },
    ],
  }
  await writeFile(path.join(DIR, 'datapackage.json'), JSON.stringify(datapackage, null, 2) + '\n')

  // ---- FAIR: README + LICENSE ----
  const readme = `# World University Rankings — QS & U.S. News (${VERSION})

A tidy, openly-licensed dataset of world university rankings, built for trend and
cross-system comparison. **${universities.length}** universities.

## Files
- \`universities.csv\` — one row per university: id, name, country, region, city (location), description, profile links.
- \`rankings.csv\` — tidy long format: \`university_id, system, year, rank\` (lower rank = better).
- \`universities.json\` — the same data as nested JSON (used by the web app).
- \`datapackage.json\` — [Frictionless](https://frictionlessdata.io/) descriptor with field schemas.

## Coverage
${meta.coverage}

## FAIR
- **Findable** — stable per-university \`id\`; versioned (\`${VERSION}\`); datapackage metadata.
- **Accessible** — open CSV/JSON over HTTPS, no auth.
- **Interoperable** — tidy long format, Frictionless schema, normalised country→region.
- **Reusable** — CC-BY-4.0 with documented provenance below.

## Provenance
Generated by \`scripts/build-dataset.mjs\` directly from the official endpoints
(QS: ${meta.sources.qs}; U.S. News: ${meta.sources.usnews}). No values are
hand-entered. Historical years and Times Higher Education are not yet included —
the live APIs only serve the current edition; see \`Notes/DATA_PIPELINE.md\`.

## Citation
QS data © Quacquarelli Symonds; U.S. News data © U.S. News & World Report. This
compilation is licensed CC-BY-4.0 — attribute "rNLKJA / Ranking Radar".
`
  await writeFile(path.join(DIR, 'README.md'), readme)
  await writeFile(
    path.join(DIR, 'LICENSE'),
    'This dataset is licensed under the Creative Commons Attribution 4.0 International License (CC-BY-4.0).\nhttps://creativecommons.org/licenses/by/4.0/\n',
  )

  console.log(
    `\nWrote ${universities.length} universities + FAIR package → ${DIR}\n` +
      `  QS ${nodes.length} · U.S. News ${usnItems.length} · matched ${matched} · U.S. News-only ${usnOnly}\n` +
      `  files: universities.json, universities.csv, rankings.csv, datapackage.json, README.md, LICENSE`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
