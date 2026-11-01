import { CalendarX2 } from 'lucide-react'
import { EmptyState } from '@/components/feedback/states'
import { staffColor } from '@/components/shared/StaffBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatISODate, formatMoney, formatTimeRange } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Appointment, ID, ISODate, Staff } from '@/types/models'
import { appointmentLabel, sortByStart } from '../calendarUtils'

/** Appointments grouped by day for the visible period. */
export function AgendaView({
  appointments,
  today,
  staffById,
  currency,
  onSelectAppointment,
}: {
  appointments: Appointment[]
  today: ISODate
  staffById: Map<ID, Staff>
  currency: string
  onSelectAppointment: (id: ID) => void
}) {
  if (appointments.length === 0) {
    return <EmptyState icon={CalendarX2} title="No appointments in this period" description="Try another date range or clear the filters." />
  }
  const groups = new Map<ISODate, Appointment[]>()
  for (const a of sortByStart(appointments)) groups.set(a.date, [...(groups.get(a.date) ?? []), a])

  return (
    <div className="divide-y">
      {[...groups.entries()].map(([date, items]) => (
        <section key={date} aria-labelledby={`agenda-${date}`}>
          <h3 id={`agenda-${date}`} className="sticky top-0 z-10 flex items-center gap-2 bg-muted/60 px-4 py-2 text-xs font-semibold backdrop-blur">
            {formatISODate(date, 'EEEE, MMMM d')}
            {date === today && <span className="rounded bg-primary px-1.5 py-px text-[10px] font-medium text-primary-foreground">Today</span>}
            <span className="ml-auto font-normal text-muted-foreground">{items.length}</span>
          </h3>
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelectAppointment(a.id)}
                  aria-label={appointmentLabel(a)}
                  className="grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50 sm:grid-cols-[9.5rem_1fr_auto_auto] sm:items-center"
                >
                  <span className="text-sm font-medium tabular">{formatTimeRange(a.startTime, a.endTime)}</span>
                  <span className={cn('min-w-0', a.status === 'cancelled' && 'text-muted-foreground')}>
                    <span className={cn('block truncate text-sm font-medium', a.status === 'cancelled' && 'line-through')}>{a.customerName}</span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', staffColor(staffById.get(a.staffId)?.color).dot)} />
                      {a.serviceName} · {a.staffName}
                    </span>
                  </span>
                  <span className="col-start-2 text-xs text-muted-foreground tabular sm:col-start-auto">{formatMoney(a.priceCents, currency)}</span>
                  <span className="col-start-2 sm:col-start-auto">
                    <StatusBadge status={a.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
