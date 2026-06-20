#!/usr/bin/env node
/**
 * build-dataset.mjs — generate the FAIR ranking dataset + the website JSON.
 *
 * NO data is hard-coded. Everything is pulled live from official endpoints:
 *  - QS World University Rankings      (topuniversities.com REST endpoint) — current edition
 *  - U.S. News Best Global Universities (usnews.com JSON API; Node fetch)   — current edition
 *  - Times Higher Education WUR         (timeshighereducation.com JSON API)  — 2011–present (multi-year!)
 *
 * THE is the multi-year backbone (the QS & U.S. News APIs only serve their
 * current edition). Systems are matched across by normalised name.
 *
 * Outputs (public/data/, downloadable = FAIR Accessible):
 *   universities.json · universities.csv · rankings.csv · datapackage.json · README.md · LICENSE
 *
 * Run: npm run data
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(__dirname, '..', 'public', 'data')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const QS_NID = '4153156'
const CURRENT = 2026
const THE_FROM = 2011
const YEARS = Array.from({ length: CURRENT - THE_FROM + 1 }, (_, i) => THE_FROM + i)
const VERSION = `${CURRENT}.2`

const parseRank = (s) => {
  const m = String(s ?? '').replace(/[,\s]/g, '').match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}
const slugOf = (p) => String(p || '').split('/').filter(Boolean).pop() || ''
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const normKey = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(universit\w*|the|of|at)\b/g, ' ').replace(/\s+/g, ' ').trim()
const emptyYears = () => Object.fromEntries(YEARS.map((y) => [String(y), null]))

async function fetchQs() {
  const nodes = []
  let page = 0, total = Infinity
  while (nodes.length < total && page <= 50) {
    const r = await fetch(`https://www.topuniversities.com/rankings/endpoint?nid=${QS_NID}&page=${page}&items_per_page=500&tab=indicators`,
      { headers: { 'User-Agent': UA, Referer: 'https://www.topuniversities.com/world-university-rankings', Accept: 'application/json' } })
    if (!r.ok) throw new Error('QS ' + r.status)
    const d = await r.json(); total = d.total_record; nodes.push(...d.score_nodes)
    process.stdout.write(`\rQS: ${nodes.length}/${total}`); page++; await new Promise((x) => setTimeout(x, 250))
  }
  process.stdout.write('\n'); return nodes
}

async function fetchUsNews() {
  const items = []; let page = 1, totalPages = 1
  do {
    const r = await fetch(`https://www.usnews.com/education/best-global-universities/api/search?format=json&page=${page}`,
      { headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.usnews.com/education/best-global-universities/rankings' } })
    if (!r.ok) { if (page === 1) throw new Error('USN ' + r.status); break }
    const d = await r.json(); totalPages = d.total_pages
    for (const it of d.items || []) {
      const rk = (it.ranks || []).find((x) => /best global/i.test(x.label)); const rank = parseRank(rk?.value)
      if (rank != null) items.push({ name: it.name, country: it.country_name || '', city: clean(it.city), url: it.url, rank, blurb: clean(it.blurb) })
    }
    process.stdout.write(`\rU.S. News: ${page}/${totalPages} (${items.length})`); page++; await new Promise((x) => setTimeout(x, 160))
  } while (page <= totalPages && page <= 300)
  process.stdout.write('\n'); return items
}

async function fetchThe() {
  // year -> [{name, country, url, rank}]; aggregated into per-uni multi-year series.
  const byKey = new Map()
  for (const yr of YEARS) {
    let d
    try { d = await (await fetch(`https://www.timeshighereducation.com/json/ranking_tables/world_university_rankings/${yr}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } })).json() }
    catch { process.stdout.write(`\rTHE ${yr}: skip`); continue }
    for (const it of d.data || []) {
      const rank = parseRank(it.rank); if (rank == null) continue
      const key = normKey(it.name); if (!key) continue
      let e = byKey.get(key)
      if (!e) { e = { name: clean(it.name), country: clean(it.location), url: it.url ? `https://www.timeshighereducation.com${it.url}` : '', ranks: {} }; byKey.set(key, e) }
      if (!(yr in e.ranks) || rank < e.ranks[yr]) e.ranks[yr] = rank
    }
    process.stdout.write(`\rTHE: ${yr} (${byKey.size} unis)`); await new Promise((x) => setTimeout(x, 200))
  }
  process.stdout.write('\n'); return byKey
}

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n'

async function main() {
  const nodes = await fetchQs()
  const usnItems = await fetchUsNews()
  const theByKey = await fetchThe()

  const regionByCountry = new Map()
  for (const n of nodes) if (n.country && n.region) regionByCountry.set(n.country, n.region)

  const usnByKey = new Map()
  for (const u of usnItems) { const k = normKey(u.name); if (k && !usnByKey.has(k)) usnByKey.set(k, u) }

  const usedUsn = new Set(), usedThe = new Set()
  const universities = []
  const seen = new Set()
  let matched2 = 0

  const makeRankings = (qsRank, usn, the) => {
    const qs = emptyYears(), usnews = emptyYears(), theR = emptyYears()
    if (qsRank != null) qs[CURRENT] = qsRank
    if (usn) usnews[CURRENT] = usn.rank
    if (the) for (const [y, v] of Object.entries(the.ranks)) if (y in theR) theR[y] = v
    return { qs, usnews, the: theR }
  }

  // QS universities — attach U.S. News & THE by name.
  for (const n of nodes) {
    const slug = slugOf(n.path); if (!slug || seen.has(slug)) continue; seen.add(slug)
    const rank = parseRank(n.rank_display ?? n.rank); if (rank == null) continue
    const key = normKey(n.title)
    const usn = usnByKey.get(key); const the = theByKey.get(key)
    if (usn) { usedUsn.add(key); matched2++ }
    if (the) usedThe.add(key)
    universities.push({
      id: slug, name: clean(n.title), country: clean(n.country), region: clean(n.region),
      city: clean(n.city) || (usn ? usn.city : ''), description: usn ? usn.blurb : '',
      logo: n.logo || undefined, qsUrl: `https://www.topuniversities.com${n.path}`,
      ...(usn ? { usnewsUrl: usn.url } : {}), ...(the && the.url ? { theUrl: the.url } : {}),
      rankings: makeRankings(rank, usn, the),
    })
  }

  // U.S. News-only (also attach THE).
  for (const u of usnItems) {
    const key = normKey(u.name); if (!key || usedUsn.has(key)) continue; usedUsn.add(key)
    const the = theByKey.get(key); if (the) usedThe.add(key)
    universities.push({
      id: `usn-${slugOf(u.url) || key.replace(/\s+/g, '-')}`, name: clean(u.name), country: clean(u.country),
      region: regionByCountry.get(u.country) || '', city: clean(u.city), description: u.blurb,
      usnewsUrl: u.url, ...(the && the.url ? { theUrl: the.url } : {}), rankings: makeRankings(null, u, the),
    })
  }

  // THE-only.
  for (const [key, the] of theByKey) {
    if (usedThe.has(key)) continue
    universities.push({
      id: `the-${slugOf(the.url) || key.replace(/\s+/g, '-')}`, name: the.name, country: the.country,
      region: regionByCountry.get(the.country) || '', city: '', theUrl: the.url || undefined,
      rankings: makeRankings(null, null, the),
    })
  }

  const best = (u) => Math.min(u.rankings.qs[CURRENT] ?? 9e9, u.rankings.usnews[CURRENT] ?? 9e9, u.rankings.the[CURRENT] ?? 9e9)
  universities.sort((a, b) => best(a) - best(b))
  for (const u of universities) if (!u.description) delete u.description

  const meta = {
    years: YEARS, systems: ['qs', 'usnews', 'the'],
    systemLabels: { qs: 'QS World University Rankings', usnews: 'U.S. News & World Report', the: 'Times Higher Education' },
    systemShort: { qs: 'QS', usnews: 'U.S. News', the: 'THE' },
    defaultUniversity: universities[0]?.id ?? null, version: VERSION, license: 'CC-BY-4.0',
    sources: {
      qs: 'https://www.topuniversities.com/world-university-rankings',
      usnews: 'https://www.usnews.com/education/best-global-universities/rankings',
      the: 'https://www.timeshighereducation.com/world-university-rankings',
    },
    coverage: `THE ${THE_FROM}–${CURRENT} (multi-year); QS & U.S. News ${CURRENT} only (their live APIs expose just the current edition). ${universities.length} universities; ${matched2} matched QS↔U.S. News.`,
  }

  await writeFile(path.join(DIR, 'universities.json'), JSON.stringify({ meta, universities }) + '\n')

  const uniRows = universities.map((u) => ({
    id: u.id, name: u.name, country: u.country, region: u.region, city: u.city || '',
    description: u.description || '', qs_url: u.qsUrl || '', usnews_url: u.usnewsUrl || '', the_url: u.theUrl || '',
  }))
  await writeFile(path.join(DIR, 'universities.csv'), toCsv(uniRows, ['id', 'name', 'country', 'region', 'city', 'description', 'qs_url', 'usnews_url', 'the_url']))

  const rankRows = []
  for (const u of universities) for (const sys of ['qs', 'usnews', 'the']) for (const yr of YEARS) {
    const rk = u.rankings[sys][yr]; if (rk != null) rankRows.push({ university_id: u.id, system: sys, year: yr, rank: rk })
  }
  await writeFile(path.join(DIR, 'rankings.csv'), toCsv(rankRows, ['university_id', 'system', 'year', 'rank']))

  const datapackage = {
    name: 'world-university-rankings', title: 'World University Rankings — QS, U.S. News & Times Higher Education',
    description: meta.coverage, version: VERSION,
    licenses: [{ name: 'CC-BY-4.0', path: 'https://creativecommons.org/licenses/by/4.0/', title: 'Creative Commons Attribution 4.0' }],
    homepage: 'https://github.com/rNLKJA/qs-usnews-ranking-viz',
    sources: Object.entries(meta.sources).map(([k, v]) => ({ title: meta.systemLabels[k], path: v })),
    resources: [
      { name: 'universities', path: 'universities.csv', format: 'csv', mediatype: 'text/csv',
        schema: { primaryKey: 'id', fields: [
          { name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'country', type: 'string' },
          { name: 'region', type: 'string' }, { name: 'city', type: 'string', title: 'Location' },
          { name: 'description', type: 'string' }, { name: 'qs_url', type: 'string' }, { name: 'usnews_url', type: 'string' }, { name: 'the_url', type: 'string' } ] } },
      { name: 'rankings', path: 'rankings.csv', format: 'csv', mediatype: 'text/csv',
        schema: { foreignKeys: [{ fields: 'university_id', reference: { resource: 'universities', fields: 'id' } }], fields: [
          { name: 'university_id', type: 'string' }, { name: 'system', type: 'string', constraints: { enum: ['qs', 'usnews', 'the'] } },
          { name: 'year', type: 'integer' }, { name: 'rank', type: 'integer', description: 'World rank (lower is better)' } ] } },
    ],
  }
  await writeFile(path.join(DIR, 'datapackage.json'), JSON.stringify(datapackage, null, 2) + '\n')

  const readme = `# World University Rankings — QS, U.S. News & Times Higher Education (${VERSION})

Openly-licensed, tidy dataset built for trend & cross-system comparison. **${universities.length}** universities.

## Files
- \`universities.csv\` — one row per university (id, name, country, region, city, description, profile links).
- \`rankings.csv\` — tidy long format: \`university_id, system, year, rank\` (lower = better).
- \`universities.json\` — nested JSON used by the web app.
- \`datapackage.json\` — Frictionless descriptor.

## Coverage
${meta.coverage}

## FAIR
- **Findable**: stable \`id\`, version \`${VERSION}\`, datapackage metadata.
- **Accessible**: open CSV/JSON over HTTPS, no auth.
- **Interoperable**: tidy long format, Frictionless schema, country→region.
- **Reusable**: CC-BY-4.0, provenance below; generated by \`scripts/build-dataset.mjs\`, no hand-entered values.

## Sources
QS © Quacquarelli Symonds · U.S. News © U.S. News & World Report · THE © Times Higher Education.
Compilation CC-BY-4.0 — attribute "rNLKJA / Ranking Radar".
`
  await writeFile(path.join(DIR, 'README.md'), readme)
  await writeFile(path.join(DIR, 'LICENSE'), 'CC-BY-4.0 — https://creativecommons.org/licenses/by/4.0/\n')

  const withThe = universities.filter((u) => YEARS.some((y) => u.rankings.the[y] != null)).length
  console.log(`\nWrote ${universities.length} universities + FAIR package\n  QS ${nodes.length} · U.S. News ${usnItems.length} · THE ${theByKey.size} (multi-year) · with-THE ${withThe} · matched QS↔USN ${matched2}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
