/**
 * Wall-clock date and time helpers. See docs/ARCHITECTURE.md §4.
 *
 * Date-only values (`YYYY-MM-DD`) are handled with UTC arithmetic, which has no DST, so adding
 * a day always moves exactly one calendar day. Times are minutes since midnight within a date.
 */
import type { ISODate, TimeHM, TimeRange, Weekday } from '@/types/models'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export const MINUTES_PER_DAY = 24 * 60

export interface WallClock {
  date: ISODate
  /** Minutes since midnight. */
  minutes: number
}

export function isValidISODate(value: string): boolean {
  const m = DATE_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value)
}

function parseDateParts(date: ISODate): [number, number, number] {
  const m = DATE_RE.exec(date)
  if (!m) throw new Error(`Invalid date: ${date}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function utcMs(date: ISODate): number {
  const [y, m, d] = parseDateParts(date)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): ISODate {
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtcMs(utcMs(date) + days * 86_400_000)
}

export function diffDays(later: ISODate, earlier: ISODate): number {
  return Math.round((utcMs(later) - utcMs(earlier)) / 86_400_000)
}

export function weekdayOf(date: ISODate): Weekday {
  return new Date(utcMs(date)).getUTCDay() as Weekday
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Inclusive list of dates from `start` to `end`. */
export function eachDate(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

/** Monday-based start of week. */
export function startOfWeek(date: ISODate, weekStartsOn: Weekday = 1): ISODate {
  const wd = weekdayOf(date)
  const delta = (wd - weekStartsOn + 7) % 7
  return addDays(date, -delta)
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`
}

export function endOfMonth(date: ISODate): ISODate {
  const [y, m] = parseDateParts(date)
  return fromUtcMs(Date.UTC(y, m, 0))
}

export function addMonths(date: ISODate, months: number): ISODate {
  const [y, m, d] = parseDateParts(date)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return fromUtcMs(target.getTime())
}

export function startOfYear(date: ISODate): ISODate {
  return `${date.slice(0, 4)}-01-01`
}

export function endOfYear(date: ISODate): ISODate {
  return `${date.slice(0, 4)}-12-31`
}

export function toMinutes(time: TimeHM): number {
  const m = TIME_RE.exec(time)
  if (!m) throw new Error(`Invalid time: ${time}`)
  return Number(m[1]) * 60 + Number(m[2])
}

/** Accepts 0…1440; 1440 renders as `24:00` (end of day). */
export function fromMinutes(minutes: number): TimeHM {
  if (minutes < 0 || minutes > MINUTES_PER_DAY || !Number.isInteger(minutes)) {
    throw new Error(`Minutes out of range: ${minutes}`)
  }
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function rangeMinutes(range: TimeRange): { start: number; end: number } {
  return { start: toMinutes(range.start), end: range.end === '24:00' ? MINUTES_PER_DAY : toMinutes(range.end) }
}

export function compareWallClock(a: WallClock, b: WallClock): number {
  const byDate = compareDates(a.date, b.date)
  return byDate !== 0 ? byDate : a.minutes - b.minutes
}

/** Adds minutes in wall-clock terms, rolling over midnight. */
export function addMinutesToWallClock(at: WallClock, minutes: number): WallClock {
  const total = at.minutes + minutes
  const dayShift = Math.floor(total / MINUTES_PER_DAY)
  return { date: addDays(at.date, dayShift), minutes: total - dayShift * MINUTES_PER_DAY }
}

/** Minutes from `from` to `to` in wall-clock terms (negative if `to` is earlier). */
export function wallClockDiffMinutes(to: WallClock, from: WallClock): number {
  return diffDays(to.date, from.date) * MINUTES_PER_DAY + (to.minutes - from.minutes)
}

/** Current wall-clock date and time in an IANA timezone. */
export function nowInTimeZone(timeZone: string, instant: Date = new Date()): WallClock {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant)
  } catch {
    // Unknown zone: fall back to the browser's own clock.
    return localWallClock(instant)
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const hour = Number(get('hour')) % 24
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + Number(get('minute')) }
}

export function localWallClock(instant: Date = new Date()): WallClock {
  const y = instant.getFullYear()
  const m = String(instant.getMonth() + 1).padStart(2, '0')
  const d = String(instant.getDate()).padStart(2, '0')
  return { date: `${y}-${m}-${d}`, minutes: instant.getHours() * 60 + instant.getMinutes() }
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  try {
    return intl.supportedValuesOf?.('timeZone') ?? ['UTC']
  } catch {
    return ['UTC']
  }
}

/** Builds a local Date (for date-fns / display only) at noon to stay clear of DST edges. */
export function isoDateToLocalDate(date: ISODate): Date {
  const [y, m, d] = parseDateParts(date)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function localDateToISODate(date: Date): ISODate {
  return localWallClock(date).date
}
