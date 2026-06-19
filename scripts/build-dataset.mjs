#!/usr/bin/env node
/**
 * build-dataset.mjs — generate public/data/universities.json
 *
 * Smart, reproducible ingestion:
 *  - Pulls the FULL QS World University Rankings (latest edition) straight from
 *    the official topuniversities.com REST endpoint (~1,500 universities), with
 *    rank, name, country, profile path and logo URL.
 *  - Merges a small hand-curated set of universities that carry full multi-year
 *    history (QS 2004– and U.S. News Best Global 2015–), since the U.S. News
 *    API is Cloudflare-blocked from a plain fetch. Those universities also get
 *    their U.S. News profile link.
 *
 * Re-run any year by bumping QS_NID to the new edition's node id (find it in the
 * page source of topuniversities.com/world-university-rankings as
 * `qs_rankings_rest_api":{"nid":"…"}`), then `node scripts/build-dataset.mjs`.
 *
 * See Notes/DATA_PIPELINE.md for the full write-up.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'public', 'data', 'universities.json')

const QS_NID = '4153156' // QS World University Rankings 2026 edition
const QS_YEAR = 2026
const YEARS = Array.from({ length: 2026 - 2004 + 1 }, (_, i) => 2004 + i)
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Universities with full multi-year history (keyed by QS profile slug). */
const CURATED = {
  'university-melbourne': {
    usnewsUrl: 'https://www.usnews.com/education/best-global-universities/university-of-melbourne-501796',
    qs: { 2004: 22, 2005: 19, 2006: 22, 2007: 27, 2008: 38, 2009: 36, 2010: 38, 2011: 31, 2012: 36, 2013: 31, 2014: 31, 2015: 33, 2016: 42, 2017: 42, 2018: 41, 2019: 39, 2020: 38, 2021: 41, 2022: 37, 2023: 33, 2024: 14, 2025: 13, 2026: 19 },
    usnews: { 2015: 32, 2016: 40, 2017: 36, 2018: 26, 2019: 26, 2020: 26, 2021: 25, 2022: 26, 2023: 27, 2024: 27, 2025: 28, 2026: 28 },
  },
  'university-sydney': {
    usnewsUrl: 'https://www.usnews.com/education/best-global-universities/university-of-sydney-505369',
    qs: { 2004: 40, 2005: 38, 2006: 35, 2007: 31, 2008: 37, 2009: 36, 2010: 37, 2011: 38, 2012: 39, 2013: 38, 2014: null, 2015: 37, 2016: 45, 2017: 46, 2018: 50, 2019: 42, 2020: 42, 2021: 40, 2022: 38, 2023: 41, 2024: 19, 2025: 18, 2026: 25 },
    usnews: { 2015: 45, 2016: 51, 2017: 45, 2018: 34, 2019: 31, 2020: 27, 2021: 27, 2022: 28, 2023: 28, 2024: 28, 2025: 31, 2026: 31 },
  },
  'australian-national-university-anu': {
    usnewsUrl: 'https://www.usnews.com/education/best-global-universities/australian-national-university-503825',
    qs: { 2004: 16, 2005: 23, 2006: 16, 2007: 16, 2008: 16, 2009: 17, 2010: 20, 2011: 26, 2012: 24, 2013: 24, 2014: 27, 2015: 25, 2016: 19, 2017: 22, 2018: 20, 2019: 24, 2020: 29, 2021: 31, 2022: 27, 2023: 30, 2024: 34, 2025: 30, 2026: 32 },
    usnews: { 2015: 72, 2016: 80, 2017: 80, 2018: 69, 2019: 69, 2020: 66, 2021: 62, 2022: 67, 2023: 75, 2024: 78, 2025: 82, 2026: 80 },
  },
  'university-oxford': {
    usnewsUrl: 'https://www.usnews.com/education/best-global-universities/university-of-oxford-503637',
    qs: { 2004: 5, 2005: 4, 2006: 3, 2007: 2, 2008: 4, 2009: 5, 2010: 6, 2011: 5, 2012: 5, 2013: 6, 2014: 5, 2015: 6, 2016: 6, 2017: 6, 2018: 6, 2019: 5, 2020: 4, 2021: 5, 2022: 2, 2023: 4, 2024: 3, 2025: 3, 2026: 4 },
    usnews: { 2015: 5, 2016: 5, 2017: 6, 2018: 5, 2019: 5, 2020: 5, 2021: 5, 2022: 5, 2023: 5, 2024: 5, 2025: 4, 2026: 4 },
  },
  'massachusetts-institute-technology-mit': {
    usnewsUrl: 'https://www.usnews.com/education/best-global-universities/massachusetts-institute-of-technology-mit-166683',
    qs: { 2004: 3, 2005: 2, 2006: 4, 2007: 10, 2008: 9, 2009: 9, 2010: 5, 2011: 3, 2012: 1, 2013: 1, 2014: 1, 2015: 1, 2016: 1, 2017: 1, 2018: 1, 2019: 1, 2020: 1, 2021: 1, 2022: 1, 2023: 1, 2024: 1, 2025: 1, 2026: 1 },
    usnews: { 2015: 2, 2016: 2, 2017: 2, 2018: 2, 2019: 2, 2020: 2, 2021: 2, 2022: 2, 2023: 2, 2024: 2, 2025: 2, 2026: 2 },
  },
  'national-university-singapore-nus': {
    usnewsUrl: 'https://www.usnews.com/education/best-global-universities/national-university-of-singapore-505009',
    qs: { 2004: 18, 2005: 22, 2006: 19, 2007: 33, 2008: 30, 2009: 30, 2010: 31, 2011: 28, 2012: 25, 2013: 24, 2014: 22, 2015: 12, 2016: 12, 2017: 12, 2018: 15, 2019: 11, 2020: 11, 2021: 11, 2022: 11, 2023: 11, 2024: 8, 2025: 8, 2026: 8 },
    usnews: { 2015: 55, 2016: 49, 2017: 50, 2018: 43, 2019: 38, 2020: 34, 2021: 32, 2022: 29, 2023: 26, 2024: 26, 2025: 25, 2026: 24 },
  },
}

