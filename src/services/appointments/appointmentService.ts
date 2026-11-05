/**
 * Appointment operations. Every write re-validates its input, recomputes availability and
 * conflicts inside one read-write transaction, and records an activity entry and a local
 * notification in that same transaction. See docs/ARCHITECTURE.md §5–6.
 */
import { db } from '@/database/db'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { customersRepository } from '@/database/repositories/customersRepository'
import { getBusinessSettings } from '@/database/repositories/settingsRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { normalizeEmail, normalizePhone } from '@/lib/contact'
import { formatISODate, formatTime } from '@/lib/format'
import { generateReference, newId } from '@/lib/ids'
import { compareWallClock, fromMinutes, toMinutes } from '@/lib/time'
import { findCustomerOverlap, isStaffQualified } from '@/services/availability/engine'
import { validateProposedTime, type BookingActor } from '@/services/availability/availabilityService'
import { businessNow, nowTimestamp } from '@/services/clock'
import { BusinessRuleError, DuplicateBookingError, NotFoundError, SchedulingError, ValidationError } from '@/services/errors'
import { logActivity, notify } from '@/services/events'
import type {
  Actor,
  Appointment,
  AppointmentStatus,
  BookingChannel,
  Customer,
  ID,
  ISODate,
  RecordSource,
  Service,
  Staff,
} from '@/types/models'
import { appointmentInputSchema, rescheduleInputSchema, type AppointmentInput, type RescheduleInput } from '@/validation/schemas'
import { assertTransition, isReschedulable, REQUIRES_STARTED, STATUS_LABELS } from './status'

/** Tables touched by appointment writes. One transaction covers all of them. */
export function appointmentTables() {
  return [
    db.appointments,
    db.customers,
    db.services,
    db.staff,
    db.staffSchedules,
    db.businessHours,
    db.blockedDates,
    db.settings,
    db.notifications,
    db.activityLogs,
  ]
}

async function uniqueReference(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const ref = generateReference()
    if (!(await appointmentsRepository.referenceExists(ref))) return ref
  }
  throw new Error('Could not generate a unique booking reference.')
}

async function requireBookableService(serviceId: ID): Promise<Service> {
  const service = await servicesRepository.get(serviceId)
  if (!service) throw new NotFoundError('The service')
  if (!service.isActive) throw new BusinessRuleError(`"${service.name}" is inactive and can't be booked.`, 'inactive-service')
  return service
}

async function requireBookableStaff(staffId: ID, service: Pick<Service, 'id' | 'name' | 'staffMode'>): Promise<Staff> {
  const staff = await staffRepository.get(staffId)
  if (!staff) throw new NotFoundError('The staff member')
  if (!staff.isActive) throw new BusinessRuleError(`${staff.fullName} is inactive and can't take new appointments.`, 'inactive-staff')
  if (!isStaffQualified(service, staff)) {
    throw new BusinessRuleError(`${staff.fullName} isn't assigned to "${service.name}".`, 'unqualified-staff')
  }
  return staff
}

async function assertSchedulable(params: {
  service: Pick<Service, 'durationMinutes' | 'bufferMinutes'>
  staffId: ID
  customerId: ID
  date: ISODate
  startTime: string
  actor: BookingActor
  excludeAppointmentId?: ID
}): Promise<void> {
  const validation = await validateProposedTime(params)
  if (!validation.ok) throw new SchedulingError(validation.reason, validation.conflict, validation.label)

  const start = toMinutes(params.startTime)
  const overlap = findCustomerOverlap(
    { id: params.excludeAppointmentId, customerId: params.customerId, date: params.date, startMinutes: start, endMinutes: start + params.service.durationMinutes },
    await appointmentsRepository.listByDate(params.date),
  )
  if (overlap) {
    throw new DuplicateBookingError(
      `This customer already has an appointment at ${formatTime(overlap.startTime)} on ${formatISODate(params.date)}.`,
    )
  }
}

/** Keeps `customer.lastAppointmentDate` in step with their non-cancelled appointments. */
export async function refreshCustomerLastAppointment(customerId: ID): Promise<void> {
  const customer = await customersRepository.get(customerId)
  if (!customer) return
  const appts = await appointmentsRepository.listByCustomer(customerId)
  const last = appts
    .filter((a) => a.status !== 'cancelled')
    .map((a) => a.date)
    .sort()
    .at(-1) ?? null
  if (customer.lastAppointmentDate !== last) await customersRepository.put({ ...customer, lastAppointmentDate: last })
}

