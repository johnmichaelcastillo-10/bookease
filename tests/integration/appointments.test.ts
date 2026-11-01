import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/database/db'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  markNoShow,
  rescheduleAppointment,
  updateAppointment,
} from '@/services/appointments/appointmentService'
import { generateSlotsFor } from '@/services/availability/availabilityService'
import { setServiceActive, updateService } from '@/services/catalog/catalogService'
import { setClock } from '@/services/clock'
import { setStaffActive } from '@/services/staff/staffService'
import { DuplicateBookingError, SchedulingError, BusinessRuleError } from '@/services/errors'
import { InvalidTransitionError } from '@/services/appointments/status'
import { resetDb, seedBasics, TODAY, TOMORROW } from '../helpers/db'

let ctx: Awaited<ReturnType<typeof seedBasics>>
const input = (overrides: Record<string, string> = {}) => ({
  customerId: ctx.customer.id,
  serviceId: ctx.consult.id,
  staffId: ctx.alice.id,
  date: TOMORROW,
  startTime: '10:00',
  customerNotes: '',
  internalNotes: '',
  ...overrides,
})

beforeEach(async () => {
  await resetDb()
  ctx = await seedBasics()
})

describe('appointment creation', () => {
  it('creates an appointment with snapshots, a reference, activity and a notification', async () => {
    const appt = await createAppointment(input())
    expect(appt.reference).toMatch(/^BE-[A-Z2-9]{6}$/)
    expect(appt).toMatchObject({
      customerName: 'Casey Customer',
      customerEmail: 'casey@example.com',
      customerPhone: '5550102030',
      serviceName: 'Consultation',
      staffName: 'Alice Adams',
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
      priceCents: 5000,
      status: 'pending',
    })
    expect(await db.activityLogs.where('entityId').equals(appt.id).count()).toBe(1)
    expect(await db.notifications.count()).toBe(1)
    expect((await db.customers.get(ctx.customer.id))?.lastAppointmentDate).toBe(TOMORROW)
  })

  it('uses the default status from settings', async () => {
    await resetDb({ defaultStatus: 'confirmed' })
    ctx = await seedBasics()
    expect((await createAppointment(input())).status).toBe('confirmed')
  })

  it('prevents overlapping appointments for the same staff member', async () => {
    await createAppointment(input())
    const other = await db.customers.add({ ...ctx.customer, id: 'c2', email: 'x@example.com', normalizedEmail: 'x@example.com' })
    await expect(createAppointment(input({ customerId: other, startTime: '10:30' }))).rejects.toBeInstanceOf(SchedulingError)
  })

  it('allows the same time with a different staff member', async () => {
    await createAppointment(input())
    const other = await db.customers.add({ ...ctx.customer, id: 'c2', email: 'x@example.com', normalizedEmail: 'x@example.com' })
    await expect(createAppointment(input({ customerId: other, staffId: ctx.bob.id }))).resolves.toBeTruthy()
  })

  it('prevents duplicate bookings for the same customer', async () => {
    await createAppointment(input())
    await expect(createAppointment(input({ staffId: ctx.bob.id }))).rejects.toBeInstanceOf(DuplicateBookingError)
  })

  it('rejects inactive services, inactive staff and unqualified staff', async () => {
    await setServiceActive(ctx.consult.id, false)
    await expect(createAppointment(input())).rejects.toMatchObject({ code: 'inactive-service' })
    await setServiceActive(ctx.consult.id, true)
    await setStaffActive(ctx.alice.id, false)
    await expect(createAppointment(input())).rejects.toMatchObject({ code: 'inactive-staff' })
    await expect(createAppointment(input({ serviceId: ctx.repair.id, staffId: ctx.bob.id }))).rejects.toMatchObject({ code: 'unqualified-staff' })
  })

  it('rejects past dates, closed days and times outside hours', async () => {
    await expect(createAppointment(input({ date: '2026-11-01' }))).rejects.toMatchObject({ reason: 'past' })
    await expect(createAppointment(input({ date: '2026-11-08' }))).rejects.toMatchObject({ reason: 'closed' })
    await expect(createAppointment(input({ startTime: '11:30' }))).rejects.toMatchObject({ reason: 'outside-hours' })
  })

  it('validates input again in the service, not only in the form', async () => {
    await expect(createAppointment(input({ startTime: '25:00' }))).rejects.toMatchObject({ code: 'validation' })
  })

  it('keeps the historical snapshot when the service is edited later', async () => {
    const appt = await createAppointment(input())
    await updateService(ctx.consult.id, {
      name: 'Consultation Plus', description: '', categoryId: ctx.category.id, durationMinutes: 90, bufferMinutes: 0, price: 99, isActive: true, staffMode: 'any',
    })
    const stored = await appointmentsRepository.get(appt.id)
    expect(stored).toMatchObject({ serviceName: 'Consultation', durationMinutes: 60, priceCents: 5000 })
  })
})

