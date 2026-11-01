import { describe, expect, it } from 'vitest'
import {
  checkAppointmentConflict,
  findCustomerOverlap,
  generateAvailableSlots,
  getEligibleStaff,
  resolveBusinessDay,
  validateAppointmentTime,
} from '@/services/availability/engine'
import { appt, block, customSchedule, day, MONDAY, SATURDAY, slotQuery, SUNDAY, TUESDAY, weekHours } from '../helpers/fixtures'

const starts = (q = slotQuery()) => generateAvailableSlots(q).slots.map((s) => s.start)

describe('checkAppointmentConflict', () => {
  const proposal = (start: number, end: number, extra = {}) => ({ staffId: 's1', date: MONDAY, startMinutes: start, endMinutes: end, bufferMinutes: 0, ...extra })
  const existing = [appt({ startTime: '10:00', endTime: '11:00' })]

  it('detects an overlap', () => {
    expect(checkAppointmentConflict(proposal(630, 690), existing)).not.toBeNull()
  })

  it('detects a proposal that contains an existing appointment', () => {
    expect(checkAppointmentConflict(proposal(570, 720), existing)).not.toBeNull()
  })

  it('allows an appointment that ends exactly when the next begins (half-open)', () => {
    expect(checkAppointmentConflict(proposal(540, 600), existing)).toBeNull()
  })

  it('allows an appointment that starts exactly when the previous ends', () => {
    expect(checkAppointmentConflict(proposal(660, 720), existing)).toBeNull()
  })

  it('ignores other staff members', () => {
    expect(checkAppointmentConflict(proposal(600, 660, { staffId: 's2' }), existing)).toBeNull()
  })

  it('ignores other dates', () => {
    expect(checkAppointmentConflict(proposal(600, 660, { date: TUESDAY }), existing)).toBeNull()
  })

  it('ignores cancelled appointments so their slot is released', () => {
    const cancelled = [appt({ startTime: '10:00', endTime: '11:00', status: 'cancelled' })]
    expect(checkAppointmentConflict(proposal(600, 660), cancelled)).toBeNull()
  })

  it('keeps completed and no-show appointments blocking', () => {
    for (const status of ['completed', 'no-show', 'pending'] as const) {
      expect(checkAppointmentConflict(proposal(600, 660), [appt({ startTime: '10:00', endTime: '11:00', status })])).not.toBeNull()
    }
  })

  it("applies the existing appointment's buffer after it", () => {
    const buffered = [appt({ startTime: '10:00', endTime: '11:00', bufferMinutes: 15 })]
    expect(checkAppointmentConflict(proposal(660, 720), buffered)).not.toBeNull()
    expect(checkAppointmentConflict(proposal(675, 735), buffered)).toBeNull()
  })

  it("applies the proposal's own buffer before the next appointment", () => {
    expect(checkAppointmentConflict(proposal(540, 600, { bufferMinutes: 10 }), existing)).not.toBeNull()
    expect(checkAppointmentConflict(proposal(530, 590, { bufferMinutes: 10 }), existing)).toBeNull()
  })

  it('does not conflict with itself when rescheduling', () => {
    const self = [appt({ id: 'x', startTime: '10:00', endTime: '11:00' })]
    expect(checkAppointmentConflict(proposal(630, 690, { id: 'x' }), self)).toBeNull()
  })
})

describe('findCustomerOverlap', () => {
  it('finds the same customer double-booked with another staff member', () => {
    const existing = [appt({ startTime: '10:00', endTime: '11:00', customerId: 'c1', staffId: 's2' })]
    expect(findCustomerOverlap({ customerId: 'c1', date: MONDAY, startMinutes: 630, endMinutes: 660 }, existing)).not.toBeNull()
    expect(findCustomerOverlap({ customerId: 'c2', date: MONDAY, startMinutes: 630, endMinutes: 660 }, existing)).toBeNull()
  })
})

