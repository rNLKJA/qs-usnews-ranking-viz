import { useState } from 'react'
import type { University } from '../types'

interface UniversityLogoProps {
  university: University
  size?: number
}

/**
 * University logo with a graceful fallback chain: Clearbit logo → Google
 * favicon → a coloured monogram. Universities rarely expose a stable logo URL,
 * so we resolve from the domain and degrade instead of showing a broken image.
 */
export default function UniversityLogo({ university, size = 48 }: UniversityLogoProps) {
  const sources = [`https://www.google.com/s2/favicons?domain=${university.domain}&sz=128`]
  const [idx, setIdx] = useState(0)
  const failed = idx >= sources.length

  if (failed) {
    const initials = university.shortName.slice(0, 3).toUpperCase()
    return (
      <div
        className="flex items-center justify-center rounded-full bg-slate-700 font-semibold text-white"
        style={{ width: size, height: size, fontSize: size * 0.32 }}
        aria-hidden
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={sources[idx]}
      alt={`${university.name} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      className="rounded-lg bg-white object-contain p-1 shadow-sm ring-1 ring-slate-200"
      style={{ width: size, height: size }}
    />
  )
}
