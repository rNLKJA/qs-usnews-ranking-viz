export type SystemKey = 'qs' | 'usnews'

/** Rank by year. Value is the world rank, or null when that edition has no value. */
export type RankByYear = Record<string, number | null>

export interface University {
  id: string
  name: string
  shortName: string
  country: string
  /** Optional web domain — used to resolve a favicon when no logo is given. */
  domain?: string
  /** Logo image URL (from QS) — overrides the favicon. */
  logo?: string
  /** Link to the university's QS profile page. */
  qsUrl: string
  /** Link to the university's U.S. News profile page (curated set only). */
  usnewsUrl?: string
  rankings: Record<SystemKey, RankByYear>
}

export interface DatasetMeta {
  years: number[]
  systems: SystemKey[]
  systemLabels: Record<SystemKey, string>
  systemShort: Record<SystemKey, string>
  defaultUniversity: string
}

export interface Dataset {
  meta: DatasetMeta
  universities: University[]
}

/** A single placed marker on the timeline for one university in one system. */
export interface TimelinePoint {
  university: University
  rank: number
}
