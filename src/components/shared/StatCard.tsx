import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Compact KPI tile: label, value, optional hint. Flat, no decorative gradients. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: 'default' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'noshow'
  className?: string
}) {
  const toneClass = {
    default: 'text-muted-foreground',
    pending: 'text-pending',
    confirmed: 'text-confirmed',
    completed: 'text-completed',
    cancelled: 'text-cancelled',
    noshow: 'text-noshow',
  }[tone]
  return (
    <div className={cn('rounded-lg border bg-card px-4 py-3.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn('size-4', toneClass)} aria-hidden />}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
