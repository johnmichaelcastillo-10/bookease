/**
 * Customer portal bookings. The portal and the admin share this browser's database, so a
 * "booking" here is saved locally; nothing is transmitted anywhere.
 */
import { db } from '@/database/db'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { customersRepository } from '@/database/repositories/customersRepository'
import { getBusinessSettings } from '@/database/repositories/settingsRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { formatPhone, normalizeEmail } from '@/lib/contact'
import { normalizeReference } from '@/lib/ids'
import { toMinutes, wallClockDiffMinutes } from '@/lib/time'
import { appointmentTables, applyStatusChange, insertAppointment } from '@/services/appointments/appointmentService'
import { isReschedulable } from '@/services/appointments/status'
import { generateAvailableSlots, getEligibleStaff, validateAppointmentTime } from '@/services/availability/engine'
import { loadSchedulingContext, windowFor } from '@/services/availability/availabilityService'
import { businessNow } from '@/services/clock'
import { BusinessRuleError, NotFoundError, SchedulingError, ValidationError } from '@/services/errors'
import { insertCustomer } from '@/services/customers/customerService'
import type { Appointment, BusinessSettings, Customer, ID } from '@/types/models'
import { bookingRequestSchema, type BookingRequest } from '@/validation/schemas'

/** Static checks that don't depend on the clock or other bookings. */
export async function validateBooking(request: BookingRequest): Promise<BookingRequest> {
  const parsed = bookingRequestSchema.safeParse(request)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  const value = parsed.data
  const service = await servicesRepository.get(value.serviceId)
  if (!service) throw new NotFoundError('The service')
  if (!service.isActive) throw new BusinessRuleError('This service is no longer available for booking.', 'inactive-service')
  const settings = await getBusinessSettings()
  if (value.staffId && !settings.allowStaffSelection) {
    throw new BusinessRuleError('Choosing a staff member is turned off. Select "Any available".', 'staff-selection-off')
  }
  if (value.staffId) {
    const staff = await staffRepository.get(value.staffId)
    if (!staff || !getEligibleStaff(service, [staff]).length) {
      throw new BusinessRuleError('That staff member is not available for this service.', 'unqualified-staff')
    }
  }
  return value
}

/**
 * Chooses who takes an "any available" booking: the free eligible member with the fewest
 * appointments that day, ties broken by name. Deterministic so tests can assert it.
 */
export function pickStaffForAnyAvailable(
  candidates: { id: ID; fullName: string }[],
  sameDay: Pick<Appointment, 'staffId' | 'status'>[],
): ID | null {
  if (candidates.length === 0) return null
  const load = new Map<ID, number>()
  for (const a of sameDay) if (a.status !== 'cancelled') load.set(a.staffId, (load.get(a.staffId) ?? 0) + 1)
  return [...candidates].sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.fullName.localeCompare(b.fullName))[0]!.id
}

/**
 * Validates, recomputes availability and saves, all in one transaction. If the time was taken
 * since the customer saw it, a SchedulingError tells the UI to send them back to pick again.
 */
