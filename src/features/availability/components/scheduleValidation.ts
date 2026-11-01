import { WEEKDAY_ORDER } from '@/services/settings/defaults'
import type { DaySchedule, Weekday, WeeklySchedule } from '@/types/models'
import { dayScheduleSchema } from '@/validation/schemas'

export interface DayErrors {
  day?: string
  intervals: (string | undefined)[]
  breaks: (string | undefined)[]
}

/** Runs the same schema the services use, mapped to per-row messages. */
export function validateDay(day: DaySchedule): DayErrors | null {
  const result = dayScheduleSchema.safeParse(day)
  if (result.success) return null
  const errors: DayErrors = { intervals: [], breaks: [] }
  for (const issue of result.error.issues) {
    const [list, index] = issue.path
    if ((list === 'intervals' || list === 'breaks') && typeof index === 'number') {
      errors[list][index] ??= issue.message
    } else {
      errors.day ??= issue.message
    }
  }
  return errors
}

export function validateWeek(week: WeeklySchedule): Partial<Record<Weekday, DayErrors>> {
  const out: Partial<Record<Weekday, DayErrors>> = {}
  for (const wd of WEEKDAY_ORDER) {
    const e = validateDay(week[wd])
    if (e) out[wd] = e
  }
  return out
}
