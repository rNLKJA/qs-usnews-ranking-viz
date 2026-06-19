export type SystemKey = 'qs' | 'usnews'

/** Rank by year. Value is the world rank, or null when that edition has no value. */
export type RankByYear = Record<string, number | null>

export interface University {
  id: string
  name: string
  shortName: string
  country: string
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
