import type { SystemKey, University } from '@/types'

export const ALL_SYSTEMS: SystemKey[] = ['qs', 'usnews', 'the']

export const SYSTEM_COLOR: Record<SystemKey, string> = {
  qs: 'var(--color-qs)',
  usnews: 'var(--color-usnews)',
  the: 'var(--color-the)',
}

export const SYSTEM_SHORT: Record<SystemKey, string> = {
  qs: 'QS',
  usnews: 'U.S. News',
  the: 'THE',
}

export const profileUrl = (u: University, s: SystemKey): string | undefined =>
  s === 'qs' ? u.qsUrl : s === 'usnews' ? u.usnewsUrl : u.theUrl