function describe(appt: Pick<Appointment, 'serviceName' | 'customerName' | 'date' | 'startTime' | 'staffName'>): string {
  return `${appt.serviceName} for ${appt.customerName} on ${formatISODate(appt.date)} at ${formatTime(appt.startTime)} with ${appt.staffName}`
}

export interface CreateAppointmentOptions {
  actor: BookingActor
  channel: BookingChannel
  /** Defaults to the business setting. */
  status?: 'pending' | 'confirmed'
  source?: RecordSource
  /** Contact details as entered for this booking (portal). Defaults to the customer record. */
  contactSnapshot?: { name: string; email: string; phone: string }
}

/**
 * Inserts an appointment. Must run inside a transaction over `appointmentTables()`;
 * the public functions below and `bookingService` wrap it.
 */
export async function insertAppointment(
  input: AppointmentInput,
  customer: Customer,
  options: CreateAppointmentOptions,
): Promise<Appointment> {
  const service = await requireBookableService(input.serviceId)
  const staff = await requireBookableStaff(input.staffId, service)
  await assertSchedulable({ service, staffId: staff.id, customerId: customer.id, date: input.date, startTime: input.startTime, actor: options.actor })

  const settings = await getBusinessSettings()
  const now = nowTimestamp()
  const status: AppointmentStatus = options.status ?? settings.defaultStatus
  const actor: Actor = options.actor
  const contact = options.contactSnapshot ?? { name: customer.fullName, email: customer.email, phone: customer.phone }
  const startMinutes = toMinutes(input.startTime)

  const appointment: Appointment = {
    id: newId(),
    reference: await uniqueReference(),
    customerId: customer.id,
    customerName: contact.name.trim(),
    customerEmail: normalizeEmail(contact.email),
    customerPhone: normalizePhone(contact.phone),
    serviceId: service.id,
    serviceName: service.name,
    staffId: staff.id,
    staffName: staff.fullName,
    date: input.date,
    startTime: input.startTime,
    endTime: fromMinutes(startMinutes + service.durationMinutes),
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    priceCents: service.priceCents,
    status,
    statusHistory: [{ status, at: now, by: actor }],
    customerNotes: input.customerNotes,
    internalNotes: input.internalNotes,
    channel: options.channel,
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: '',
    source: options.source ?? 'user',
  }
  await appointmentsRepository.put(appointment)
  await refreshCustomerLastAppointment(customer.id)

  const via = options.channel === 'portal' ? 'Online booking' : 'Created by admin'
  await logActivity({
    entityType: 'appointment',
    entityId: appointment.id,
    action: 'appointment.created',
    description: `${via}: ${describe(appointment)} (${appointment.reference}).`,
    actor,
  })
  await notify({
    type: 'appointment-created',
    title: options.channel === 'portal' ? 'New online booking' : 'Appointment created',
    message: `${describe(appointment)}.`,
    appointmentId: appointment.id,
  })
  return appointment
}

export async function createAppointment(input: AppointmentInput, options: Partial<CreateAppointmentOptions> = {}): Promise<Appointment> {
  const parsed = appointmentInputSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  return db.transaction('rw', appointmentTables(), async () => {
    const customer = await customersRepository.get(parsed.data.customerId)
    if (!customer) throw new NotFoundError('The customer')
    return insertAppointment(parsed.data, customer, { actor: 'admin', channel: 'admin', ...options })
  })
}

/**
 * Edits an appointment. Notes can change in any status. Changing the customer, service,
 * staff, date or time is only allowed while it is pending or confirmed, and is validated
 * like a new booking (excluding the appointment itself from conflict checks).
 */
