import { cn } from '@/lib/utils'

export function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap',
        active ? 'bg-completed-soft text-completed-fg' : 'bg-cancelled-soft text-cancelled-fg',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', active ? 'bg-completed' : 'bg-cancelled')} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