describe('generateAvailableSlots: operating hours and breaks', () => {
  it('produces slots inside business hours, skipping the lunch break', () => {
    expect(starts()).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'])
  })

  it('respects service duration: a slot must end by closing time', () => {
    const s = starts(slotQuery({ durationMinutes: 90 }))
    expect(s.at(-1)).toBe('15:30')
    expect(s).not.toContain('11:00') // 11:00–12:30 would run into the break
  })

  it('returns nothing on a closed weekday', () => {
    const result = generateAvailableSlots(slotQuery({ date: SUNDAY }))
    expect(result.slots).toEqual([])
    expect(result.reason).toBe('closed')
  })

  it('supports multiple working intervals per day', () => {
    const hours = weekHours({ 6: day([['09:00', '10:00'], ['14:00', '15:00']]) })
    expect(starts(slotQuery({ date: SATURDAY, businessHours: hours }))).toEqual(['09:00', '14:00'])
  })

  it('aligns starts to the slot interval', () => {
    const q = slotQuery({ intervalMinutes: 15, durationMinutes: 30, businessHours: weekHours({ 1: day([['09:10', '10:00']]) }) })
    expect(starts(q)).toEqual(['09:15', '09:30'])
  })

  it('rejects an invalid duration', () => {
    expect(generateAvailableSlots(slotQuery({ durationMinutes: 0 })).reason).toBe('invalid-duration')
  })
})

describe('generateAvailableSlots: special dates', () => {
  it('closes the whole day for a holiday', () => {
    const result = generateAvailableSlots(slotQuery({ blocks: [block({ kind: 'holiday', label: 'New Year' })] }))
    expect(result.slots).toEqual([])
    expect(result.reason).toBe('holiday')
    expect(result.label).toBe('New Year')
  })

  it('applies multi-day closures to every day in the range', () => {
    const closure = block({ kind: 'closure', date: MONDAY, endDate: TUESDAY })
    expect(generateAvailableSlots(slotQuery({ blocks: [closure] })).slots).toEqual([])
    expect(generateAvailableSlots(slotQuery({ date: TUESDAY, blocks: [closure] })).slots).toEqual([])
  })

  it('replaces the weekly hours with special operating hours', () => {
    const special = block({ kind: 'special-hours', allDay: false, ranges: [{ start: '10:00', end: '12:00' }] })
    expect(starts(slotQuery({ blocks: [special] }))).toEqual(['10:00', '10:30', '11:00'])
  })

  it('opens a normally closed day with special hours', () => {
    const special = block({ kind: 'special-hours', date: SUNDAY, endDate: SUNDAY, allDay: false, ranges: [{ start: '10:00', end: '11:00' }] })
    expect(starts(slotQuery({ date: SUNDAY, blocks: [special] }))).toEqual(['10:00'])
  })

  it('removes a partial business closure', () => {
    const partial = block({ kind: 'unavailable', allDay: false, ranges: [{ start: '14:00', end: '17:00' }] })
    expect(starts(slotQuery({ blocks: [partial] })).at(-1)).toBe('13:00')
  })

  it('removes a staff member on leave but keeps others', () => {
    const leave = block({ scope: 'staff', staffId: 's1', kind: 'leave' })
    const result = generateAvailableSlots(slotQuery({ staff: [{ id: 's1' }, { id: 's2' }], blocks: [leave] }))
    expect(result.slots.length).toBeGreaterThan(0)
    expect(result.slots.every((s) => s.staffIds.join() === 's2')).toBe(true)
  })

  it('reports staff-unavailable when the only staff member is on leave', () => {
    const leave = block({ scope: 'staff', staffId: 's1', kind: 'leave' })
    expect(generateAvailableSlots(slotQuery({ blocks: [leave] })).reason).toBe('staff-unavailable')
  })

  it("subtracts a staff member's partial unavailability", () => {
    const training = block({ scope: 'staff', staffId: 's1', kind: 'unavailable', allDay: false, ranges: [{ start: '09:00', end: '11:00' }] })
    expect(starts(slotQuery({ blocks: [training] }))[0]).toBe('11:00')
  })
})