export async function createBooking(request: BookingRequest): Promise<Appointment> {
  const value = await validateBooking(request)

  return db.transaction('rw', appointmentTables(), async () => {
    const service = await servicesRepository.get(value.serviceId)
    if (!service || !service.isActive) throw new BusinessRuleError('This service is no longer available for booking.', 'inactive-service')

    // Recompute the customer-facing slots (window, notice, alignment, conflicts) right now.
    const ctx = await loadSchedulingContext(value.date)
    const allStaff = await staffRepository.list()
    let eligible = getEligibleStaff(service, allStaff)
    if (value.staffId) eligible = eligible.filter((s) => s.id === value.staffId)
    const sameDay = await appointmentsRepository.listByDate(value.date)
    const result = generateAvailableSlots({
      date: value.date,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      staff: eligible.map((s) => ({ id: s.id, schedule: ctx.schedules.get(s.id) })),
      businessHours: ctx.businessHours,
      blocks: ctx.blocks,
      appointments: sameDay,
      intervalMinutes: ctx.settings.slotIntervalMinutes,
      now: ctx.now,
      ...windowFor('customer', ctx.settings),
    })
    const slot = result.slots.find((s) => s.start === value.startTime)
    if (!slot) {
      if (result.reason && result.reason !== 'fully-booked') throw new SchedulingError(result.reason, undefined, result.label)
      // Explain why this particular time isn't offered (taken, too soon, off the slot grid...).
      const first = eligible[0]
      const check = first
        ? validateAppointmentTime({
            date: value.date,
            startMinutes: toMinutes(value.startTime),
            durationMinutes: service.durationMinutes,
            bufferMinutes: service.bufferMinutes,
            staff: { id: first.id, schedule: ctx.schedules.get(first.id) },
            businessHours: ctx.businessHours,
            blocks: ctx.blocks,
            appointments: sameDay,
            now: ctx.now,
            ...windowFor('customer', ctx.settings),
          })
        : null
      throw new SchedulingError(check && !check.ok ? check.reason : result.reason === 'fully-booked' ? 'conflict' : 'outside-hours')
    }
    const staffId = value.staffId ?? pickStaffForAnyAvailable(eligible.filter((s) => slot.staffIds.includes(s.id)), sameDay)
    if (!staffId) throw new SchedulingError('conflict')

    // Reuse the customer record that has this email, or create one.
    const matches = await customersRepository.findByEmail(value.email)
    const customer: Customer =
      matches.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ??
      (await insertCustomer({ fullName: value.fullName, email: value.email, phone: value.phone, address: '', notes: '' }))

    return insertAppointment(
      { customerId: customer.id, serviceId: service.id, staffId, date: value.date, startTime: value.startTime, customerNotes: value.notes, internalNotes: '' },
      customer,
      { actor: 'customer', channel: 'portal', contactSnapshot: { name: value.fullName, email: value.email, phone: value.phone } },
    )
  })
}

/** Finds a booking by reference, only if the email matches the one it was booked with. */
export async function lookupBooking(reference: string, email: string): Promise<Appointment | null> {
  const appt = await appointmentsRepository.getByReference(normalizeReference(reference))
  if (!appt || appt.customerEmail !== normalizeEmail(email)) return null
  return appt
}

export type CancellationCheck = { allowed: true } | { allowed: false; reason: string }

export function canCustomerCancel(
  appt: Pick<Appointment, 'status' | 'date' | 'startTime'>,
  settings: Pick<BusinessSettings, 'allowCustomerCancellation' | 'cancellationNoticeHours' | 'timezone' | 'phone' | 'email'>,
  now = businessNow(settings.timezone),
): CancellationCheck {
  const contact = settings.phone || settings.email ? ` Contact the business${settings.phone ? ` at ${formatPhone(settings.phone)}` : ''}${settings.email ? ` or ${settings.email}` : ''}.` : ''
  if (!isReschedulable(appt.status)) return { allowed: false, reason: `This booking is already ${appt.status === 'no-show' ? 'marked as a no-show' : appt.status}.` }
  if (!settings.allowCustomerCancellation) return { allowed: false, reason: `Online cancellation is turned off.${contact}` }
  const minutesUntil = wallClockDiffMinutes({ date: appt.date, minutes: toMinutes(appt.startTime) }, now)
  if (minutesUntil < settings.cancellationNoticeHours * 60) {
    return {
      allowed: false,
      reason: `Bookings can be cancelled online up to ${settings.cancellationNoticeHours} hour${settings.cancellationNoticeHours === 1 ? '' : 's'} before the start time.${contact}`,
    }
  }
  return { allowed: true }
}

export async function cancelBooking(reference: string, email: string, reason = ''): Promise<Appointment> {
  return db.transaction('rw', appointmentTables(), async () => {
    const appt = await lookupBooking(reference, email)
    if (!appt) throw new NotFoundError('The booking')
    const check = canCustomerCancel(appt, await getBusinessSettings())
    if (!check.allowed) throw new BusinessRuleError(check.reason, 'cancellation-not-allowed')
    return applyStatusChange(appt.id, 'cancelled', { actor: 'customer', reason })
  })
}
