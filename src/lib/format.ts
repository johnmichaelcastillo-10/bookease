import { format as formatDate, formatDistanceToNow } from 'date-fns'
import { isoDateToLocalDate, toMinutes } from '@/lib/time'
import type { ISODate, TimeHM } from '@/types/models'

const moneyFormatters = new Map<string, Intl.NumberFormat>()

/** Formats minor units (cents) in a currency, e.g. 4500 → "$45.00". */
export function formatMoney(cents: number, currency = 'USD'): string {
  let fmt = moneyFormatters.get(currency)
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency })
    } catch {
      fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
    }
    moneyFormatters.set(currency, fmt)
  }
  return fmt.format(cents / 100)
}

/** Currency fraction digits (JPY has 0, USD 2). */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100)
}

/** "09:30" → "9:30 AM". */
export function formatTime(time: TimeHM): string {
  const minutes = time === '24:00' ? 24 * 60 : toMinutes(time)
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const suffix = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatTimeRange(start: TimeHM, end: TimeHM): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

/** "2026-11-01" → "Sun, Nov 1, 2026". */
export function formatISODate(date: ISODate, pattern = 'EEE, MMM d, yyyy'): string {
  return formatDate(isoDateToLocalDate(date), pattern)
}

export function formatTimestamp(ts: string, pattern = 'MMM d, yyyy, h:mm a'): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? '—' : formatDate(d, pattern)
}

export function formatRelative(ts: string): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true })
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
