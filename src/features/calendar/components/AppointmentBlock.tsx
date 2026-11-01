import { staffColor } from '@/components/shared/StaffBadge'
import { STATUS_STYLES } from '@/components/shared/StatusBadge'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Appointment } from '@/types/models'
import { appointmentLabel } from '../calendarUtils'

/** An appointment positioned inside a time-grid column. */
export function AppointmentBlock({
  appointment: a,
  top,
  height,
  lane,
  lanes,
  staffColorName,
  showStaff,
  onSelect,
}: {
  appointment: Appointment
  top: number
  height: number
  lane: number
  lanes: number
  staffColorName?: string
  showStaff: boolean
  onSelect: (id: string) => void
}) {
  const cancelled = a.status === 'cancelled'
  const compact = height < 44
  const width = 100 / lanes
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect(a.id)
      }}
      aria-label={appointmentLabel(a)}
      title={appointmentLabel(a)}
      className={cn(
        'absolute z-10 overflow-hidden rounded-md border border-l-[3px] bg-card px-1.5 py-0.5 text-left shadow-xs transition-colors',
        'hover:bg-accent focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        STATUS_STYLES[a.status].bar,
        cancelled && 'bg-muted/60 text-muted-foreground',
      )}
      style={{ top, height: Math.max(height - 2, 18), left: `calc(${lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
    >
      <span className={cn('flex items-center gap-1 text-[11px] leading-4 font-medium tabular', cancelled && 'line-through')}>
        {showStaff && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', staffColor(staffColorName).dot)} />}
        <span className="truncate">
          {formatTime(a.startTime)}
          {compact && <span className="font-normal"> · {a.customerName}</span>}
        </span>
      </span>
      {!compact && (
        <>
          <span className={cn('block truncate text-xs leading-4 font-medium', cancelled && 'line-through')}>{a.customerName}</span>
          <span className="block truncate text-[11px] leading-4 text-muted-foreground">{a.serviceName}</span>
        </>
      )}
    </button>
  )
}
