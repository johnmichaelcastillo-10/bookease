/**
 * Scheduling engine: pure functions, no I/O. `now` is always passed in so results are
 * deterministic and testable. See docs/ARCHITECTURE.md §5 for the rules.
 */
import {
  addDays,
  addMinutesToWallClock,
  compareDates,
  compareWallClock,
  diffDays,
  fromMinutes,
  isValidISODate,
  MINUTES_PER_DAY,
  rangeMinutes,
  toMinutes,
  weekdayOf,
  type WallClock,
} from '@/lib/time'
import type {
  AppointmentStatus,
  BlockedDate,
  BusinessHoursDay,
  DaySchedule,
  ID,
  ISODate,
  Service,
  Staff,
  StaffSchedule,
  TimeHM,
  TimeRange,
} from '@/types/models'
import { containedIn, intersect, normalize, subtract, type MinuteRange } from './intervals'

// ---------------------------------------------------------------------------
// Blocking appointments and conflicts
// ---------------------------------------------------------------------------

/** Statuses that occupy a staff member's time. Cancelled appointments release their slot. */
export const BLOCKING_STATUSES: readonly AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'no-show']

export function isBlockingStatus(status: AppointmentStatus): boolean {
  return BLOCKING_STATUSES.includes(status)
}

/** The subset of an appointment the engine needs. */
export interface ScheduledInterval {
  id: ID
  staffId: ID
  customerId?: ID
  date: ISODate
  startTime: TimeHM
  endTime: TimeHM
  bufferMinutes: number
  status: AppointmentStatus
}

export interface ProposedInterval {
  /** Set when re-checking an existing appointment (reschedule/edit) so it doesn't clash with itself. */
  id?: ID
  staffId: ID
  date: ISODate
  startMinutes: number
  endMinutes: number
  bufferMinutes: number
}

/**
 * Returns the first existing appointment that conflicts with the proposal, or null.
 *
 * Buffer applies after each appointment, so an appointment occupies `[start, end + buffer)`.
 * Half-open overlap rule: `newStart < existingEnd && newEnd > existingStart`.
 */
export function checkAppointmentConflict(
  proposed: ProposedInterval,
  existing: readonly ScheduledInterval[],
): ScheduledInterval | null {
  const newStart = proposed.startMinutes
  const newEnd = proposed.endMinutes + proposed.bufferMinutes
  for (const appt of existing) {
    if (appt.staffId !== proposed.staffId) continue
    if (appt.date !== proposed.date) continue
    if (proposed.id && appt.id === proposed.id) continue
    if (!isBlockingStatus(appt.status)) continue
    const existingStart = toMinutes(appt.startTime)
    const existingEnd = toMinutes(appt.endTime) + appt.bufferMinutes
    if (newStart < existingEnd && newEnd > existingStart) return appt
  }
  return null
}

/**
 * A customer can't be in two places at once: returns an existing blocking appointment of the
 * same customer that overlaps the proposal in time (any staff member, buffers ignored).
 */
export function findCustomerOverlap(
  proposal: { id?: ID; customerId: ID; date: ISODate; startMinutes: number; endMinutes: number },
  existing: readonly ScheduledInterval[],
): ScheduledInterval | null {
  for (const appt of existing) {
    if (appt.customerId !== proposal.customerId) continue
    if (appt.date !== proposal.date) continue
    if (proposal.id && appt.id === proposal.id) continue
    if (!isBlockingStatus(appt.status)) continue
    if (proposal.startMinutes < toMinutes(appt.endTime) && proposal.endMinutes > toMinutes(appt.startTime)) return appt
  }
  return null
}

// ---------------------------------------------------------------------------
// Staff eligibility
// ---------------------------------------------------------------------------

