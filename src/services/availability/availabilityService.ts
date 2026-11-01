/**
 * Loads scheduling inputs from IndexedDB and runs the pure engine. Also owns the business
 * hours and special-date records.
 */
import { db } from '@/database/db'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { blockedDatesRepository, businessHoursRepository } from '@/database/repositories/availabilityRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { getBusinessSettings } from '@/database/repositories/settingsRepository'
import { staffRepository, staffSchedulesRepository } from '@/database/repositories/staffRepository'
import { newId } from '@/lib/ids'
import { addDays, toMinutes, type WallClock } from '@/lib/time'
import { businessNow, nowTimestamp } from '@/services/clock'
import { NotFoundError, ValidationError } from '@/services/errors'
import { logActivity } from '@/services/events'
import { WEEKDAY_LABELS } from '@/services/settings/defaults'
import type { BlockedDate, BusinessHoursDay, BusinessSettings, ID, ISODate, Service, Staff, StaffSchedule } from '@/types/models'
import { blockedDateInputSchema, dayScheduleSchema, type BlockedDateInput } from '@/validation/schemas'
import {
  generateAvailableSlots,
  getEligibleStaff,
  resolveBusinessDay,
  validateAppointmentTime,
  type SlotResult,
  type TimeValidation,
} from './engine'

export type BookingActor = 'admin' | 'customer'

export interface SchedulingContext {
  settings: BusinessSettings
  now: WallClock
  businessHours: BusinessHoursDay[]
  blocks: BlockedDate[]
  schedules: Map<ID, StaffSchedule>
}

/** Reads everything the engine needs. Safe to call inside a transaction. */
export async function loadSchedulingContext(from: ISODate, to: ISODate = from): Promise<SchedulingContext> {
  const [settings, businessHours, blocks, schedules] = await Promise.all([
    getBusinessSettings(),
    businessHoursRepository.list(),
    blockedDatesRepository.listOverlapping(from, to),
    staffSchedulesRepository.list(),
  ])
  return {
    settings,
    now: businessNow(settings.timezone),
    businessHours,
    blocks,
    schedules: new Map(schedules.map((s) => [s.staffId, s])),
  }
}

/** Customers are held to the booking window; administrators only to "not in the past". */
export function windowFor(actor: BookingActor, settings: BusinessSettings) {
  return actor === 'customer'
    ? { minNoticeMinutes: settings.minNoticeMinutes, maxAdvanceDays: settings.maxAdvanceDays }
    : { minNoticeMinutes: 0, maxAdvanceDays: null }
}

export interface SlotRequest {
  serviceId: ID
  /** null = every eligible staff member. */
  staffId: ID | null
  date: ISODate
  actor: BookingActor
  /** When rescheduling, the appointment being moved doesn't block itself. */
  excludeAppointmentId?: ID
  /** Override duration/buffer (e.g. an appointment's own snapshot when rescheduling). */
  durationMinutes?: number
  bufferMinutes?: number
}

export async function generateSlotsFor(request: SlotRequest): Promise<SlotResult & { staff: Staff[] }> {
  const service = await servicesRepository.get(request.serviceId)
  if (!service) throw new NotFoundError('The service')
  const allStaff = await staffRepository.list()
  let eligible = getEligibleStaff(service, allStaff)
  if (request.staffId) eligible = eligible.filter((s) => s.id === request.staffId)

  const ctx = await loadSchedulingContext(request.date)
  const appointments = await appointmentsRepository.listByDate(request.date)
  const result = generateAvailableSlots({
    date: request.date,
    durationMinutes: request.durationMinutes ?? service.durationMinutes,
    bufferMinutes: request.bufferMinutes ?? service.bufferMinutes,
    staff: eligible.map((s) => ({ id: s.id, schedule: ctx.schedules.get(s.id) })),
    businessHours: ctx.businessHours,
    blocks: ctx.blocks,
    appointments,
    intervalMinutes: ctx.settings.slotIntervalMinutes,
    now: ctx.now,
    ...windowFor(request.actor, ctx.settings),
    excludeAppointmentId: request.excludeAppointmentId,
  })
  return { ...result, staff: eligible }
}

/** Alias kept for the documented service API. */
export const generateAvailableSlotsForService = generateSlotsFor

/**
 * Which dates in a range have at least one bookable slot for the service (and staff member).
 * Used to disable days in the booking date picker.
 */
export async function getBookableDates(
  serviceId: ID,
  staffId: ID | null,
  from: ISODate,
  to: ISODate,
  actor: BookingActor = 'customer',
): Promise<Map<ISODate, SlotResult>> {
  const service = await servicesRepository.get(serviceId)
  if (!service) throw new NotFoundError('The service')
  const allStaff = await staffRepository.list()
  let eligible = getEligibleStaff(service, allStaff)
  if (staffId) eligible = eligible.filter((s) => s.id === staffId)

  const ctx = await loadSchedulingContext(from, to)
  const appointments = await appointmentsRepository.listRange(from, to)
  const results = new Map<ISODate, SlotResult>()
  for (let d = from; d <= to; d = addDays(d, 1)) {
    results.set(
      d,
      generateAvailableSlots({
        date: d,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        staff: eligible.map((s) => ({ id: s.id, schedule: ctx.schedules.get(s.id) })),
        businessHours: ctx.businessHours,
        blocks: ctx.blocks,
        appointments,
        intervalMinutes: ctx.settings.slotIntervalMinutes,
        now: ctx.now,
        ...windowFor(actor, ctx.settings),
      }),
    )
  }
  return results
}