const parseRank = (s) => {
  // Strip thousands separators first ("1,183" → 1183, not 1).
  const m = String(s ?? '').replace(/[,\s]/g, '').match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

const slugOf = (p) => String(p || '').split('/').filter(Boolean).pop() || ''

/** Normalised name key for matching a university across QS and U.S. News. */
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

const shortNameOf = (title) => {
  const m = title.match(/\(([^)]+)\)/) // prefer an abbreviation in parentheses
  if (m && m[1].length <= 8) return m[1]
  return title.replace(/\([^)]*\)/g, '').trim().split(/\s+/).slice(0, 2).join(' ')
}

const emptyYears = () => Object.fromEntries(YEARS.map((y) => [String(y), null]))

async function fetchQs() {
  const perPage = 500
  let page = 0
  let total = Infinity
  const nodes = []
  while (nodes.length < total) {
    const url = `https://www.topuniversities.com/rankings/endpoint?nid=${QS_NID}&page=${page}&items_per_page=${perPage}&tab=indicators`
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://www.topuniversities.com/world-university-rankings', Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`QS fetch failed: ${res.status} (page ${page})`)
    const data = await res.json()
    total = data.total_record
    nodes.push(...data.score_nodes)
    process.stdout.write(`\rQS: ${nodes.length}/${total}`)
    page += 1
    if (page > 50) break
    await new Promise((r) => setTimeout(r, 300))
  }
  process.stdout.write('\n')
  return nodes
}

async function fetchUsNews() {
  // U.S. News Best Global Universities — paginated JSON. curl is Cloudflare-
  // blocked, but Node's fetch (undici TLS) gets through.
  const items = []
  let page = 1
  let totalPages = 1
  do {
    const url = `https://www.usnews.com/education/best-global-universities/api/search?format=json&page=${page}`
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.usnews.com/education/best-global-universities/rankings' },
    })
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
      items.push({ name: it.name, country: it.country_name || '', url: it.url, rank })
    }
    process.stdout.write(`\rU.S. News: page ${page}/${totalPages} (${items.length})`)
    page += 1
    await new Promise((r) => setTimeout(r, 200))
  } while (page <= totalPages && page <= 300)
  process.stdout.write('\n')
  return items
}

