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

/** Distinct colours for the schools being compared in focus mode. */
export const FOCUS_COLORS = ['#111827', '#7c4dff', '#0aa5c9', '#d6457f', '#5a8f29', '#e0852b', '#2563eb', '#b45309']
export const focusColor = (focusedIds: string[], id: string) => {
  const i = focusedIds.indexOf(id)
  return i < 0 ? '#111827' : FOCUS_COLORS[i % FOCUS_COLORS.length]
}
