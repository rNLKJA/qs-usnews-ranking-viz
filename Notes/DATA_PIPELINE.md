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

## Known limitation — current edition only

Both APIs serve **only their current edition**, so this is a 2026 cross-system
snapshot (verified: QS exposes a single NID; U.S. News ignores `year`/`schema`
params). There is no official live source for per-university **history**, and
hard-coding is disallowed. So `meta.years = [2026]`.

## Roadmap (data is structured to absorb these)

1. **Historical years** — ingest an archived open dataset (e.g. Kaggle / GitHub
   multi-year QS & THE CSVs) as additional FAIR sources, attributed, written
   into `rankings.csv` as more `year` rows. The schema already supports it.
2. **Times Higher Education** — its JSON isn't in the static HTML; add it via its
   data endpoint or an archived dataset as a third `system`.
3. **Regional view** — `region`/`country`/`city` are already in the dataset, so a
   by-region rank-change visualisation can be built on top without new sourcing.
