import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Static class maps so Tailwind can see every colour used for staff. */
export const STAFF_COLOR_CLASSES: Record<string, { dot: string; avatar: string; event: string }> = {
  teal: { dot: 'bg-teal-500', avatar: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100', event: 'border-l-teal-500' },
  blue: { dot: 'bg-blue-500', avatar: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100', event: 'border-l-blue-500' },
  violet: { dot: 'bg-violet-500', avatar: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100', event: 'border-l-violet-500' },
  amber: { dot: 'bg-amber-500', avatar: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100', event: 'border-l-amber-500' },
  rose: { dot: 'bg-rose-500', avatar: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100', event: 'border-l-rose-500' },
  lime: { dot: 'bg-lime-500', avatar: 'bg-lime-100 text-lime-900 dark:bg-lime-900/60 dark:text-lime-100', event: 'border-l-lime-500' },
  cyan: { dot: 'bg-cyan-500', avatar: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-900/60 dark:text-cyan-100', event: 'border-l-cyan-500' },
  orange: { dot: 'bg-orange-500', avatar: 'bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-100', event: 'border-l-orange-500' },
}

export function staffColor(color: string | undefined) {
  return STAFF_COLOR_CLASSES[color ?? ''] ?? STAFF_COLOR_CLASSES.teal!
}

export function Avatar({ name, color, size = 'md', className }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
        size === 'sm' && 'size-6 text-[10px]',
        size === 'md' && 'size-8 text-xs',
        size === 'lg' && 'size-12 text-base',
        color ? staffColor(color).avatar : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
