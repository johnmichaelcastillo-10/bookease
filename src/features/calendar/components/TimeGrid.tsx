import { useEffect, useRef } from 'react'
import { fromMinutes, toMinutes, type WallClock } from '@/lib/time'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { subtract, type MinuteRange } from '@/services/availability/intervals'
import type { Appointment, ID, ISODate, Staff } from '@/types/models'
import { layoutLanes, PX_PER_MINUTE, SLOT_HEIGHT, SLOT_MINUTES } from '../calendarUtils'
import { AppointmentBlock } from './AppointmentBlock'

export interface GridColumn {
  key: string
  date: ISODate
  /** Set in day view (one column per staff member). */
  staffId?: ID
  label: React.ReactNode
  sublabel?: React.ReactNode
  /** Bookable time in this column. Everything else is shaded. */
  open: MinuteRange[]
  /** Shown over a fully closed column (e.g. a holiday name). */
  closedLabel?: string
  isToday: boolean
  appointments: Appointment[]
}

export interface TimeGridProps {
  columns: GridColumn[]
  bounds: { start: number; end: number }
  now: WallClock
  staffById: Map<ID, Staff>
  /** Show the staff colour dot on blocks (week view, where columns mix staff). */
  showStaffDot: boolean
  minColumnWidth: number
  onSelectAppointment: (id: ID) => void
  onCreate: (date: ISODate, startTime: string, staffId?: ID) => void
}

/**
 * Day/week time grid. Scrolls inside its own container (both axes) so the page never
 * overflows horizontally on small screens.
 */
export function TimeGrid({ columns, bounds, now, staffById, showStaffDot, minColumnWidth, onSelectAppointment, onCreate }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const height = (bounds.end - bounds.start) * PX_PER_MINUTE
  const rows: number[] = []
  for (let m = bounds.start; m < bounds.end; m += SLOT_MINUTES) rows.push(m)
  const template = `3.5rem repeat(${columns.length}, minmax(${minColumnWidth}px, 1fr))`
  const showsToday = columns.some((c) => c.isToday)
  const nowVisible = showsToday && now.minutes >= bounds.start && now.minutes <= bounds.end

  // Bring the current time (or the first opening) into view on first render.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = nowVisible ? (now.minutes - bounds.start) * PX_PER_MINUTE - 120 : 0
    el.scrollTop = Math.max(0, target)
    // Only on mount / when the grid range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.start, bounds.end])

  const isPast = (date: ISODate, minutes: number) => date < now.date || (date === now.date && minutes + SLOT_MINUTES <= now.minutes)

  return (
    <div ref={scrollRef} className="scrollbar-thin relative max-h-[calc(100svh-15rem)] min-h-[420px] overflow-auto">
      <div style={{ minWidth: `calc(3.5rem + ${columns.length * minColumnWidth}px)` }}>
        {/* Column headers */}
        <div className="sticky top-0 z-30 grid border-b bg-card" style={{ gridTemplateColumns: template }}>
          <div className="border-r" />
          {columns.map((col) => (
            <div key={col.key} className={cn('min-w-0 border-r px-2 py-2 last:border-r-0', col.isToday && 'bg-brand-soft/50')}>
              {col.label}
              {col.sublabel && <div className="truncate text-[11px] text-muted-foreground">{col.sublabel}</div>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="grid" style={{ gridTemplateColumns: template }}>
          <div className="relative border-r" style={{ height }} aria-hidden>
            {rows.map((m) =>
              m % 60 === 0 ? (
                <span key={m} className={cn('absolute right-1.5 text-[10px] text-muted-foreground tabular', m === bounds.start ? 'translate-y-0.5' : '-translate-y-1/2')} style={{ top: (m - bounds.start) * PX_PER_MINUTE }}>
                  {formatTime(fromMinutes(m)).replace(':00', '')}
                </span>
              ) : null,
            )}
          </div>

          {columns.map((col) => {
            const closed = subtract([{ start: bounds.start, end: bounds.end }], col.open)
            const laid = layoutLanes(col.appointments)
            return (
              <div key={col.key} className="relative border-r last:border-r-0" style={{ height }}>
                {/* Closed time */}
                {closed.map((r) => (
                  <div
                    key={`c-${r.start}`}
                    aria-hidden
                    className="absolute inset-x-0 bg-muted/70 dark:bg-muted/40"
                    style={{ top: (r.start - bounds.start) * PX_PER_MINUTE, height: (r.end - r.start) * PX_PER_MINUTE }}
                  />
                ))}
                {col.closedLabel && (
                  <div className="absolute inset-x-1 top-2 z-[5] rounded bg-background/90 px-1.5 py-1 text-center text-[11px] font-medium text-muted-foreground">
                    {col.closedLabel}
                  </div>
                )}

                {/* 30-minute rows; open future rows create an appointment on click */}
                {rows.map((m) => {
                  const open = col.open.some((r) => m >= r.start && m + SLOT_MINUTES <= r.end)
                  const clickable = open && !isPast(col.date, m)
                  return (
                      <div
                        key={m}
                        aria-hidden
                        onClick={clickable ? () => onCreate(col.date, fromMinutes(m), col.staffId) : undefined}
                        title={clickable ? `New appointment at ${formatTime(fromMinutes(m))}` : undefined}
                        className={cn(
                          'absolute inset-x-0 border-t',
                          m % 60 === 0 ? 'border-border' : 'border-border/50 border-dashed',
                          clickable && 'group cursor-pointer hover:bg-brand-soft/70',
                        )}
                        style={{ top: (m - bounds.start) * PX_PER_MINUTE, height: SLOT_HEIGHT }}
                      >
                        {clickable && (
                          <span className="hidden pl-1.5 text-[10px] font-medium text-primary group-hover:inline">+ {formatTime(fromMinutes(m))}</span>
                        )}
                      </div>
                  )
                })}

                {laid.map(({ item, lane, lanes }) => {
                  const start = toMinutes(item.startTime)
                  const end = toMinutes(item.endTime)
                  return (
                    <AppointmentBlock
                      key={item.id}
                      appointment={item}
                      top={(start - bounds.start) * PX_PER_MINUTE}
                      height={(end - start) * PX_PER_MINUTE}
                      lane={lane}
                      lanes={lanes}
                      staffColorName={staffById.get(item.staffId)?.color}
                      showStaff={showStaffDot}
                      onSelect={onSelectAppointment}
                    />
                  )
                })}

                {col.isToday && nowVisible && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-primary" style={{ top: (now.minutes - bounds.start) * PX_PER_MINUTE }}>
                    <span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