describe('status changes', () => {
  it('confirms, completes after the start time, and blocks invalid transitions', async () => {
    const appt = await createAppointment(input({ date: TODAY, startTime: '09:00' }))
    await confirmAppointment(appt.id)
    await expect(completeAppointment(appt.id)).rejects.toBeInstanceOf(BusinessRuleError) // hasn't started
    setClock(() => new Date('2026-11-02T09:30:00Z'))
    const done = await completeAppointment(appt.id)
    expect(done.status).toBe('completed')
    expect(done.statusHistory.map((h) => h.status)).toEqual(['pending', 'confirmed', 'completed'])
    await expect(cancelAppointment(appt.id)).rejects.toBeInstanceOf(InvalidTransitionError)
  })

  it('marks a confirmed appointment as no-show only after it starts', async () => {
    const appt = await createAppointment(input({ date: TODAY, startTime: '09:00' }))
    await expect(markNoShow(appt.id)).rejects.toBeInstanceOf(InvalidTransitionError) // pending → no-show not allowed
    await confirmAppointment(appt.id)
    setClock(() => new Date('2026-11-02T09:05:00Z'))
    expect((await markNoShow(appt.id)).status).toBe('no-show')
  })

  it('cancels with a reason and releases the slot', async () => {
    const appt = await createAppointment(input())
    let slots = await generateSlotsFor({ serviceId: ctx.consult.id, staffId: ctx.alice.id, date: TOMORROW, actor: 'admin' })
    expect(slots.slots.map((s) => s.start)).not.toContain('10:00')
    const cancelled = await cancelAppointment(appt.id, 'Customer called')
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelledBy: 'admin', cancellationReason: 'Customer called' })
    expect(cancelled.cancelledAt).not.toBeNull()
    slots = await generateSlotsFor({ serviceId: ctx.consult.id, staffId: ctx.alice.id, date: TOMORROW, actor: 'admin' })
    expect(slots.slots.map((s) => s.start)).toContain('10:00')
    expect((await db.customers.get(ctx.customer.id))?.lastAppointmentDate).toBeNull()
  })
})

describe('editing and rescheduling', () => {
  it('reschedules into a free time and refuses a taken one', async () => {
    const first = await createAppointment(input())
    const other = await db.customers.add({ ...ctx.customer, id: 'c2', email: 'x@example.com', normalizedEmail: 'x@example.com' })
    await createAppointment(input({ customerId: other, startTime: '14:00' }))

    await expect(rescheduleAppointment(first.id, { date: TOMORROW, startTime: '14:30', staffId: ctx.alice.id })).rejects.toMatchObject({ reason: 'conflict' })
    const moved = await rescheduleAppointment(first.id, { date: TOMORROW, startTime: '10:30', staffId: ctx.alice.id })
    expect(moved).toMatchObject({ startTime: '10:30', endTime: '11:30' }) // overlapping its own old time is fine
    expect((await db.activityLogs.toArray()).some((l) => l.action === 'appointment.rescheduled')).toBe(true)
  })

  it('edits notes on a completed appointment but not its time', async () => {
    const appt = await createAppointment(input({ date: TODAY, startTime: '09:00' }))
    await confirmAppointment(appt.id)
    setClock(() => new Date('2026-11-02T10:30:00Z'))
    await completeAppointment(appt.id)
    const edited = await updateAppointment(appt.id, input({ date: TODAY, startTime: '09:00', internalNotes: 'Paid in cash' }))
    expect(edited.internalNotes).toBe('Paid in cash')
    await expect(updateAppointment(appt.id, input({ date: TOMORROW }))).rejects.toMatchObject({ code: 'not-reschedulable' })
  })

  it('takes a new snapshot when the service changes', async () => {
    const appt = await createAppointment(input())
    const edited = await updateAppointment(appt.id, input({ serviceId: ctx.repair.id }))
    expect(edited).toMatchObject({ serviceName: 'Repair', durationMinutes: 30, bufferMinutes: 15, priceCents: 8000, endTime: '10:30' })
  })
})
