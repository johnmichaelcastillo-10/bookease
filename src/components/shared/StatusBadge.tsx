import { CalendarCheck2, CheckCircle2, CircleDashed, CircleSlash, UserX } from 'lucide-react'
import { STATUS_LABELS } from '@/services/appointments/status'
import { cn } from '@/lib/utils'
import type { AppointmentStatus } from '@/types/models'

export const STATUS_STYLES: Record<AppointmentStatus, { badge: string; dot: string; bar: string; icon: typeof CheckCircle2 }> = {
  pending: { badge: 'bg-pending-soft text-pending-fg', dot: 'bg-pending', bar: 'border-l-pending', icon: CircleDashed },
  confirmed: { badge: 'bg-confirmed-soft text-confirmed-fg', dot: 'bg-confirmed', bar: 'border-l-confirmed', icon: CalendarCheck2 },
  completed: { badge: 'bg-completed-soft text-completed-fg', dot: 'bg-completed', bar: 'border-l-completed', icon: CheckCircle2 },
  cancelled: { badge: 'bg-cancelled-soft text-cancelled-fg', dot: 'bg-cancelled', bar: 'border-l-cancelled', icon: CircleSlash },
  'no-show': { badge: 'bg-noshow-soft text-noshow-fg', dot: 'bg-noshow', bar: 'border-l-noshow', icon: UserX },
}

/** Status shown as icon + text, never colour alone. */
export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const style = STATUS_STYLES[status]
  const Icon = style.icon
  return (
    <span
      className={cn('inline-flex h-5.5 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap', style.badge, className)}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}

export function StatusDot({ status, className }: { status: AppointmentStatus; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_STYLES[status].dot, className)} />
}
