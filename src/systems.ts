import type { SystemKey, University } from '@/types'

export const ALL_SYSTEMS: SystemKey[] = ['qs', 'usnews', 'the', 'usnatl']

export const SYSTEM_COLOR: Record<SystemKey, string> = {
  qs: 'var(--color-qs)',
  usnews: 'var(--color-usnews)',
  the: 'var(--color-the)',
  usnatl: 'var(--color-usnatl)',
}

export const SYSTEM_SHORT: Record<SystemKey, string> = {
  qs: 'QS',
  usnews: 'USN-G',
  the: 'THE',
  usnatl: 'USN-N',
}

export const profileUrl = (u: University, s: SystemKey): string | undefined =>
  s === 'qs' ? u.qsUrl : s === 'usnews' ? u.usnewsUrl : s === 'the' ? u.theUrl : undefined
