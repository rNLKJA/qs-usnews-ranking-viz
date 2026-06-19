export type SystemKey = 'qs' | 'usnews'

/** Rank by year. Value is the world rank, or null when that edition has no value. */
export type RankByYear = Record<string, number | null>

export interface University {
  id: string
  name: string
  shortName: string
  country: string
  /** Primary web domain — used to resolve a logo. */
  domain: string
  /** Link to the university's QS profile page. */
  qsUrl: string
  /** Link to the university's US News Best Global Universities profile page. */
  usnewsUrl: string
  rankings: Record<SystemKey, RankByYear>
}

export interface DatasetMeta {
  years: number[]
  systems: SystemKey[]
  systemLabels: Record<SystemKey, string>
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
