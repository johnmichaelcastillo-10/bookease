import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/database/db'
import { putBusinessSettings, getBusinessSettings } from '@/database/repositories/settingsRepository'
import { cancelBooking, canCustomerCancel, createBooking, lookupBooking, pickStaffForAnyAvailable } from '@/services/booking/bookingService'
import { generateSlotsFor } from '@/services/availability/availabilityService'
import { createAppointment } from '@/services/appointments/appointmentService'
import { SchedulingError } from '@/services/errors'
import { setClock } from '@/services/clock'
import { resetDb, seedBasics, TOMORROW } from '../helpers/db'

let ctx: Awaited<ReturnType<typeof seedBasics>>
const request = (overrides: Record<string, unknown> = {}) => ({
  fullName: 'Dana Diaz',
  email: 'dana@example.com',
  phone: '555 010 4444',
  notes: '',
  serviceId: ctx.consult.id,
  staffId: null as string | null,
  date: TOMORROW,
  startTime: '10:00',
  ...overrides,
})

beforeEach(async () => {
  await resetDb({ minNoticeMinutes: 60, maxAdvanceDays: 30, cancellationNoticeHours: 24 })
  ctx = await seedBasics()
})

describe('customer booking', () => {
  it('creates the customer, assigns any available staff and saves the booking', async () => {
    const appt = await createBooking(request())
    expect(appt.channel).toBe('portal')
    expect(appt.status).toBe('pending')
    expect([ctx.alice.id, ctx.bob.id]).toContain(appt.staffId)
    const customers = await db.customers.where('normalizedEmail').equals('dana@example.com').toArray()
    expect(customers).toHaveLength(1)
    expect((await db.appointments.get(appt.id))?.reference).toBe(appt.reference)
  })

  it('reuses an existing customer with the same email', async () => {
    await createBooking(request({ email: 'CASEY@example.com', fullName: 'Casey C.' }))
    expect(await db.customers.count()).toBe(1)
  })

  it('spreads "any available" bookings across staff', async () => {
    const a = await createBooking(request())
    const b = await createBooking(request({ email: 'eve@example.com' }))
    expect(a.staffId).not.toBe(b.staffId)
    await expect(createBooking(request({ email: 'finn@example.com' }))).rejects.toBeInstanceOf(SchedulingError)
  })

  it('rejects a slot taken between viewing and confirming', async () => {
    await createAppointment({ customerId: ctx.customer.id, serviceId: ctx.repair.id, staffId: ctx.alice.id, date: TOMORROW, startTime: '10:00', customerNotes: '', internalNotes: '' })
    await expect(createBooking(request({ serviceId: ctx.repair.id, staffId: ctx.alice.id }))).rejects.toBeInstanceOf(SchedulingError)
  })

  it('only offers aligned slots and enforces minimum notice for customers', async () => {
    await expect(createBooking(request({ startTime: '10:05' }))).rejects.toBeInstanceOf(SchedulingError)
    // 07:00 now + 60 min notice → 08:00, but today's first slot is 09:00: fine. Use a tighter window:
    await putBusinessSettings({ ...(await getBusinessSettings()), minNoticeMinutes: 60 * 28 })
    await expect(createBooking(request())).rejects.toMatchObject({ reason: 'too-soon' })
  })

  it('enforces the advance booking window', async () => {
    await expect(createBooking(request({ date: '2026-12-15' }))).rejects.toMatchObject({ reason: 'outside-window' })
  })

  it('validates inputs before writing anything', async () => {
    await expect(createBooking(request({ email: 'not-an-email' }))).rejects.toMatchObject({ code: 'validation' })
    expect(await db.appointments.count()).toBe(0)
  })
})

describe('lookup and customer cancellation', () => {
  it('finds a booking only with the matching email', async () => {
    const appt = await createBooking(request())
    expect(await lookupBooking(appt.reference.toLowerCase(), 'DANA@example.com')).toMatchObject({ id: appt.id })
    expect(await lookupBooking(appt.reference, 'someone@example.com')).toBeNull()
  })

  it('cancels outside the notice period and releases the slot', async () => {
    const appt = await createBooking(request({ date: '2026-11-05', staffId: ctx.alice.id }))
    const cancelled = await cancelBooking(appt.reference, 'dana@example.com', 'Plans changed')
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelledBy: 'customer' })
    const slots = await generateSlotsFor({ serviceId: ctx.consult.id, staffId: ctx.alice.id, date: '2026-11-05', actor: 'customer' })
    expect(slots.slots.map((s) => s.start)).toContain('10:00')
  })

  it('refuses cancellation inside the notice period or when disabled', async () => {
    const appt = await createBooking(request())
    setClock(() => new Date('2026-11-03T08:00:00Z')) // two hours before a 24-hour notice period ends
    await expect(cancelBooking(appt.reference, 'dana@example.com')).rejects.toMatchObject({ code: 'cancellation-not-allowed' })
    const settings = await getBusinessSettings()
    expect(canCustomerCancel({ status: 'confirmed', date: '2026-11-20', startTime: '10:00' }, { ...settings, allowCustomerCancellation: false }).allowed).toBe(false)
    expect(canCustomerCancel({ status: 'completed', date: '2026-11-20', startTime: '10:00' }, settings).allowed).toBe(false)
  })
})

describe('pickStaffForAnyAvailable', () => {
  it('prefers the least busy staff member, then name', () => {
    const candidates = [{ id: 'b', fullName: 'Bea' }, { id: 'a', fullName: 'Al' }]
    expect(pickStaffForAnyAvailable(candidates, [])).toBe('a')
    expect(pickStaffForAnyAvailable(candidates, [{ staffId: 'a', status: 'confirmed' }])).toBe('b')
    expect(pickStaffForAnyAvailable(candidates, [{ staffId: 'a', status: 'cancelled' }])).toBe('a')
  })
})
