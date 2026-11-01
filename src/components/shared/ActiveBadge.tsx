import { CheckCircle2, CircleSlash } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Active / inactive marker for services and similar records (icon + text, not colour alone). */
export function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  const Icon = active ? CheckCircle2 : CircleSlash
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap',
        active ? 'bg-completed-soft text-completed-fg' : 'bg-cancelled-soft text-cancelled-fg',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