describe('generateAvailableSlots: staff working hours', () => {
  it('intersects a custom staff schedule with business hours', () => {
    const schedule = customSchedule('s1', { 1: day([['07:00', '11:00']]) })
    expect(starts(slotQuery({ staff: [{ id: 's1', schedule }] }))).toEqual(['09:00', '09:30', '10:00'])
  })

  it("respects a staff member's own breaks", () => {
    const schedule = customSchedule('s1', { 1: day([['09:00', '12:00']], [['10:00', '10:30']]) })
    expect(starts(slotQuery({ staff: [{ id: 's1', schedule }] }))).toEqual(['09:00', '10:30', '11:00'])
  })

  it('has no slots on a staff day off even when the business is open', () => {
    const schedule = customSchedule('s1', { 2: day([['09:00', '17:00']]) })
    expect(generateAvailableSlots(slotQuery({ staff: [{ id: 's1', schedule }] })).reason).toBe('staff-unavailable')
  })

  it('reports no-staff when nobody is eligible', () => {
    expect(generateAvailableSlots(slotQuery({ staff: [] })).reason).toBe('no-staff')
  })
})

describe('generateAvailableSlots: existing appointments', () => {
  it('removes slots that overlap an existing appointment', () => {
    const s = starts(slotQuery({ appointments: [appt({ startTime: '10:00', endTime: '11:00' })] }))
    expect(s).not.toContain('09:30')
    expect(s).not.toContain('10:00')
    expect(s).not.toContain('10:30')
    expect(s).toContain('09:00') // adjacent: ends at 10:00
    expect(s).toContain('11:00') // adjacent: starts at 11:00
  })

  it('respects buffers on both the new and the existing appointment', () => {
    const q = slotQuery({ durationMinutes: 30, bufferMinutes: 15, appointments: [appt({ startTime: '10:00', endTime: '11:00', bufferMinutes: 15 })] })
    const s = starts(q)
    expect(s).toContain('09:00') // 09:00–09:30 + 15 min buffer ends 09:45
    expect(s).not.toContain('09:30') // 09:30–10:00 + 15 min buffer runs into 10:00
    expect(s).not.toContain('11:00') // existing buffer runs to 11:15
    expect(s).toContain('11:30')
  })

  it('releases the slot of a cancelled appointment', () => {
    const s = starts(slotQuery({ appointments: [appt({ startTime: '10:00', endTime: '11:00', status: 'cancelled' })] }))
    expect(s).toContain('10:00')
  })

  it('lets another staff member take the same time', () => {
    const result = generateAvailableSlots(
      slotQuery({ staff: [{ id: 's1' }, { id: 's2' }], appointments: [appt({ startTime: '10:00', endTime: '11:00', staffId: 's1' })] }),
    )
    expect(result.slots.find((s) => s.start === '10:00')?.staffIds).toEqual(['s2'])
    expect(result.slots.find((s) => s.start === '09:00')?.staffIds).toEqual(['s1', 's2'])
  })

  it('reports fully-booked when every slot is taken', () => {
    const appointments = [appt({ startTime: '09:00', endTime: '12:00' }), appt({ startTime: '13:00', endTime: '17:00' })]
    expect(generateAvailableSlots(slotQuery({ appointments })).reason).toBe('fully-booked')
  })

  it('ignores the appointment being rescheduled', () => {
    const q = slotQuery({ appointments: [appt({ id: 'me', startTime: '10:00', endTime: '11:00' })], excludeAppointmentId: 'me' })
    expect(starts(q)).toContain('10:00')
  })
})

