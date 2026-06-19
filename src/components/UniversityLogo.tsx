import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { University } from '@/types'

interface UniversityLogoProps {
  university: University
  size?: number
  className?: string
}

/**
 * University logo as a borderless square with lightly rounded corners (the
 * `rounded-[16%]` class overrides the Avatar's default `rounded-full`). A subtle
 * tint keeps the square readable on white. Prefers the QS logo, then the domain
 * favicon, then a monogram.
 */
export default function UniversityLogo({ university, size = 46, className }: UniversityLogoProps) {
  const src =
    university.logo ??
    (university.domain ? `https://www.google.com/s2/favicons?domain=${university.domain}&sz=128` : undefined)
  const initials = university.shortName.slice(0, 3).toUpperCase()

  return (
    <Avatar className={cn('rounded-[16%] bg-[#f4f4f4]', className)} style={{ width: size, height: size }}>
      {src && (
        <AvatarImage
          src={src}
          alt={`${university.name} logo`}
          referrerPolicy="no-referrer"
          className="rounded-[16%] object-contain"
        />
      )}
      <AvatarFallback className="rounded-[16%] bg-[#f4f4f4] font-medium text-foreground" style={{ fontSize: size * 0.28 }}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