/** Staff free for a given start time, in eligibility order. */
export async function getAvailableStaff(serviceId: ID, date: ISODate, startTime: string, actor: BookingActor = 'admin'): Promise<Staff[]> {
  const result = await generateSlotsFor({ serviceId, staffId: null, date, actor })
  const slot = result.slots.find((s) => s.start === startTime)
  if (!slot) return []
  return result.staff.filter((s) => slot.staffIds.includes(s.id))
}

/** Full check of one proposed time for one staff member. Safe inside a transaction. */
export async function validateProposedTime(params: {
  service: Pick<Service, 'durationMinutes' | 'bufferMinutes'>
  staffId: ID
  date: ISODate
  startTime: string
  actor: BookingActor
  excludeAppointmentId?: ID
}): Promise<TimeValidation> {
  const ctx = await loadSchedulingContext(params.date)
  const appointments = await appointmentsRepository.listByStaffAndDate(params.staffId, params.date)
  return validateAppointmentTime({
    date: params.date,
    startMinutes: toMinutes(params.startTime),
    durationMinutes: params.service.durationMinutes,
    bufferMinutes: params.service.bufferMinutes,
    staff: { id: params.staffId, schedule: ctx.schedules.get(params.staffId) },
    businessHours: ctx.businessHours,
    blocks: ctx.blocks,
    appointments,
    now: ctx.now,
    ...windowFor(params.actor, ctx.settings),
    excludeAppointmentId: params.excludeAppointmentId,
  })
}

/** Is the business open at all on this date (ignoring staff and bookings)? */
export async function validateOperatingHours(date: ISODate): Promise<boolean> {
  const ctx = await loadSchedulingContext(date)
  return resolveBusinessDay(date, ctx.businessHours, ctx.blocks).open.length > 0
}

/** Is the staff member free and working for this time? */
export async function validateStaffAvailability(
  staffId: ID,
  service: Pick<Service, 'durationMinutes' | 'bufferMinutes'>,
  date: ISODate,
  startTime: string,
): Promise<TimeValidation> {
  return validateProposedTime({ service, staffId, date, startTime, actor: 'admin' })
}

/** Is this date inside the customer booking window? */
export async function validateBookingWindow(date: ISODate): Promise<boolean> {
  const settings = await getBusinessSettings()
  const now = businessNow(settings.timezone)
  return date >= now.date && date <= addDays(now.date, settings.maxAdvanceDays)
}

// ---------------------------------------------------------------------------
// Business hours and special dates
// ---------------------------------------------------------------------------

export async function updateBusinessHours(days: BusinessHoursDay[]): Promise<void> {
  for (const day of days) {
    const parsed = dayScheduleSchema.safeParse(day)
    if (!parsed.success) {
      const err = ValidationError.fromZod(parsed.error)
      throw new ValidationError(`${WEEKDAY_LABELS[day.weekday]}: ${err.message}`, err.issues)
    }
  }
  await db.transaction('rw', db.businessHours, db.activityLogs, async () => {
    await businessHoursRepository.putAll(days)
    await logActivity({
      entityType: 'availability',
      entityId: null,
      action: 'business-hours.updated',
      description: 'Updated business operating hours.',
    })
  })
}

export async function saveBlockedDate(input: BlockedDateInput, id?: ID): Promise<BlockedDate> {
  const parsed = blockedDateInputSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  const value = parsed.data
  return db.transaction('rw', db.blockedDates, db.staff, db.activityLogs, async () => {
    const existing = id ? await blockedDatesRepository.get(id) : undefined
    if (id && !existing) throw new NotFoundError('The special date')
    let staffName = ''
    if (value.scope === 'staff') {
      const member = value.staffId ? await staffRepository.get(value.staffId) : undefined
      if (!member) throw new NotFoundError('The staff member')
      staffName = member.fullName
    }
    const record: BlockedDate = {
      id: existing?.id ?? newId(),
      scope: value.scope,
      staffId: value.scope === 'staff' ? value.staffId : null,
      kind: value.kind,
      date: value.date,
      endDate: value.endDate,
      allDay: value.kind === 'special-hours' ? false : value.allDay,
      ranges: value.kind !== 'special-hours' && value.allDay ? [] : value.ranges,
      label: value.label,
      source: existing?.source ?? 'user',
      createdAt: existing?.createdAt ?? nowTimestamp(),
    }
    await blockedDatesRepository.put(record)
    const who = value.scope === 'staff' ? ` for ${staffName}` : ''
    const span = value.date === value.endDate ? value.date : `${value.date} to ${value.endDate}`
    await logActivity({
      entityType: 'availability',
      entityId: record.id,
      action: existing ? 'special-date.updated' : 'special-date.created',
      description: `${existing ? 'Updated' : 'Added'} "${record.label}"${who} on ${span}.`,
    })
    return record
  })
}

export async function deleteBlockedDate(id: ID): Promise<void> {
  await db.transaction('rw', db.blockedDates, db.activityLogs, async () => {
    const existing = await blockedDatesRepository.get(id)
    if (!existing) throw new NotFoundError('The special date')
    await blockedDatesRepository.delete(id)
    await logActivity({
      entityType: 'availability',
      entityId: id,
      action: 'special-date.deleted',
      description: `Removed "${existing.label}" (${existing.date}).`,
    })
  })
}
