import { useState } from 'react'
import type { University } from '@/types'

interface UniversityLogoProps {
  university: University
  /** Fixed height in px; width scales with the logo's aspect ratio. */
  size?: number
  className?: string
}

function initialsOf(u: University): string {
  const base = u.shortName ?? u.name.replace(/\([^)]*\)/g, '').trim()
  return base.slice(0, 3).toUpperCase()
}

/**
 * University logo with a fixed HEIGHT and free width (so wide wordmark logos
 * show in full). Prefers the QS logo, then the domain favicon, then a monogram.
 */
export default function UniversityLogo({ university, size = 40, className }: UniversityLogoProps) {
  const src =
    university.logo ??
    (university.domain
      ? `https://www.google.com/s2/favicons?domain=${university.domain}&sz=128`
      : undefined)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[16%] bg-[#f4f4f4] font-medium text-foreground ${className ?? ''}`}
        style={{ height: size, minWidth: size, fontSize: size * 0.32 }}
        aria-hidden
      >
        {initialsOf(university)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={`${university.name} logo`}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-contain ${className ?? ''}`}
      style={{ height: size, width: 'auto', maxWidth: size * 2.6 }}
    />
  )
}