/** Staff who may perform a service: active, and either any staff or explicitly assigned. */
export function getEligibleStaff<T extends Pick<Staff, 'id' | 'isActive' | 'serviceIds'>>(
  service: Pick<Service, 'id' | 'staffMode'>,
  staff: readonly T[],
): T[] {
  return staff.filter((s) => s.isActive && (service.staffMode === 'any' || s.serviceIds.includes(service.id)))
}

export function isStaffQualified(
  service: Pick<Service, 'id' | 'staffMode'>,
  staff: Pick<Staff, 'serviceIds'>,
): boolean {
  return service.staffMode === 'any' || staff.serviceIds.includes(service.id)
}

// ---------------------------------------------------------------------------
// Working time for one date
// ---------------------------------------------------------------------------

function toRanges(ranges: readonly TimeRange[]): MinuteRange[] {
  return ranges.map(rangeMinutes)
}

function dayOpenRanges(day: DaySchedule | undefined): MinuteRange[] {
  if (!day || !day.isOpen) return []
  return subtract(toRanges(day.intervals), toRanges(day.breaks))
}

export function blockAppliesOn(block: BlockedDate, date: ISODate): boolean {
  return compareDates(block.date, date) <= 0 && compareDates(block.endDate || block.date, date) >= 0
}

export type ClosedReason = 'closed' | 'holiday'

export interface BusinessDay {
  open: MinuteRange[]
  reason?: ClosedReason
  label?: string
}

/** Opening hours of the business on a date, after special dates, breaks and closures. */
export function resolveBusinessDay(
  date: ISODate,
  businessHours: readonly BusinessHoursDay[],
  blocks: readonly BlockedDate[],
): BusinessDay {
  const todays = blocks.filter((b) => b.scope === 'business' && blockAppliesOn(b, date))

  const fullDay = todays.find((b) => b.kind !== 'special-hours' && b.allDay)
  if (fullDay) return { open: [], reason: fullDay.kind === 'holiday' ? 'holiday' : 'closed', label: fullDay.label }

  const special = todays.find((b) => b.kind === 'special-hours')
  let open: MinuteRange[]
  if (special) {
    open = normalize(toRanges(special.ranges))
  } else {
    const weekday = weekdayOf(date)
    open = dayOpenRanges(businessHours.find((d) => d.weekday === weekday))
  }

  const partial = todays.filter((b) => b.kind !== 'special-hours' && !b.allDay)
  open = subtract(open, partial.flatMap((b) => toRanges(b.ranges)))

  if (open.length === 0) return { open, reason: 'closed', label: special?.label }
  return { open }
}

/** A staff member's bookable time on a date: their schedule ∩ business hours − leave. */
export function resolveStaffDay(
  date: ISODate,
  staffId: ID,
  schedule: StaffSchedule | undefined,
  businessDay: BusinessDay,
  blocks: readonly BlockedDate[],
): MinuteRange[] {
  if (businessDay.open.length === 0) return []
  const todays = blocks.filter((b) => b.scope === 'staff' && b.staffId === staffId && blockAppliesOn(b, date))
  if (todays.some((b) => b.kind !== 'special-hours' && b.allDay)) return []

  const special = todays.find((b) => b.kind === 'special-hours')
  let base: MinuteRange[]
  if (special) base = normalize(toRanges(special.ranges))
  else if (schedule?.mode === 'custom') base = dayOpenRanges(schedule.days[weekdayOf(date)])
  else base = businessDay.open

  const partial = todays.filter((b) => b.kind !== 'special-hours' && !b.allDay)
  return subtract(intersect(base, businessDay.open), partial.flatMap((b) => toRanges(b.ranges)))
}

// ---------------------------------------------------------------------------
// Slot generation
// ---------------------------------------------------------------------------

export interface StaffAvailabilityInput {
  id: ID
  schedule?: StaffSchedule
}

