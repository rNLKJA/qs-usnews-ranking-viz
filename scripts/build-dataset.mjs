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

// QS editions: year -> endpoint node id (the live endpoint serves old NIDs).
// NIDs harvested from the Wayback Machine and identified by known ranks.
// 2020 is missing — the REST endpoint wasn't archived in 2019/2020.
const QS_EDITIONS = {
  2016: '299926', 2017: '326584', 2018: '357051', 2019: '397863',
  2021: '2057712', 2022: '3740566', 2023: '3816281', 2024: '3897789',
  2025: '3990755', 2026: '4061771', 2027: '4153156',
}
const USN_YEAR = 2026 // U.S. News Best Global current edition
const THE_FROM = 2011
const LAST = 2027
const MIN_YEAR = 1984 // U.S. News National archive reaches back to 1984
const THE_YEARS = Array.from({ length: 2026 - THE_FROM + 1 }, (_, i) => THE_FROM + i)
const META_YEARS = Array.from({ length: LAST - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i)
const FEATURED = 2026 // richest cross-system year
const VERSION = `${LAST}.4`
// U.S. News National Universities ("Best Colleges") archive, 1984–2025 (public, CC).
const USNATL_URL = 'https://raw.githubusercontent.com/frishberg/Archive-of-US-News-College-Rankings/HEAD/data.csv'

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
const parseCsvLine = (l) => {
  const out = []
  let cur = '', q = false
  for (const ch of l) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

async function fetchQsEditions() {
  // slug -> { info, ranks: {year: rank} }. Editions processed oldest→newest so
  // the newest edition supplies the canonical name/country/logo.
  const bySlug = new Map()
  for (const [year, nid] of Object.entries(QS_EDITIONS)) {
    let page = 0
    while (page <= 20) {
      const r = await fetch(`https://www.topuniversities.com/rankings/endpoint?nid=${nid}&page=${page}&items_per_page=500&tab=indicators`,
        { headers: { 'User-Agent': UA, Referer: 'https://www.topuniversities.com/world-university-rankings', Accept: 'application/json' } })
      if (!r.ok) break
      const d = await r.json()
      const nodes = d.score_nodes || []
      for (const n of nodes) {
        const slug = slugOf(n.path); if (!slug) continue
        let e = bySlug.get(slug); if (!e) { e = { info: {}, ranks: {} }; bySlug.set(slug, e) }
        e.info = { name: clean(n.title), country: clean(n.country), region: clean(n.region), city: clean(n.city), logo: n.logo || undefined, path: n.path }
        const rank = parseRank(n.rank_display ?? n.rank); if (rank != null) e.ranks[year] = rank
      }
      process.stdout.write(`\rQS ${year}: ${bySlug.size} unis`)
      if (nodes.length < 500) break
      page++; await new Promise((x) => setTimeout(x, 200))
    }
  }
  process.stdout.write('\n'); return bySlug
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
  for (const yr of THE_YEARS) {
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

async function fetchUsNatl() {
  // U.S. News National Universities ("Best Colleges") archive — wide CSV,
  // one column per year (1984–2025). Different ranking from Best Global; U.S.-only.
  const t = await (await fetch(USNATL_URL, { headers: { 'User-Agent': UA } })).text()
  const lines = t.split('\n').filter((l) => l.trim())
  const years = parseCsvLine(lines[0]).slice(1).map(Number)
  const byKey = new Map()
  for (const l of lines.slice(1)) {
    const c = parseCsvLine(l)
    const name = clean(c[0])
    const ranks = {}
    years.forEach((y, i) => { const v = parseInt(c[i + 1], 10); if (!Number.isNaN(v)) ranks[y] = v })
    if (name && Object.keys(ranks).length) byKey.set(normKey(name), { name, ranks })
  }
  console.log(`U.S. News National: ${byKey.size} U.S. universities (${Math.min(...years)}–${Math.max(...years)})`)
  return byKey
}

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n'

async function main() {
  const qsBySlug = await fetchQsEditions()
  const usnItems = await fetchUsNews()
  const theByKey = await fetchThe()
  const natlByKey = await fetchUsNatl()

  const regionByCountry = new Map()
  for (const { info } of qsBySlug.values()) if (info.country && info.region) regionByCountry.set(info.country, info.region)

  const usnByKey = new Map()
  for (const u of usnItems) { const k = normKey(u.name); if (k && !usnByKey.has(k)) usnByKey.set(k, u) }

  const usedUsn = new Set(), usedThe = new Set(), usedNatl = new Set()
  const universities = []
  let matched2 = 0

  // Sparse rankings — only present years are stored.
  const makeRankings = (qsRanks, usn, the, natl) => {
    const r = { qs: {}, usnews: {}, the: {}, usnatl: {} }
    if (qsRanks) for (const [y, v] of Object.entries(qsRanks)) if (v != null) r.qs[y] = v
    if (usn) r.usnews[USN_YEAR] = usn.rank
    if (the) for (const [y, v] of Object.entries(the.ranks)) if (v != null) r.the[y] = v
    if (natl) for (const [y, v] of Object.entries(natl.ranks)) if (v != null) r.usnatl[y] = v
    return r
  }

  // QS universities (multi-edition) — attach U.S. News, THE, National by name.
  for (const [slug, e] of qsBySlug) {
    const info = e.info
    const key = normKey(info.name)
    const usn = usnByKey.get(key); const the = theByKey.get(key); const natl = natlByKey.get(key)
    if (usn) { usedUsn.add(key); matched2++ }
    if (the) usedThe.add(key)
    if (natl) usedNatl.add(key)
    universities.push({
      id: slug, name: info.name, country: info.country, region: info.region,
      city: info.city || (usn ? usn.city : ''), description: usn ? usn.blurb : '',
      logo: info.logo, qsUrl: `https://www.topuniversities.com${info.path}`,
      ...(usn ? { usnewsUrl: usn.url } : {}), ...(the && the.url ? { theUrl: the.url } : {}),
      rankings: makeRankings(e.ranks, usn, the, natl),
    })
  }

  // U.S. News-only (also attach THE + National).
  for (const u of usnItems) {
    const key = normKey(u.name); if (!key || usedUsn.has(key)) continue; usedUsn.add(key)
    const the = theByKey.get(key); if (the) usedThe.add(key)
    const natl = natlByKey.get(key); if (natl) usedNatl.add(key)
    universities.push({
      id: `usn-${slugOf(u.url) || key.replace(/\s+/g, '-')}`, name: clean(u.name), country: clean(u.country),
      region: regionByCountry.get(u.country) || '', city: clean(u.city), description: u.blurb,
      usnewsUrl: u.url, ...(the && the.url ? { theUrl: the.url } : {}), rankings: makeRankings(null, u, the, natl),
    })
  }

  // THE-only (also attach National).
  for (const [key, the] of theByKey) {
    if (usedThe.has(key)) continue
    const natl = natlByKey.get(key); if (natl) usedNatl.add(key)
    universities.push({
      id: `the-${slugOf(the.url) || key.replace(/\s+/g, '-')}`, name: the.name, country: the.country,
      region: regionByCountry.get(the.country) || '', city: '', theUrl: the.url || undefined,
      rankings: makeRankings(null, null, the, natl),
    })
  }

  // U.S. News National-only (U.S. schools not in QS/THE/Best Global).
  for (const [key, natl] of natlByKey) {
    if (usedNatl.has(key)) continue
    universities.push({
      id: `usnatl-${key.replace(/\s+/g, '-')}`, name: natl.name, country: 'United States', region: 'North America', city: '',
      rankings: makeRankings(null, null, null, natl),
    })
  }

  const best = (u) => Math.min(u.rankings.qs[FEATURED] ?? 9e9, u.rankings.usnews[FEATURED] ?? 9e9, u.rankings.the[FEATURED] ?? 9e9, u.rankings.usnatl[FEATURED] ?? 9e9)
  universities.sort((a, b) => best(a) - best(b))
  for (const u of universities) if (!u.description) delete u.description

  const qsYears = Object.keys(QS_EDITIONS).map(Number).sort((a, b) => a - b)
  const meta = {
    years: META_YEARS, featuredYear: FEATURED, systems: ['qs', 'usnews', 'the', 'usnatl'],
    systemLabels: {
      qs: 'QS World University Rankings', usnews: 'U.S. News Best Global', the: 'Times Higher Education',
      usnatl: 'U.S. News National (U.S.)',
    },
    systemShort: { qs: 'QS', usnews: 'USN-G', the: 'THE', usnatl: 'USN-N' },
    defaultUniversity: universities[0]?.id ?? null, version: VERSION, license: 'CC-BY-4.0',
    sources: {
      qs: 'https://www.topuniversities.com/world-university-rankings',
      usnews: 'https://www.usnews.com/education/best-global-universities/rankings',
      the: 'https://www.timeshighereducation.com/world-university-rankings',
      usnatl: 'https://github.com/frishberg/Archive-of-US-News-College-Rankings',
    },
    coverage: `QS ${qsYears[0]}–${qsYears[qsYears.length - 1]} (no 2020); THE ${THE_FROM}–2026; U.S. News Best Global ${USN_YEAR}; U.S. News National 1984–2025 (U.S. only). ${universities.length} universities.`,
  }

  await writeFile(path.join(DIR, 'universities.json'), JSON.stringify({ meta, universities }) + '\n')

  const uniRows = universities.map((u) => ({
    id: u.id, name: u.name, country: u.country, region: u.region, city: u.city || '',
    description: u.description || '', qs_url: u.qsUrl || '', usnews_url: u.usnewsUrl || '', the_url: u.theUrl || '',
  }))
  await writeFile(path.join(DIR, 'universities.csv'), toCsv(uniRows, ['id', 'name', 'country', 'region', 'city', 'description', 'qs_url', 'usnews_url', 'the_url']))

  const rankRows = []
  for (const u of universities) for (const sys of ['qs', 'usnews', 'the', 'usnatl']) for (const yr of META_YEARS) {
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
          { name: 'university_id', type: 'string' }, { name: 'system', type: 'string', constraints: { enum: ['qs', 'usnews', 'the', 'usnatl'] } },
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

  const withMulti = (sys) => universities.filter((u) => META_YEARS.filter((y) => u.rankings[sys][y] != null).length >= 2).length
  console.log(`\nWrote ${universities.length} universities + FAIR package\n  QS ${qsBySlug.size} · U.S. News ${usnItems.length} · THE ${theByKey.size} · National ${natlByKey.size}\n  multi-year QS ${withMulti('qs')} · THE ${withMulti('the')} · National ${withMulti('usnatl')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
