import { browserTimeZone } from '@/lib/time'
import type { AppState, BusinessHoursDay, BusinessSettings, DaySchedule, Weekday, WeeklySchedule } from '@/types/models'
import { WEEKDAYS } from '@/types/models'

export function defaultBusinessSettings(): BusinessSettings {
  return {
    name: 'My Business',
    description: '',
    email: '',
    phone: '',
    address: '',
    currency: 'USD',
    timezone: browserTimeZone(),
    logoDataUrl: null,
    minNoticeMinutes: 120,
    maxAdvanceDays: 60,
    slotIntervalMinutes: 15,
    cancellationNoticeHours: 24,
    allowCustomerCancellation: true,
    allowStaffSelection: true,
    defaultStatus: 'pending',
  }
}

export function defaultAppState(): AppState {
  return { onboardingCompletedAt: null, demoSeededAt: null, lastBackupAt: null }
}

const WORKDAY: DaySchedule = {
  isOpen: true,
  intervals: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
  breaks: [],
}
const CLOSED: DaySchedule = { isOpen: false, intervals: [], breaks: [] }

/** Monday–Friday 9–12 and 13–17, weekends closed. */
export function defaultWeeklySchedule(): WeeklySchedule {
  const days = {} as WeeklySchedule
  for (const wd of WEEKDAYS) days[wd] = structuredClone(wd === 0 || wd === 6 ? CLOSED : WORKDAY)
  return days
}

export function defaultBusinessHours(): BusinessHoursDay[] {
  const week = defaultWeeklySchedule()
  return WEEKDAYS.map((weekday: Weekday) => ({ weekday, ...week[weekday] }))
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

/** Monday-first display order. */
export const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

export const STAFF_COLORS = ['teal', 'blue', 'violet', 'amber', 'rose', 'lime', 'cyan', 'orange'] as const
export type StaffColor = (typeof STAFF_COLORS)[number]
