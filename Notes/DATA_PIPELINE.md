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

## Coverage

- **THE: 2011–2026** (multi-year — real trends).
- **QS & U.S. News: 2026 only** — their live APIs expose only the current edition
  (verified: QS one NID; U.S. News ignores `year`/`schema`). No hard-coding, so
  no synthetic history for these two.
- `meta.years = 2011..2026`; for pre-2026 years only THE has data.

## Built on this dataset

- **Trend modal** — THE multi-year line + QS/U.S. News current dots + cross-system spread.
- **Regions view** — count of each region's universities in the global top-N over
  2011–2026 (THE), showing regional rise/fall.

## To extend

- Backfill QS/U.S. News history from an archived open dataset (attributed) → more
  `year` rows in `rankings.csv`; the schema already supports it.
- Bump `QS_NID` each year for the new QS edition.
