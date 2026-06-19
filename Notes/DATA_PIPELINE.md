# Data pipeline

The dataset (`public/data/universities.json`) is **generated**, not hand-edited. Re-run it with:

```bash
npm run data        # = node scripts/build-dataset.mjs
```

## What it does

`scripts/build-dataset.mjs`:

1. **Pulls the full QS World University Rankings** from the official
   topuniversities.com REST endpoint — the same JSON the rankings table loads
   from. ~1,500 universities. Each record gives `rank`, `title`, `country`,
   profile `path`, and a `logo` URL.
   - Endpoint: `https://www.topuniversities.com/rankings/endpoint?nid=<NID>&page=<n>&items_per_page=500&tab=indicators`
   - `<NID>` is the edition's node id. Find it in the page source of
     `topuniversities.com/world-university-rankings` as
     `"qs_rankings_rest_api":{"nid":"…"}`. Current: **4153156** (QS 2026).
2. **Pulls the full U.S. News Best Global Universities** from its JSON API
   (`usnews.com/education/best-global-universities/api/search?format=json&page=<n>`),
   ~2,250 ranked universities across ~225 pages of 10. **Note:** `curl` is
   Cloudflare-blocked here (returns `000`/`403`), but Node's `fetch` (undici TLS)
   gets through — so the pipeline must run under Node, not shell `curl`.
3. **Parses ranks** — `"1"`, `"=42"`, `"1,183"`, `"1201-1400"`, `"1401+"` →
   integer (`1`, `42`, `1183`, `1201`, `1401`). Thousands commas are stripped
   first (otherwise `"1,183"` would parse as `1`).
4. **Matches the two systems by normalised name** (`normKey`: strip
   parentheticals / diacritics / "university|the|of|at"). Matched universities
   carry both `rankings.qs` and `rankings.usnews`; QS-only and U.S. News-only
   universities carry just one. ~993 match.
5. **Merges a curated set** (6 universities) keyed by QS profile slug, which
   carry full QS history back to 2004 and U.S. News history back to 2015. See
   `CURATED` in the script.
6. Writes the dataset sorted by best (lowest) latest rank across the two systems.

## Coverage

- **QS:** all ~1,500 universities (2026). 6 curated also have QS 2004–2025.
- **U.S. News:** all ~2,250 ranked universities (2026). 6 curated also have
  U.S. News 2015–2025.
- ~993 universities have **both** systems (these get the comparison + the
  connector in the trend modal). The rest show one system and `—` for the other.
- Logos come from QS only, so U.S. News-only universities use a monogram.

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
