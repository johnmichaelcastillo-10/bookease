import { AlertCircle, CalendarClock, Clock3 } from 'lucide-react'
import { EmptyState } from '@/components/feedback/states'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatISODate, formatTime } from '@/lib/format'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { Appointment, ISODate } from '@/types/models'
import { Link } from 'react-router'

function dayLabel(date: ISODate, today: ISODate, tomorrow: ISODate) {
  if (date === today) return 'Today'
  if (date === tomorrow) return 'Tomorrow'
  return formatISODate(date, 'EEE, MMM d')
}

export function UpcomingAppointments({ rows, today, tomorrow }: { rows: Appointment[]; today: ISODate; tomorrow: ISODate }) {
  const openDetails = useAppointmentUi((s) => s.openDetails)
  return (
    <Panel className="min-w-0">
      <PanelHeader
        title="Upcoming appointments"
        description="Next pending and confirmed bookings"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/appointments">View all</Link>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nothing scheduled" description="No pending or confirmed appointments ahead." />
      ) : (
        <ul className="divide-y">
          {rows.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => openDetails(a.id)}
                className="grid w-full grid-cols-[4.75rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:grid-cols-[6.5rem_1fr_auto]"
              >
                <span className="text-sm">
                  <span className="block font-medium tabular">{formatTime(a.startTime)}</span>
                  <span className="block text-xs text-muted-foreground">{dayLabel(a.date, today, tomorrow)}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{a.customerName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.serviceName} · {a.staffName}
                  </span>
                </span>
                <StatusBadge status={a.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function NeedsAttention({ pendingSoon, pastOpen }: { pendingSoon: Appointment[]; pastOpen: Appointment[] }) {
  const openDetails = useAppointmentUi((s) => s.openDetails)
  const groups = [
    { key: 'pending', icon: Clock3, title: 'Pending, starting within 48 hours', hint: 'Confirm or follow up', rows: pendingSoon },
    { key: 'past', icon: AlertCircle, title: 'Ended but still open', hint: 'Mark completed, no-show or cancelled', rows: pastOpen },
  ]
  const total = pendingSoon.length + pastOpen.length
  return (
    <Panel className="min-w-0">
      <PanelHeader title="Needs attention" description={total === 0 ? 'All caught up' : `${total} appointment${total === 1 ? '' : 's'} to review`} />
      {total === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No pending bookings coming up and nothing left open from the past.</p>
      ) : (
        <div className="divide-y">
          {groups
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <section key={g.key} className="px-4 py-3" aria-label={g.title}>
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <g.icon className="size-3.5 text-muted-foreground" aria-hidden />
                  {g.title}
                  <span className="ml-auto rounded bg-muted px-1.5 py-px text-[11px] tabular text-muted-foreground">{g.rows.length}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{g.hint}</p>
                <ul className="mt-2 space-y-1">
                  {g.rows.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => openDetails(a.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                      >
                        <span className="min-w-0 truncate">
                          {a.customerName} <span className="text-muted-foreground">· {a.serviceName}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {formatISODate(a.date, 'MMM d')}, {formatTime(a.startTime)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {g.rows.length > 4 && (
                  <Link to="/admin/appointments" className="mt-1 inline-block px-2 text-xs font-medium text-primary hover:underline">
                    and {g.rows.length - 4} more
                  </Link>
                )}
              </section>
            ))}
        </div>
      )}
    </Panel>
  )
}