export async function updateAppointment(id: ID, input: AppointmentInput, actor: BookingActor = 'admin'): Promise<Appointment> {
  const parsed = appointmentInputSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  const next = parsed.data

  return db.transaction('rw', appointmentTables(), async () => {
    const existing = await appointmentsRepository.get(id)
    if (!existing) throw new NotFoundError('The appointment')

    const changed = {
      customer: next.customerId !== existing.customerId,
      service: next.serviceId !== existing.serviceId,
      staff: next.staffId !== existing.staffId,
      date: next.date !== existing.date,
      time: next.startTime !== existing.startTime,
    }
    const schedulingChange = Object.values(changed).some(Boolean)
    const updated: Appointment = { ...existing, customerNotes: next.customerNotes, internalNotes: next.internalNotes }

    if (schedulingChange) {
      if (!isReschedulable(existing.status)) {
        throw new BusinessRuleError(
          `A ${STATUS_LABELS[existing.status].toLowerCase()} appointment can't be moved or reassigned. Only its notes can change.`,
          'not-reschedulable',
        )
      }
      let serviceSnapshot: Pick<Service, 'id' | 'name' | 'staffMode' | 'durationMinutes' | 'bufferMinutes' | 'priceCents'>
      if (changed.service) {
        serviceSnapshot = await requireBookableService(next.serviceId)
      } else {
        const current = await servicesRepository.get(existing.serviceId)
        // Keep the historical duration, buffer and price unless the service itself changes.
        serviceSnapshot = {
          id: existing.serviceId,
          name: existing.serviceName,
          staffMode: current?.staffMode ?? 'any',
          durationMinutes: existing.durationMinutes,
          bufferMinutes: existing.bufferMinutes,
          priceCents: existing.priceCents,
        }
      }
      const staff = changed.staff || changed.service ? await requireBookableStaff(next.staffId, serviceSnapshot) : await staffRepository.get(existing.staffId)
      if (!staff) throw new NotFoundError('The staff member')
      if (!staff.isActive) {
        throw new BusinessRuleError(`${staff.fullName} is inactive and can't take this appointment. Choose another staff member.`, 'inactive-staff')
      }

      let customer: Customer | undefined
      if (changed.customer) {
        customer = await customersRepository.get(next.customerId)
        if (!customer) throw new NotFoundError('The customer')
      }

      await assertSchedulable({
        service: serviceSnapshot,
        staffId: staff.id,
        customerId: next.customerId,
        date: next.date,
        startTime: next.startTime,
        actor,
        excludeAppointmentId: existing.id,
      })

      Object.assign(updated, {
        serviceId: serviceSnapshot.id,
        serviceName: serviceSnapshot.name,
        durationMinutes: serviceSnapshot.durationMinutes,
        bufferMinutes: serviceSnapshot.bufferMinutes,
        priceCents: serviceSnapshot.priceCents,
        staffId: staff.id,
        staffName: staff.fullName,
        date: next.date,
        startTime: next.startTime,
        endTime: fromMinutes(toMinutes(next.startTime) + serviceSnapshot.durationMinutes),
      })
      if (customer) {
        Object.assign(updated, {
          customerId: customer.id,
          customerName: customer.fullName,
          customerEmail: normalizeEmail(customer.email),
          customerPhone: normalizePhone(customer.phone),
        })
      }
    } else if (next.customerNotes === existing.customerNotes && next.internalNotes === existing.internalNotes) {
      return existing
    }

    updated.updatedAt = nowTimestamp()
    await appointmentsRepository.put(updated)
    if (changed.customer) await refreshCustomerLastAppointment(existing.customerId)
    await refreshCustomerLastAppointment(updated.customerId)

    const fields = [
      changed.customer && 'customer',
      changed.service && 'service',
      changed.staff && 'staff',
      (changed.date || changed.time) && 'time',
      (next.customerNotes !== existing.customerNotes || next.internalNotes !== existing.internalNotes) && 'notes',
    ].filter(Boolean)
    await logActivity({
      entityType: 'appointment',
      entityId: id,
      action: changed.date || changed.time ? 'appointment.rescheduled' : 'appointment.updated',
      description:
        changed.date || changed.time
          ? `Rescheduled ${existing.reference} from ${formatISODate(existing.date)} ${formatTime(existing.startTime)} to ${formatISODate(updated.date)} ${formatTime(updated.startTime)}.`
          : `Updated ${fields.join(', ')} on ${existing.reference}.`,
      actor,
    })
    if (changed.date || changed.time || changed.staff) {
      await notify({
        type: 'appointment-rescheduled',
        title: 'Appointment rescheduled',
        message: `${describe(updated)}.`,
        appointmentId: id,
      })
    }
    return updated
  })
}