describe('generateAvailableSlots: booking window and past times', () => {
  it('returns nothing for a past date', () => {
    expect(generateAvailableSlots(slotQuery({ now: { date: TUESDAY, minutes: 0 } })).reason).toBe('past')
  })

  it('hides slots earlier than now today', () => {
    expect(starts(slotQuery({ now: { date: MONDAY, minutes: 10 * 60 + 5 } }))[0]).toBe('10:30')
  })

  it('applies the minimum notice', () => {
    expect(starts(slotQuery({ now: { date: MONDAY, minutes: 9 * 60 }, minNoticeMinutes: 120 }))[0]).toBe('11:00')
  })

  it('carries minimum notice across midnight', () => {
    const s = starts(slotQuery({ now: { date: '2026-11-01', minutes: 23 * 60 }, minNoticeMinutes: 11 * 60 }))
    expect(s[0]).toBe('10:00')
  })

  it('enforces the maximum advance window', () => {
    expect(generateAvailableSlots(slotQuery({ now: { date: '2026-10-01', minutes: 0 }, maxAdvanceDays: 30 })).reason).toBe('outside-window')
    expect(generateAvailableSlots(slotQuery({ now: { date: '2026-10-03', minutes: 0 }, maxAdvanceDays: 30 })).slots.length).toBeGreaterThan(0)
  })
})

describe('validateAppointmentTime', () => {
  const base = { ...slotQuery(), staff: { id: 's1' } }

  it('accepts a free time inside working hours, even off the slot grid', () => {
    expect(validateAppointmentTime({ ...base, startMinutes: 9 * 60 + 5 })).toEqual({ ok: true })
  })

  it('rejects a time during a break', () => {
    expect(validateAppointmentTime({ ...base, startMinutes: 11 * 60 + 30 })).toMatchObject({ ok: false, reason: 'outside-hours' })
  })

  it('rejects an overlapping time with the conflicting appointment', () => {
    const result = validateAppointmentTime({ ...base, startMinutes: 10 * 60 + 30, appointments: [appt({ startTime: '10:00', endTime: '11:00' })] })
    expect(result).toMatchObject({ ok: false, reason: 'conflict' })
  })

  it('rejects a past time today', () => {
    expect(validateAppointmentTime({ ...base, now: { date: MONDAY, minutes: 600 }, startMinutes: 540 })).toMatchObject({ ok: false, reason: 'past' })
  })

  it('rejects an interval that runs past midnight', () => {
    expect(validateAppointmentTime({ ...base, startMinutes: 23 * 60 + 30 })).toMatchObject({ ok: false, reason: 'spans-midnight' })
  })

  it('rejects a closed day', () => {
    expect(validateAppointmentTime({ ...base, date: SUNDAY, startMinutes: 600 })).toMatchObject({ ok: false, reason: 'closed' })
  })

  it('rejects a time inside the minimum notice', () => {
    const q = { ...base, now: { date: MONDAY, minutes: 540 }, minNoticeMinutes: 120, startMinutes: 600 }
    expect(validateAppointmentTime(q)).toMatchObject({ ok: false, reason: 'too-soon' })
  })
})

describe('getEligibleStaff', () => {
  const staff = [
    { id: 'a', isActive: true, serviceIds: ['svc'] },
    { id: 'b', isActive: true, serviceIds: [] },
    { id: 'c', isActive: false, serviceIds: ['svc'] },
  ]

  it('uses only assigned, active staff for assigned-only services', () => {
    expect(getEligibleStaff({ id: 'svc', staffMode: 'assigned' }, staff).map((s) => s.id)).toEqual(['a'])
  })

  it('uses every active staff member for any-staff services', () => {
    expect(getEligibleStaff({ id: 'svc', staffMode: 'any' }, staff).map((s) => s.id)).toEqual(['a', 'b'])
  })
})

describe('resolveBusinessDay', () => {
  it('subtracts breaks from intervals', () => {
    expect(resolveBusinessDay(MONDAY, weekHours(), []).open).toEqual([
      { start: 540, end: 720 },
      { start: 780, end: 1020 },
    ])
  })
})
