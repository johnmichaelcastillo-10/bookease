import { format } from 'date-fns'
import { StatusDot } from '@/components/shared/StatusBadge'
import { formatTime } from '@/lib/format'
import { eachDate, isoDateToLocalDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Appointment, ID, ISODate } from '@/types/models'
import { appointmentLabel, sortByStart, type VisibleRange } from '../calendarUtils'

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_ITEMS = 3

/** Six-week month grid. "+N more" and the day number open that day in day view. */
export function MonthView({
  range,
  month,
  today,
  appointments,
  closedDates,
  onSelectAppointment,
  onOpenDay,
}: {
  range: VisibleRange
  /** Any date in the displayed month. */
  month: ISODate
  today: ISODate
  appointments: Appointment[]
  /** Dates the business is closed, with an optional label (holiday name). */
  closedDates: Map<ISODate, string | undefined>
  onSelectAppointment: (id: ID) => void
  onOpenDay: (date: ISODate) => void
}) {
  const byDate = new Map<ISODate, Appointment[]>()
  for (const a of sortByStart(appointments)) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a])
  const dates = eachDate(range.from, range.to)
  const monthKey = month.slice(0, 7)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b bg-card">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dates.map((date) => {
            const items = byDate.get(date) ?? []
            const inMonth = date.slice(0, 7) === monthKey
            const closed = closedDates.has(date)
            const label = closedDates.get(date)
            const isToday = date === today
            return (
              <div
                key={date}
                className={cn(
                  'min-h-28 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0',
                  !inMonth && 'bg-muted/30',
                  closed && 'bg-muted/60 dark:bg-muted/40',
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenDay(date)}
                    aria-label={`Open ${format(isoDateToLocalDate(date), 'EEEE, MMMM d')} in day view`}
                    className={cn(
                      'flex size-6 items-center justify-center rounded-md text-xs tabular hover:bg-accent',
                      !inMonth && 'text-muted-foreground',
                      isToday && 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90',
                    )}
                  >
                    {Number(date.slice(8))}
                  </button>
                  {closed && <span className="truncate text-[10px] text-muted-foreground">{label ?? 'Closed'}</span>}
                </div>
                <ul className="space-y-0.5">
                  {items.slice(0, MAX_ITEMS).map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => onSelectAppointment(a.id)}
                        aria-label={appointmentLabel(a)}
                        className={cn(
                          'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-4 hover:bg-accent',
                          a.status === 'cancelled' && 'text-muted-foreground line-through',
                        )}
                      >
                        <StatusDot status={a.status} className="size-1.5" />
                        <span className="shrink-0 tabular text-muted-foreground">{formatTime(a.startTime).replace(':00', '')}</span>
                        <span className="truncate">{a.customerName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {items.length > MAX_ITEMS && (
                  <button type="button" onClick={() => onOpenDay(date)} className="mt-0.5 px-1 text-[11px] font-medium text-primary hover:underline">
                    +{items.length - MAX_ITEMS} more
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
