import { CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The business logo if one is set, otherwise the BookEase mark. */
export function BrandMark({ logo, name, className }: { logo?: string | null; name?: string; className?: string }) {
  if (logo) {
    return <img src={logo} alt={name ? `${name} logo` : ''} className={cn('size-8 shrink-0 rounded-md border bg-background object-contain', className)} />
  }
  return (
    <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground', className)}>
      <CalendarCheck className="size-4.5" />
    </span>
  )
}
