import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatPhone } from '@/lib/contact'
import { formatDuration, formatISODate, formatMoney, formatTimeRange } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Appointment, BusinessSettings } from '@/types/models'

/** Read-only view of a saved booking, used on the confirmation and lookup pages. */
export function BookingDetailsCard({
  appointment: a,
  settings,
  className,
}: {
  appointment: Appointment
  settings: BusinessSettings
  className?: string
}) {
  const rows: [string, React.ReactNode][] = [
    ['Service', a.serviceName],
    ['Staff', a.staffName],
    ['Date', formatISODate(a.date, 'EEEE, MMMM d, yyyy')],
    ['Time', <span className="tabular">{`${formatTimeRange(a.startTime, a.endTime)} (${settings.timezone.replace(/_/g, ' ')})`}</span>],
    ['Duration', formatDuration(a.durationMinutes)],
    ['Price', <span className="tabular">{formatMoney(a.priceCents, settings.currency)}</span>],
    ['Name', a.customerName],
    ['Email', <span className="break-all">{a.customerEmail}</span>],
    ['Phone', formatPhone(a.customerPhone)],
  ]
  if (a.customerNotes) rows.push(['Notes', <span className="whitespace-pre-line">{a.customerNotes}</span>])

  return (
    <div className={cn('print-area rounded-lg border bg-card', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Booking reference</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-wider">{a.reference}</p>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <dl className="grid gap-x-6 gap-y-2 px-4 py-4 text-sm sm:grid-cols-[auto_1fr] sm:px-5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mb-1.5 font-medium sm:mb-0">{value}</dd>
          </div>
        ))}
      </dl>
      {a.status === 'cancelled' && a.cancelledAt && (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground sm:px-5">
          Cancelled {a.cancelledBy === 'customer' ? 'by you' : 'by the business'}
          {a.cancellationReason ? `: ${a.cancellationReason}` : '.'}
        </p>
      )}
    </div>
  )
}

export function BusinessContact({ settings }: { settings: BusinessSettings }) {
  const lines = [settings.address, settings.phone ? formatPhone(settings.phone) : '', settings.email].filter(Boolean)
  return (
    <div className="rounded-lg border bg-card p-4 text-sm">
      <p className="font-semibold">{settings.name}</p>
      {lines.length === 0 ? (
        <p className="mt-1 text-muted-foreground">No contact details have been added yet.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
