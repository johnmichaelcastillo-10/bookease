import { describe, expect, it } from 'vitest'
import { isValidPhone, normalizePhone } from '@/lib/contact'
import { formatMoney, formatTime } from '@/lib/format'
import { generateReference, normalizeReference, REFERENCE_RE } from '@/lib/ids'
import {
  addDays,
  addMinutesToWallClock,
  addMonths,
  diffDays,
  endOfMonth,
  isValidISODate,
  nowInTimeZone,
  startOfWeek,
  wallClockDiffMinutes,
  weekdayOf,
} from '@/lib/time'
import { intersect, normalize, subtract } from '@/services/availability/intervals'
import { assertTransition, canTransition, InvalidTransitionError } from '@/services/appointments/status'
import { APPOINTMENT_STATUSES } from '@/types/models'

describe('date helpers', () => {
  it('adds days across month, year and DST boundaries without drifting', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    // US DST ends 2026-11-01 and starts 2026-03-08: still exactly one calendar day.
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
  })

  it('computes weekdays and week starts', () => {
    expect(weekdayOf('2026-11-01')).toBe(0)
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26')
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02')
  })

  it('validates real calendar dates', () => {
    expect(isValidISODate('2028-02-29')).toBe(true)
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2026-13-01')).toBe(false)
  })

  it('handles month arithmetic', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(diffDays('2026-03-01', '2026-02-01')).toBe(28)
  })

  it('does wall-clock minute arithmetic across midnight', () => {
    expect(addMinutesToWallClock({ date: '2026-11-01', minutes: 23 * 60 + 30 }, 45)).toEqual({ date: '2026-11-02', minutes: 15 })
    expect(wallClockDiffMinutes({ date: '2026-11-02', minutes: 60 }, { date: '2026-11-01', minutes: 23 * 60 })).toBe(120)
  })

  it('reads the wall clock of a timezone from an instant', () => {
    const instant = new Date('2026-07-01T12:00:00Z')
    expect(nowInTimeZone('UTC', instant)).toEqual({ date: '2026-07-01', minutes: 720 })
    expect(nowInTimeZone('Asia/Manila', instant)).toEqual({ date: '2026-07-01', minutes: 20 * 60 })
    expect(nowInTimeZone('America/Los_Angeles', instant)).toEqual({ date: '2026-07-01', minutes: 5 * 60 })
  })
})

describe('interval set operations', () => {
  it('normalizes overlapping and touching ranges', () => {
    expect(normalize([{ start: 10, end: 20 }, { start: 0, end: 10 }, { start: 15, end: 30 }])).toEqual([{ start: 0, end: 30 }])
  })
  it('subtracts and intersects', () => {
    expect(subtract([{ start: 0, end: 100 }], [{ start: 20, end: 30 }])).toEqual([{ start: 0, end: 20 }, { start: 30, end: 100 }])
    expect(intersect([{ start: 0, end: 50 }], [{ start: 40, end: 60 }])).toEqual([{ start: 40, end: 50 }])
  })
})

describe('status transitions', () => {
  it('allows the documented transitions', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true)
    expect(canTransition('pending', 'cancelled')).toBe(true)
    expect(canTransition('confirmed', 'completed')).toBe(true)
    expect(canTransition('confirmed', 'cancelled')).toBe(true)
    expect(canTransition('confirmed', 'no-show')).toBe(true)
  })

  it('rejects everything else', () => {
    expect(canTransition('pending', 'completed')).toBe(false)
    expect(canTransition('pending', 'no-show')).toBe(false)
    for (const terminal of ['completed', 'cancelled', 'no-show'] as const) {
      for (const to of APPOINTMENT_STATUSES) expect(canTransition(terminal, to)).toBe(false)
    }
    expect(() => assertTransition('cancelled', 'confirmed')).toThrow(InvalidTransitionError)
  })
})

describe('references, contacts, formatting', () => {
  it('generates readable references and normalizes typed input', () => {
    const ref = generateReference()
    expect(ref).toMatch(REFERENCE_RE)
    expect(normalizeReference(' be-7k4m9q ')).toBe('BE-7K4M9Q')
    expect(normalizeReference('7K4M9Q')).toBe('BE-7K4M9Q')
    expect(normalizeReference('BE7K4M9Q')).toBe('BE-7K4M9Q')
  })

  it('normalizes and validates phone numbers', () => {
    expect(normalizePhone('(555) 010-2030')).toBe('5550102030')
    expect(normalizePhone('+1 555 010 2030')).toBe('+15550102030')
    expect(isValidPhone('555-0102')).toBe(true)
    expect(isValidPhone('12345')).toBe(false)
    expect(isValidPhone('call me')).toBe(false)
  })

  it('formats money from cents and times in 12-hour form', () => {
    expect(formatMoney(4550, 'USD')).toContain('45.50')
    expect(formatTime('00:00')).toBe('12:00 AM')
    expect(formatTime('13:05')).toBe('1:05 PM')
  })
})
