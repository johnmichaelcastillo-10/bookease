import { db } from '@/database/db'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { staffRepository, staffSchedulesRepository } from '@/database/repositories/staffRepository'
import { normalizeEmail, normalizePhone } from '@/lib/contact'
import { newId } from '@/lib/ids'
import { businessNow, nowTimestamp } from '@/services/clock'
import { getBusinessSettings } from '@/database/repositories/settingsRepository'
import { NotFoundError, ValidationError } from '@/services/errors'
import { logActivity } from '@/services/events'
import { defaultWeeklySchedule, WEEKDAY_LABELS } from '@/services/settings/defaults'
import type { ID, RecordSource, Staff, StaffSchedule, Weekday } from '@/types/models'
import { WEEKDAYS } from '@/types/models'
import { dayScheduleSchema, staffInputSchema, type StaffInput } from '@/validation/schemas'

function parse(input: StaffInput): StaffInput {
  const parsed = staffInputSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  return { ...parsed.data, email: normalizeEmail(parsed.data.email), phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : '' }
}

export function createStaff(input: StaffInput, source: RecordSource = 'user'): Promise<Staff> {
  const value = parse(input)
  return db.transaction('rw', db.staff, db.staffSchedules, db.activityLogs, async () => {
    const now = nowTimestamp()
    const staff: Staff = { id: newId(), ...value, source, createdAt: now, updatedAt: now }
    await staffRepository.put(staff)
    // New staff follow business hours until a custom schedule is set.
    await staffSchedulesRepository.put({ staffId: staff.id, mode: 'business-hours', days: defaultWeeklySchedule() })
    await logActivity({ entityType: 'staff', entityId: staff.id, action: 'staff.created', description: `Added staff member ${staff.fullName}.` })
    return staff
  })
}

export function updateStaff(id: ID, input: StaffInput): Promise<Staff> {
  const value = parse(input)
  return db.transaction('rw', db.staff, db.activityLogs, async () => {
    const existing = await staffRepository.get(id)
    if (!existing) throw new NotFoundError('The staff member')
    const updated: Staff = { ...existing, ...value, updatedAt: nowTimestamp() }
    await staffRepository.put(updated)
    const notes: string[] = []
    if (existing.isActive !== updated.isActive) notes.push(updated.isActive ? 'activated' : 'deactivated')
    if (existing.serviceIds.join() !== updated.serviceIds.join()) notes.push('services reassigned')
    await logActivity({
      entityType: 'staff',
      entityId: id,
      action: 'staff.updated',
      description: `Updated staff member ${updated.fullName}${notes.length ? ` (${notes.join(', ')})` : ''}.`,
    })
    return updated
  })
}

/**
 * Deactivating keeps every past and future appointment. Future ones stay assigned (the UI
 * lists them so they can be reassigned); the staff member just can't receive new bookings.
 */
export function setStaffActive(id: ID, isActive: boolean): Promise<Staff> {
  return db.transaction('rw', db.staff, db.activityLogs, async () => {
    const existing = await staffRepository.get(id)
    if (!existing) throw new NotFoundError('The staff member')
    const updated = { ...existing, isActive, updatedAt: nowTimestamp() }
    await staffRepository.put(updated)
    await logActivity({
      entityType: 'staff',
      entityId: id,
      action: isActive ? 'staff.activated' : 'staff.deactivated',
      description: `${isActive ? 'Activated' : 'Deactivated'} staff member ${existing.fullName}.`,
    })
    return updated
  })
}

export async function getUpcomingAppointmentsForStaff(staffId: ID) {
  const settings = await getBusinessSettings()
  const today = businessNow(settings.timezone).date
  const all = await appointmentsRepository.listByStaff(staffId)
  return all
    .filter((a) => a.date >= today && (a.status === 'pending' || a.status === 'confirmed'))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
}

export async function getStaffSchedule(staffId: ID): Promise<StaffSchedule> {
  return (await staffSchedulesRepository.get(staffId)) ?? { staffId, mode: 'business-hours', days: defaultWeeklySchedule() }
}

export function updateStaffSchedule(schedule: StaffSchedule): Promise<void> {
  if (schedule.mode === 'custom') {
    for (const wd of WEEKDAYS) {
      const parsed = dayScheduleSchema.safeParse(schedule.days[wd as Weekday])
      if (!parsed.success) {
        const err = ValidationError.fromZod(parsed.error)
        throw new ValidationError(`${WEEKDAY_LABELS[wd]}: ${err.message}`, err.issues)
      }
    }
  }
  return db.transaction('rw', db.staff, db.staffSchedules, db.activityLogs, async () => {
    const member = await staffRepository.get(schedule.staffId)
    if (!member) throw new NotFoundError('The staff member')
    await staffSchedulesRepository.put(schedule)
    await logActivity({
      entityType: 'staff',
      entityId: member.id,
      action: 'staff.schedule-updated',
      description: `Updated working hours for ${member.fullName} (${schedule.mode === 'custom' ? 'custom schedule' : 'business hours'}).`,
    })
  })
}