/** Moves an appointment to a new date/time (and optionally another staff member). */
export async function rescheduleAppointment(id: ID, input: RescheduleInput, actor: BookingActor = 'admin'): Promise<Appointment> {
  const parsed = rescheduleInputSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  const existing = await appointmentsRepository.get(id)
  if (!existing) throw new NotFoundError('The appointment')
  return updateAppointment(
    id,
    {
      customerId: existing.customerId,
      serviceId: existing.serviceId,
      staffId: parsed.data.staffId,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      customerNotes: existing.customerNotes,
      internalNotes: existing.internalNotes,
    },
    actor,
  )
}

const STATUS_EVENTS: Partial<Record<AppointmentStatus, { type: 'appointment-confirmed' | 'appointment-cancelled' | 'appointment-completed' | 'appointment-no-show'; title: string; verb: string }>> = {
  confirmed: { type: 'appointment-confirmed', title: 'Appointment confirmed', verb: 'Confirmed' },
  cancelled: { type: 'appointment-cancelled', title: 'Appointment cancelled', verb: 'Cancelled' },
  completed: { type: 'appointment-completed', title: 'Appointment completed', verb: 'Completed' },
  'no-show': { type: 'appointment-no-show', title: 'Marked as no-show', verb: 'Marked as no-show' },
}

/** True once the appointment's start time has passed in business time. */
export function hasStarted(appt: Pick<Appointment, 'date' | 'startTime'>, timeZone: string): boolean {
  return compareWallClock({ date: appt.date, minutes: toMinutes(appt.startTime) }, businessNow(timeZone)) <= 0
}

/** Applies a status change. Must run inside a transaction over `appointmentTables()`. */
export async function applyStatusChange(
  id: ID,
  to: AppointmentStatus,
  options: { actor: Actor; reason?: string },
): Promise<Appointment> {
  const existing = await appointmentsRepository.get(id)
  if (!existing) throw new NotFoundError('The appointment')
  assertTransition(existing.status, to)
  if (REQUIRES_STARTED.includes(to)) {
    const settings = await getBusinessSettings()
    if (!hasStarted(existing, settings.timezone)) {
      throw new BusinessRuleError(`An appointment can only be marked ${STATUS_LABELS[to].toLowerCase()} once it has started.`, 'not-started')
    }
  }
  const at = nowTimestamp()
  const updated: Appointment = {
    ...existing,
    status: to,
    statusHistory: [...existing.statusHistory, { status: to, at, by: options.actor }],
    updatedAt: at,
    ...(to === 'cancelled'
      ? { cancelledAt: at, cancelledBy: options.actor, cancellationReason: (options.reason ?? '').trim().slice(0, 500) }
      : {}),
  }
  await appointmentsRepository.put(updated)
  if (to === 'cancelled') await refreshCustomerLastAppointment(existing.customerId)

  const event = STATUS_EVENTS[to]!
  const by = options.actor === 'customer' ? ' by the customer' : ''
  await logActivity({
    entityType: 'appointment',
    entityId: id,
    action: `appointment.${to}`,
    description: `${event.verb} ${existing.reference}${by}: ${describe(existing)}.${updated.cancellationReason ? ` Reason: ${updated.cancellationReason}` : ''}`,
    actor: options.actor,
  })
  await notify({ type: event.type, title: event.title + (by ? by : ''), message: `${describe(existing)}.`, appointmentId: id })
  return updated
}

export function changeStatus(id: ID, to: AppointmentStatus, options: { actor?: Actor; reason?: string } = {}): Promise<Appointment> {
  return db.transaction('rw', appointmentTables(), () => applyStatusChange(id, to, { actor: options.actor ?? 'admin', reason: options.reason }))
}

export const confirmAppointment = (id: ID) => changeStatus(id, 'confirmed')
export const completeAppointment = (id: ID) => changeStatus(id, 'completed')
export const markNoShow = (id: ID) => changeStatus(id, 'no-show')
export const cancelAppointment = (id: ID, reason = '', actor: Actor = 'admin') => changeStatus(id, 'cancelled', { actor, reason })
