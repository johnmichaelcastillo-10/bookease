/** Pure helpers for the calendar: visible ranges, titles, navigation, grid geometry, lanes. */
import { format } from 'date-fns'
import { addDays, addMonths, eachDate, isoDateToLocalDate, rangeMinutes, startOfMonth, startOfWeek, toMinutes } from '@/lib/time'
import { formatTimeRange } from '@/lib/format'
import { STATUS_LABELS } from '@/services/appointments/status'
import type { Appointment, BusinessHoursDay, ISODate } from '@/types/models'

export const CALENDAR_VIEWS = ['day', 'week', 'month', 'agenda'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

export const AGENDA_DAYS = 14
/** Height of one 30-minute row, in pixels. */
export const SLOT_HEIGHT = 28
export const SLOT_MINUTES = 30
export const PX_PER_MINUTE = SLOT_HEIGHT / SLOT_MINUTES

export function isCalendarView(value: string | null): value is CalendarView {
  return value !== null && (CALENDAR_VIEWS as readonly string[]).includes(value)
}

export interface VisibleRange {
  from: ISODate
  to: ISODate
}

export function visibleRange(view: CalendarView, date: ISODate): VisibleRange {
  switch (view) {
    case 'day':
      return { from: date, to: date }
    case 'week': {
      const from = startOfWeek(date)
      return { from, to: addDays(from, 6) }
    }
    case 'month': {
      const from = startOfWeek(startOfMonth(date))
      return { from, to: addDays(from, 41) }
    }
    case 'agenda':
      return { from: date, to: addDays(date, AGENDA_DAYS - 1) }
  }
}

/** Moves the anchor date one period backwards (-1) or forwards (+1). */
export function shiftDate(view: CalendarView, date: ISODate, direction: -1 | 1): ISODate {
  switch (view) {
    case 'day':
      return addDays(date, direction)
    case 'week':
      return addDays(date, 7 * direction)
    case 'month':
      return addMonths(date, direction)
    case 'agenda':
      return addDays(date, AGENDA_DAYS * direction)
  }
}

const d = (iso: ISODate) => isoDateToLocalDate(iso)

function spanTitle(from: ISODate, to: ISODate): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  const sameMonth = sameYear && from.slice(0, 7) === to.slice(0, 7)
  if (sameMonth) return `${format(d(from), 'MMM d')} – ${format(d(to), 'd, yyyy')}`
  if (sameYear) return `${format(d(from), 'MMM d')} – ${format(d(to), 'MMM d, yyyy')}`
  return `${format(d(from), 'MMM d, yyyy')} – ${format(d(to), 'MMM d, yyyy')}`
}

export function periodTitle(view: CalendarView, date: ISODate): string {
  switch (view) {
    case 'day':
      return format(d(date), 'EEEE, MMMM d, yyyy')
    case 'month':
      return format(d(date), 'MMMM yyyy')
    case 'week':
    case 'agenda': {
      const range = visibleRange(view, date)
      return spanTitle(range.from, range.to)
    }
  }
}

export function weekDates(date: ISODate): ISODate[] {
  const from = startOfWeek(date)
  return eachDate(from, addDays(from, 6))
}

/**
 * Hours shown in the time grid: earliest opening to latest closing across the week, widened to
 * include any appointment outside those hours. Falls back to 08:00–18:00. Whole hours.
 */
export function gridBounds(businessHours: readonly BusinessHoursDay[], appointments: readonly Pick<Appointment, 'startTime' | 'endTime'>[]): { start: number; end: number } {
  let start = Infinity
  let end = -Infinity
  for (const day of businessHours) {
    if (!day.isOpen) continue
    for (const interval of day.intervals) {
      const r = rangeMinutes(interval)
      start = Math.min(start, r.start)
      end = Math.max(end, r.end)
    }
  }
  if (!Number.isFinite(start)) {
    start = 8 * 60
    end = 18 * 60
  }
  for (const a of appointments) {
    start = Math.min(start, toMinutes(a.startTime))
    end = Math.max(end, toMinutes(a.endTime))
  }
  return { start: Math.floor(start / 60) * 60, end: Math.min(24 * 60, Math.ceil(end / 60) * 60) }
}

export interface LaidOut<T> {
  item: T
  lane: number
  lanes: number
}

/**
 * Side-by-side lanes for overlapping appointments in one column: each cluster of mutually
 * overlapping items shares its width equally.
 */
export function layoutLanes<T extends Pick<Appointment, 'startTime' | 'endTime'>>(items: readonly T[]): LaidOut<T>[] {
  const sorted = [...items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(b.endTime) - toMinutes(a.endTime))
  const result: LaidOut<T>[] = []
  let cluster: LaidOut<T>[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const entry of cluster) entry.lanes = laneEnds.length
    result.push(...cluster)
    cluster = []
    laneEnds = []
  }

  for (const item of sorted) {
    const start = toMinutes(item.startTime)
    const end = Math.max(toMinutes(item.endTime), start + 1)
    if (start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    cluster.push({ item, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return result
}

export function sortByStart<T extends Pick<Appointment, 'date' | 'startTime'>>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
}

/** Accessible name shared by every calendar representation of an appointment. */
export function appointmentLabel(a: Appointment): string {
  return `${formatTimeRange(a.startTime, a.endTime)}, ${a.customerName}, ${a.serviceName} with ${a.staffName}, ${STATUS_LABELS[a.status]}`
}
