# Data pipeline

The dataset (`public/data/universities.json`) is **generated**, not hand-edited. Re-run it with:

```bash
npm run data        # = node scripts/build-dataset.mjs
```

## What it does

`scripts/build-dataset.mjs`:

1. **Pulls the full QS World University Rankings** from the official
   topuniversities.com REST endpoint — the same JSON the rankings table loads
   from. One call per 500 rows, ~1,500 universities total. Each record gives
   `rank`, `title`, `country`, profile `path`, and a `logo` URL.
   - Endpoint: `https://www.topuniversities.com/rankings/endpoint?nid=<NID>&page=<n>&items_per_page=500&tab=indicators`
   - `<NID>` is the edition's node id. Find it in the page source of
     `topuniversities.com/world-university-rankings` as
     `"qs_rankings_rest_api":{"nid":"…"}`. Current: **4153156** (QS 2026).
2. **Parses ranks** — `"1"`, `"=42"`, `"1201-1400"`, `"1401+"` → leading integer
   (`1`, `42`, `1201`, `1401`). The first number is used as the position.
3. **Merges a curated set** (6 universities) keyed by QS profile slug, which
   carry full QS history back to 2004 and U.S. News Best Global history (2015–)
   plus a U.S. News profile link. See `CURATED` in the script.
4. Writes the dataset sorted by latest QS rank.

## Why U.S. News is only the curated 6

The U.S. News Best Global Universities API
(`usnews.com/education/best-global-universities/api/search`) is Cloudflare-
protected and returns `000`/`403` to a plain server fetch, so it can't be
ingested the same way. The 6 curated universities therefore carry U.S. News
data (archive-sourced — see `data-sourcing.md`); everyone else is QS-only and
their U.S. News rank shows as `—`. To add U.S. News at scale later, fetch it
through an unblocked path (e.g. a headless browser or a paid proxy) and write
the values into each university's `rankings.usnews`.

## Logos

QS logo URLs are **hotlink-protected** (403 with a foreign `Referer`). The app
loads them with `referrerPolicy="no-referrer"` (which returns 200), so no
images need bundling. Universities without a QS logo fall back to a monogram.

## Coverage & limits

- **QS:** all ~1,500 universities, **latest edition only** (2026). The 6 curated
  universities also have QS 2004–2025.
- To add **historical years for everyone**, find each past edition's `NID`, fetch
  it, and write `rankings.qs.<year>` per slug (extend the script with a list of
  `{year, nid}` editions).
- `meta.defaultUniversity` = `university-melbourne`.

## App handling of scale

- Sidebar list renders the top 80 by rank; everything else is reachable via
  search (filters all ~1,500).
- The timeline reveals universities as their rank scrolls into view
  (position-aware), and caps tie-stacks at 6 (QS bands high ranks into large
  ties).