export interface SlotQuery {
  date: ISODate
  durationMinutes: number
  bufferMinutes: number
  /** Eligible staff, already filtered by `getEligibleStaff`. */
  staff: readonly StaffAvailabilityInput[]
  businessHours: readonly BusinessHoursDay[]
  blocks: readonly BlockedDate[]
  /** Appointments on this date (any status; non-blocking ones are ignored). */
  appointments: readonly ScheduledInterval[]
  intervalMinutes: number
  now: WallClock
  /** Minimum lead time. Administrators pass 0. */
  minNoticeMinutes: number
  /** Furthest bookable day from today, or null for no limit (administrators). */
  maxAdvanceDays: number | null
  /** Ignore this appointment when checking conflicts (rescheduling it). */
  excludeAppointmentId?: ID
}

export interface Slot {
  start: TimeHM
  end: TimeHM
  startMinutes: number
  endMinutes: number
  /** Staff members free for this slot, in the order they were given. */
  staffIds: ID[]
}

export type DayUnavailableReason =
  | 'invalid-date'
  | 'invalid-duration'
  | 'past'
  | 'outside-window'
  | 'closed'
  | 'holiday'
  | 'no-staff'
  | 'staff-unavailable'
  | 'fully-booked'

export interface SlotResult {
  date: ISODate
  slots: Slot[]
  reason?: DayUnavailableReason
  label?: string
}

function checkWindow(query: Pick<SlotQuery, 'date' | 'now' | 'maxAdvanceDays'>): DayUnavailableReason | null {
  if (!isValidISODate(query.date)) return 'invalid-date'
  if (compareDates(query.date, query.now.date) < 0) return 'past'
  if (query.maxAdvanceDays !== null && diffDays(query.date, query.now.date) > query.maxAdvanceDays) return 'outside-window'
  return null
}

function earliestStart(query: Pick<SlotQuery, 'now' | 'minNoticeMinutes'>): WallClock {
  return addMinutesToWallClock(query.now, Math.max(0, query.minNoticeMinutes))
}

function isValidDuration(duration: number, buffer: number): boolean {
  return Number.isInteger(duration) && duration > 0 && duration <= MINUTES_PER_DAY && Number.isInteger(buffer) && buffer >= 0
}

export function generateAvailableSlots(query: SlotQuery): SlotResult {
  const { date } = query
  if (!isValidDuration(query.durationMinutes, query.bufferMinutes)) return { date, slots: [], reason: 'invalid-duration' }
  const windowReason = checkWindow(query)
  if (windowReason) return { date, slots: [], reason: windowReason }

  const businessDay = resolveBusinessDay(date, query.businessHours, query.blocks)
  if (businessDay.open.length === 0) return { date, slots: [], reason: businessDay.reason ?? 'closed', label: businessDay.label }
  if (query.staff.length === 0) return { date, slots: [], reason: 'no-staff' }

  const step = Math.max(5, Math.floor(query.intervalMinutes))
  const earliest = earliestStart(query)
  const sameDay = query.appointments.filter((a) => a.date === date && a.id !== query.excludeAppointmentId)
  const byStart = new Map<number, Slot>()
  let anyWorkingTime = false

  for (const member of query.staff) {
    const working = resolveStaffDay(date, member.id, member.schedule, businessDay, query.blocks)
    if (working.length > 0) anyWorkingTime = true
    for (const range of working) {
      for (let start = Math.ceil(range.start / step) * step; start + query.durationMinutes <= range.end; start += step) {
        if (compareWallClock({ date, minutes: start }, earliest) < 0) continue
        const end = start + query.durationMinutes
        const conflict = checkAppointmentConflict(
          { staffId: member.id, date, startMinutes: start, endMinutes: end, bufferMinutes: query.bufferMinutes },
          sameDay,
        )
        if (conflict) continue
        const slot = byStart.get(start)
        if (slot) slot.staffIds.push(member.id)
        else byStart.set(start, { start: fromMinutes(start), end: fromMinutes(end), startMinutes: start, endMinutes: end, staffIds: [member.id] })
      }
    }
  }

  const slots = [...byStart.values()].sort((a, b) => a.startMinutes - b.startMinutes)
  if (slots.length > 0) return { date, slots }
  if (!anyWorkingTime) return { date, slots, reason: 'staff-unavailable' }
  return { date, slots, reason: 'fully-booked' }
}