async function main() {
  const nodes = await fetchQs()
  const usnItems = await fetchUsNews()

  // Index U.S. News by normalised name for matching against QS.
  const usnByKey = new Map()
  for (const u of usnItems) {
    const k = normKey(u.name)
    if (k && !usnByKey.has(k)) usnByKey.set(k, u)
  }
  const usedUsn = new Set()

  const universities = []
  const seen = new Set()
  let matched = 0

  // QS universities (with U.S. News merged in by name where it matches).
  for (const n of nodes) {
    const slug = slugOf(n.path)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    const rank = parseRank(n.rank_display ?? n.rank)
    if (rank == null) continue
    const curated = CURATED[slug]
    const qs = emptyYears()
    const usnews = emptyYears()
    qs[String(QS_YEAR)] = rank
    const key = normKey(n.title)
    const usn = usnByKey.get(key)
    let usnewsUrl
    if (curated) {
      for (const [y, v] of Object.entries(curated.qs)) qs[y] = v
      for (const [y, v] of Object.entries(curated.usnews)) usnews[y] = v
      usnewsUrl = curated.usnewsUrl
    } else if (usn) {
      usnews[String(QS_YEAR)] = usn.rank
      usnewsUrl = usn.url
    }
    if (usn) {
      usedUsn.add(key)
      matched += 1
    }
    universities.push({
      id: slug,
      name: n.title,
      shortName: shortNameOf(n.title),
      country: n.country || '',
      logo: n.logo || undefined,
      qsUrl: `https://www.topuniversities.com${n.path}`,
      ...(usnewsUrl ? { usnewsUrl } : {}),
      rankings: { qs, usnews },
    })
  }

  // U.S. News-only universities (no QS entry).
  let usnOnly = 0
  for (const u of usnItems) {
    const key = normKey(u.name)
    if (!key || usedUsn.has(key)) continue
    usedUsn.add(key)
    const usnews = emptyYears()
    usnews[String(QS_YEAR)] = u.rank
    universities.push({
      id: `usn-${slugOf(u.url) || key.replace(/\s+/g, '-')}`,
      name: u.name,
      shortName: shortNameOf(u.name),
      country: u.country,
      usnewsUrl: u.url,
      rankings: { qs: emptyYears(), usnews },
    })
    usnOnly += 1
  }

  // Stable order: by best (lowest) latest rank across the two systems.
  const best = (u) =>
    Math.min(u.rankings.qs[String(QS_YEAR)] ?? 9e9, u.rankings.usnews[String(QS_YEAR)] ?? 9e9)
  universities.sort((a, b) => best(a) - best(b))

  const dataset = {
    meta: {
      years: YEARS,
      systems: ['qs', 'usnews'],
      systemLabels: { qs: 'QS World University Rankings', usnews: 'U.S. News & World Report' },
      systemShort: { qs: 'QS', usnews: 'U.S. News' },
      defaultUniversity: 'university-melbourne',
      coverage: {
        qs: `Full QS World University Rankings ${QS_YEAR} (${nodes.length} universities) from topuniversities.com; ${Object.keys(CURATED).length} curated universities also carry QS history back to 2004.`,
        usnews: `Full U.S. News Best Global Universities ${QS_YEAR} (${usnItems.length} universities) from the U.S. News API; the curated set also carries U.S. News history back to 2015.`,
      },
    },
    universities,
  }
  await writeFile(OUT, JSON.stringify(dataset) + '\n')
  console.log(
    `Wrote ${universities.length} universities → ${OUT}\n` +
      `  QS: ${nodes.length} · U.S. News: ${usnItems.length} · matched: ${matched} · U.S. News-only: ${usnOnly}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
