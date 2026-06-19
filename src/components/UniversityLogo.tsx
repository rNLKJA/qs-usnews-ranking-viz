import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { University } from '@/types'

interface UniversityLogoProps {
  university: University
  size?: number
  className?: string
}

/**
 * University logo as an iOS-style squircle (Nothing OS spec: square,
 * border-radius 22%). Uses an explicit logo when provided, otherwise the domain
 * favicon, falling back to a monogram.
 */
export default function UniversityLogo({ university, size = 46, className }: UniversityLogoProps) {
  const src =
    university.logo ?? `https://www.google.com/s2/favicons?domain=${university.domain}&sz=128`
  const initials = university.shortName.slice(0, 3).toUpperCase()

  return (
    <Avatar
      className={cn('border border-border bg-white', className)}
      style={{ width: size, height: size, borderRadius: '22%' }}
    >
      <AvatarImage src={src} alt={`${university.name} logo`} className="object-contain p-1.5" />
      <AvatarFallback
        className="bg-white font-medium text-foreground"
        style={{ fontSize: size * 0.28, borderRadius: '22%' }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