// ---------------------------------------------------------------------------
// Validating one proposed time (create, edit, reschedule)
// ---------------------------------------------------------------------------

export type TimeValidationReason =
  | DayUnavailableReason
  | 'too-soon'
  | 'outside-hours'
  | 'spans-midnight'
  | 'conflict'

export type TimeValidation =
  | { ok: true }
  | { ok: false; reason: TimeValidationReason; conflict?: ScheduledInterval; label?: string }

export interface TimeValidationQuery extends Omit<SlotQuery, 'staff' | 'intervalMinutes'> {
  staff: StaffAvailabilityInput
  startMinutes: number
}

/**
 * Checks a single start time for one staff member against the same rules as slot generation,
 * except alignment to the slot interval (an administrator may book 10:05).
 */
export function validateAppointmentTime(query: TimeValidationQuery): TimeValidation {
  if (!isValidDuration(query.durationMinutes, query.bufferMinutes)) return { ok: false, reason: 'invalid-duration' }
  const windowReason = checkWindow(query)
  if (windowReason) return { ok: false, reason: windowReason }

  const start = query.startMinutes
  const end = start + query.durationMinutes
  if (!Number.isInteger(start) || start < 0 || end > MINUTES_PER_DAY) return { ok: false, reason: 'spans-midnight' }

  if (compareWallClock({ date: query.date, minutes: start }, query.now) < 0) return { ok: false, reason: 'past' }
  if (compareWallClock({ date: query.date, minutes: start }, earliestStart(query)) < 0) return { ok: false, reason: 'too-soon' }

  const businessDay = resolveBusinessDay(query.date, query.businessHours, query.blocks)
  if (businessDay.open.length === 0) return { ok: false, reason: businessDay.reason ?? 'closed', label: businessDay.label }

  const working = resolveStaffDay(query.date, query.staff.id, query.staff.schedule, businessDay, query.blocks)
  if (working.length === 0) return { ok: false, reason: 'staff-unavailable' }
  if (!containedIn({ start, end }, working)) return { ok: false, reason: 'outside-hours' }

  const conflict = checkAppointmentConflict(
    { id: query.excludeAppointmentId, staffId: query.staff.id, date: query.date, startMinutes: start, endMinutes: end, bufferMinutes: query.bufferMinutes },
    query.appointments,
  )
  if (conflict) return { ok: false, reason: 'conflict', conflict }
  return { ok: true }
}

/** Dates in `[from, to]` that have at least one open business interval (for date pickers). */
export function businessOpenDates(
  from: ISODate,
  to: ISODate,
  businessHours: readonly BusinessHoursDay[],
  blocks: readonly BlockedDate[],
): Set<ISODate> {
  const open = new Set<ISODate>()
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (resolveBusinessDay(d, businessHours, blocks).open.length > 0) open.add(d)
  }
  return open
}

export const REASON_MESSAGES: Record<TimeValidationReason, string> = {
  'invalid-date': 'Choose a valid date.',
  'invalid-duration': 'The service duration is not valid.',
  past: 'That time has already passed.',
  'outside-window': 'That date is beyond the advance booking window.',
  closed: 'The business is closed on that date.',
  holiday: 'The business is closed for a holiday on that date.',
  'no-staff': 'No active staff member can perform this service.',
  'staff-unavailable': 'The staff member is not working on that date.',
  'fully-booked': 'Every time on that date is already booked.',
  'too-soon': 'That time is inside the minimum booking notice.',
  'outside-hours': 'That time falls outside working hours or during a break.',
  'spans-midnight': 'Appointments must start and end on the same day.',
  conflict: 'That time overlaps another appointment for this staff member.',
}
