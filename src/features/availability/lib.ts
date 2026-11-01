/** Availability helpers shared by the availability and staff screens. */
import { formatISODate, formatTimeRange } from '@/lib/format'
import { fromMinutes, isValidTime, toMinutes } from '@/lib/time'
import type { BlockKind, BlockScope, BlockedDate, BusinessHoursDay, DaySchedule, TimeRange, WeeklySchedule } from '@/types/models'
import { WEEKDAYS } from '@/types/models'

export const KIND_LABELS: Record<BlockKind, string> = {
  holiday: 'Holiday',
  closure: 'Closure',
  'special-hours': 'Special hours',
  leave: 'Leave',
  unavailable: 'Unavailable',
}

export const KIND_DESCRIPTIONS: Record<BlockKind, string> = {
  holiday: 'The business is closed for a public or company holiday.',
  closure: 'The business is closed (renovation, event, emergency).',
  'special-hours': 'Different opening hours replace the weekly schedule on these dates.',
  leave: 'The staff member is away and takes no bookings.',
  unavailable: 'A blocked period: all day, or only the times you add.',
}

/** Kinds that make sense for each scope. */
export const KINDS_BY_SCOPE: Record<BlockScope, BlockKind[]> = {
  business: ['holiday', 'closure', 'special-hours', 'unavailable'],
  staff: ['leave', 'unavailable', 'special-hours'],
}

/** Soft badge colours per kind (theme tokens only). */
export const KIND_STYLES: Record<BlockKind, string> = {
  holiday: 'bg-noshow-soft text-noshow-fg',
  closure: 'bg-noshow-soft text-noshow-fg',
  'special-hours': 'bg-confirmed-soft text-confirmed-fg',
  leave: 'bg-pending-soft text-pending-fg',
  unavailable: 'bg-cancelled-soft text-cancelled-fg',
}

export function describeDates(block: Pick<BlockedDate, 'date' | 'endDate'>): string {
  const end = block.endDate || block.date
  if (end === block.date) return formatISODate(block.date)
  return `${formatISODate(block.date, 'MMM d')} – ${formatISODate(end, 'MMM d, yyyy')}`
}

export function describeTimes(block: Pick<BlockedDate, 'kind' | 'allDay' | 'ranges'>): string {
  if (block.kind !== 'special-hours' && block.allDay) return 'All day'
  const ranges = block.ranges.map((r) => safeRange(r)).filter(Boolean)
  if (ranges.length === 0) return block.kind === 'special-hours' ? 'Closed' : 'All day'
  return (block.kind === 'special-hours' ? 'Open ' : '') + ranges.join(', ')
}

function safeRange(r: TimeRange): string {
  return isValidTime(r.start) && (isValidTime(r.end) || r.end === '24:00') ? formatTimeRange(r.start, r.end) : ''
}

export function toWeeklySchedule(days: readonly BusinessHoursDay[], fallback: WeeklySchedule): WeeklySchedule {
  const week = structuredClone(fallback)
  for (const d of days) week[d.weekday] = { isOpen: d.isOpen, intervals: d.intervals.map((r) => ({ ...r })), breaks: d.breaks.map((r) => ({ ...r })) }
  return week
}

export function toBusinessHours(week: WeeklySchedule): BusinessHoursDay[] {
  return WEEKDAYS.map((weekday) => ({ weekday, ...structuredClone(week[weekday]) }))
}

/** A sensible next range after the existing ones (an hour after the last end). */
export function nextRange(existing: readonly TimeRange[], fallback: TimeRange = { start: '09:00', end: '17:00' }): TimeRange {
  const last = existing.at(-1)
  if (!last || !isValidTime(last.end)) return { ...fallback }
  const start = toMinutes(last.end)
  if (start >= 23 * 60) return { ...fallback }
  return { start: fromMinutes(start), end: fromMinutes(Math.min(start + 60, 23 * 60 + 55)) }
}

/** A short break suggestion inside the day's first interval. */
export function suggestBreak(day: DaySchedule): TimeRange {
  const first = day.intervals[0]
  if (first && isValidTime(first.start) && isValidTime(first.end)) {
    const start = toMinutes(first.start)
    const end = toMinutes(first.end)
    const mid = Math.floor((start + end) / 2 / 30) * 30
    if (mid + 30 <= end && mid > start) return { start: fromMinutes(mid), end: fromMinutes(mid + 30) }
  }
  return { start: '12:00', end: '12:30' }
}

export function sameSchedule(a: WeeklySchedule, b: WeeklySchedule): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
