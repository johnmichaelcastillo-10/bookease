import { CalendarDays, Clock, Tag, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { formatDuration, formatISODate, formatMoney, formatTimeRange } from '@/lib/format'
import { fromMinutes, toMinutes } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Service, Staff } from '@/types/models'

/** Compact running summary of the booking so far, shown beside the step content. */
export function BookingSummary({
  service,
  staff,
  anyStaff,
  date,
  startTime,
  currency,
  className,
}: {
  service: Service | null
  staff: Staff | null
  anyStaff: boolean
  date: string | null
  startTime: string | null
  currency: string
  className?: string
}) {
  if (!service) return null
  const end = startTime ? fromMinutes(Math.min(1440, toMinutes(startTime) + service.durationMinutes)) : null
  return (
    <aside aria-label="Your booking" className={cn('rounded-lg border bg-card p-4 text-sm', className)}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your booking</p>
      <p className="mt-2 font-semibold">{service.name}</p>
      <dl className="mt-3 space-y-2 text-muted-foreground">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Duration and price</dt>
          <Tag className="size-4 shrink-0" aria-hidden />
          <dd>
            {formatDuration(service.durationMinutes)} · {formatMoney(service.priceCents, currency)}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Staff</dt>
          <UserRound className="size-4 shrink-0" aria-hidden />
          <dd>{staff ? staff.fullName : anyStaff ? 'Any available staff' : 'Staff not chosen yet'}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Date</dt>
          <CalendarDays className="size-4 shrink-0" aria-hidden />
          <dd>{date ? formatISODate(date) : 'Date not chosen yet'}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Time</dt>
          <Clock className="size-4 shrink-0" aria-hidden />
          <dd className="tabular">{startTime && end ? formatTimeRange(startTime, end) : 'Time not chosen yet'}</dd>
        </div>
      </dl>
      <Link to="/book/service" className="mt-4 inline-block text-xs font-medium text-primary hover:underline">
        Change service
      </Link>
    </aside>
  )
}
