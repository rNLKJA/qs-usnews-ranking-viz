import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { University } from '@/types'

interface UniversityLogoProps {
  university: University
  size?: number
  className?: string
}

/**
 * University logo as a shadcn Avatar. Uses an explicit logo when provided,
 * otherwise the domain favicon, and falls back to a warm monogram so a missing
 * image never shows as a broken square.
 */
export default function UniversityLogo({ university, size = 46, className }: UniversityLogoProps) {
  const src =
    university.logo ?? `https://www.google.com/s2/favicons?domain=${university.domain}&sz=128`
  const initials = university.shortName.slice(0, 3).toUpperCase()

  return (
    <Avatar
      className={cn('rounded-xl border border-border bg-white shadow-sm', className)}
      style={{ width: size, height: size }}
    >
      <AvatarImage src={src} alt={`${university.name} logo`} className="object-contain p-1.5" />
      <AvatarFallback
        className="rounded-xl bg-secondary font-semibold text-secondary-foreground"
        style={{ fontSize: size * 0.3 }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
