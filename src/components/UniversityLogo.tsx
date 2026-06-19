import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { University } from '@/types'

interface UniversityLogoProps {
  university: University
  size?: number
  className?: string
}

/**
 * University logo as a square with rounded corners. Prefers the QS logo URL,
 * falls back to the domain favicon, then to a monogram.
 */
export default function UniversityLogo({ university, size = 46, className }: UniversityLogoProps) {
  const src =
    university.logo ??
    (university.domain ? `https://www.google.com/s2/favicons?domain=${university.domain}&sz=128` : undefined)
  const initials = university.shortName.slice(0, 3).toUpperCase()

  return (
    <Avatar
      className={cn('border border-border bg-white', className)}
      style={{ width: size, height: size, borderRadius: '20%' }}
    >
      {src && (
        <AvatarImage
          src={src}
          alt={`${university.name} logo`}
          referrerPolicy="no-referrer"
          className="object-contain p-1"
        />
      )}
      <AvatarFallback
        className="bg-white font-medium text-foreground"
        style={{ fontSize: size * 0.28, borderRadius: '20%' }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
