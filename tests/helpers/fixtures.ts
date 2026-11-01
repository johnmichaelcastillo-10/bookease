import type { ScheduledInterval, SlotQuery } from '@/services/availability/engine'
import type { BlockedDate, BusinessHoursDay, DaySchedule, StaffSchedule, Weekday } from '@/types/models'

/** 2026-11-02 is a Monday. */
export const MONDAY = '2026-11-02'
export const TUESDAY = '2026-11-03'
export const SATURDAY = '2026-11-07'
export const SUNDAY = '2026-11-08'

export const day = (intervals: [string, string][], breaks: [string, string][] = []): DaySchedule => ({
  isOpen: intervals.length > 0,
  intervals: intervals.map(([start, end]) => ({ start, end })),
  breaks: breaks.map(([start, end]) => ({ start, end })),
})

/** Mon–Fri 09:00–17:00 with a 12:00–13:00 break; weekends closed. */
export function weekHours(overrides: Partial<Record<Weekday, DaySchedule>> = {}): BusinessHoursDay[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => ({
    weekday,
    ...(overrides[weekday] ?? (weekday === 0 || weekday === 6 ? day([]) : day([['09:00', '17:00']], [['12:00', '13:00']]))),
  }))
}

export function appt(partial: Partial<ScheduledInterval> & Pick<ScheduledInterval, 'startTime' | 'endTime'>): ScheduledInterval {
  return { id: `a-${partial.startTime}-${partial.staffId ?? 's1'}`, staffId: 's1', date: MONDAY, bufferMinutes: 0, status: 'confirmed', ...partial }
}

export function block(partial: Partial<BlockedDate>): BlockedDate {
  return {
    id: `b-${Math.random()}`,
    scope: 'business',
    staffId: null,
    kind: 'closure',
    date: MONDAY,
    endDate: partial.date ?? MONDAY,
    allDay: true,
    ranges: [],
    label: 'Closed',
    source: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

export function customSchedule(staffId: string, days: Partial<Record<Weekday, DaySchedule>>): StaffSchedule {
  const all = {} as StaffSchedule['days']
  for (const wd of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) all[wd] = days[wd] ?? day([])
  return { staffId, mode: 'custom', days: all }
}

/** A query for a 60-minute service on Monday, one staff member, before anything has happened. */
export function slotQuery(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    date: MONDAY,
    durationMinutes: 60,
    bufferMinutes: 0,
    staff: [{ id: 's1' }],
    businessHours: weekHours(),
    blocks: [],
    appointments: [],
    intervalMinutes: 30,
    now: { date: '2026-11-01', minutes: 8 * 60 },
    minNoticeMinutes: 0,
    maxAdvanceDays: null,
    ...overrides,
  }
}
