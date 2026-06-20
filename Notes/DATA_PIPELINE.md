# Data pipeline

The dataset is **generated**, never hand-edited — no values are hard-coded.

```bash
npm run data        # node scripts/build-dataset.mjs
```

## Sources (live, official)

- **QS World University Rankings** — topuniversities.com REST endpoint
  (`/rankings/endpoint?nid=<NID>&page=<n>&items_per_page=500&tab=indicators`).
  `<NID>` = the edition node id, found in the rankings page source as
  `"qs_rankings_rest_api":{"nid":"…"}`. Gives rank, name, country, **region**,
  **city**, profile path, logo. ~1,500 universities.
- **U.S. News Best Global Universities** — `usnews.com/.../api/search?format=json&page=<n>`.
  curl is Cloudflare-blocked; **Node's `fetch` gets through**. Gives rank, name,
  country, **city**, **blurb (description)**, profile url. ~2,250 universities.

Matched QS↔U.S. News by normalised name (`normKey`): ~993 carry both systems.
Thousands-commas are stripped in rank parsing (`"1,183"` → 1183, not 1).

## Outputs (all under `public/data/`, downloadable = FAIR Accessible)

| file | what |
|------|------|
| `universities.json` | website data (nested) |
| `universities.csv`  | one row per university: id, name, country, region, city, description, links |
| `rankings.csv`      | tidy long format: `university_id, system, year, rank` |
| `datapackage.json`  | Frictionless descriptor with field schemas |
| `README.md`, `LICENSE` | provenance + CC-BY-4.0 |

The spreadsheet (`universities.csv` / `rankings.csv`) is the shareable 3rd-party
dataset and the source of truth; `universities.json` is derived from the same run.

- **Times Higher Education** — `timeshighereducation.com/json/ranking_tables/world_university_rankings/<year>`.
  This serves **every edition 2011–present**, so THE is the multi-year backbone.
  Record gives rank, name, `location` (country), profile url, scores.

### QS history via archived edition NIDs

The QS endpoint takes a `nid` (edition node id) and — crucially — the **live**
endpoint still serves **old** NIDs in full. So QS history is obtained by:
1. Harvesting QS endpoint NIDs from the **Wayback Machine** CDX API.
2. Fetching each live, identifying its edition by a fingerprint of known ranks
   (Melbourne / Sydney / NUS), keeping the World University Rankings tables.
3. Mapping year → NID in `QS_EDITIONS` (config only — the ranks are fetched live).

This yields **QS 2016–2027, complete** (the 2020 edition id, 914824, was found
in a wider Wayback sweep of 359 NIDs). Note nid 4153156 is the QS **2027** edition.

## Coverage

- **QS 2016–2027** (complete) · **THE 2011–2026** · **U.S. News Best Global 2026**
  · **U.S. News National 1984–2025** (U.S.-only archive).
- U.S. News **Best Global** stays current-only — its API serves one edition and
  Wayback only archived scattered pages (top ~40, mixed editions), so there is
  no recoverable history. Not fabricated.
- `meta.years = 1984..2027`; `meta.featuredYear = 2026` (richest cross-system year).

## Built on this dataset

- **Trend modal** — THE multi-year line + QS/U.S. News current dots + cross-system spread.
- **Regions view** — count of each region's universities in the global top-N over
  2011–2026 (THE), showing regional rise/fall.

## To extend

- Backfill QS/U.S. News history from an archived open dataset (attributed) → more
  `year` rows in `rankings.csv`; the schema already supports it.
- Bump `QS_NID` each year for the new QS edition.
