import { useCallback, useEffect, useState } from 'react'
import type { Dataset, DatasetMeta, University } from '../types'

/**
 * Loads the ranking dataset and exposes it page-by-page so the timeline can
 * lazily reveal more universities as the user scrolls toward higher (worse)
 * ranks. Today the whole dataset arrives in one JSON file; the paginated shape
 * means we can later swap `fetch` for a rank-windowed endpoint (e.g.
 * /data/ranks-1-50.json, /data/ranks-51-100.json) without touching the UI.
 */
const PAGE_SIZE = 4

interface UseUniversitiesResult {
  meta: DatasetMeta | null
  /** Every university loaded so far, unsorted. */
  all: University[]
  /** How many are currently revealed to the view. */
  visibleCount: number
  hasMore: boolean
  loading: boolean
  error: string | null
  loadMore: () => void
}

export function useUniversities(): UseUniversitiesResult {
  const [meta, setMeta] = useState<DatasetMeta | null>(null)
  const [all, setAll] = useState<University[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/universities.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load data (${res.status})`)
        return res.json() as Promise<Dataset>
      })
      .then((data) => {
        if (cancelled) return
        setMeta(data.meta)
        setAll(data.universities)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasMore = visibleCount < all.length
  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, all.length))
  }, [all.length])

  return { meta, all, visibleCount, hasMore, loading, error, loadMore }
}
