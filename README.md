# University Rankings Timeline — QS vs US News

An interactive visualisation of university rankings from **QS World University Rankings** and **US News Best Global Universities** (2019–2026).

## Two views

1. **Horizontal rank timeline** — rank 1 sits at the left end; universities are placed along the axis by their rank for the selected year, with ties stacked vertically. Two lanes: **QS on top, US News below**. Drag the year slider to move through 2019–2026. More universities load lazily as you scroll right toward higher ranks.
2. **Per-university trend modal** — click any university to open a scatter plot of **rank (y) vs year (x)** with rank 1 at the top. QS and US News each get a trend line, and for every year where both systems have a value a vertical **error bar connects the two points, labelled with the rank gap** between the systems.

Default / home university: **University of Melbourne**.

## Stack

Vite · React · TypeScript · Tailwind CSS v4 · D3 (scales/shapes only; React renders the SVG). The modal uses the native `<dialog>` element (`showModal()` for focus-trap + Esc, `closedby` for light-dismiss with a Safari fallback).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Data

`public/data/universities.json` — one object per university; `rankings.<system>.<year>` is an integer or `null` for a missing edition (the UI breaks the line on nulls). To add a university, append an object following the same schema. See the project's `Notes/data-sourcing.md` for provenance and confidence.

## Deploy (Vercel)

Zero config — Vercel auto-detects Vite. Connect this repo in the Vercel dashboard, or run `vercel` from this folder. Build command `npm run build`, output `dist/`.
