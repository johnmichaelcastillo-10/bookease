import { centsToAmount } from '@/lib/format'
import type { CsvColumn } from '@/lib/csv'
import { addDays, endOfMonth, startOfMonth, startOfWeek } from '@/lib/time'
import type { Appointment, AppointmentStatus, ID, ISODate } from '@/types/models'
import { APPOINTMENT_STATUSES } from '@/types/models'

export type RangePreset = 'upcoming' | 'today' | 'week' | 'month' | 'past' | 'all' | 'custom'

export const RANGE_LABELS: Record<RangePreset, string> = {
  upcoming: 'Upcoming',
  today: 'Today',
  week: 'This week',
  month: 'This month',
  past: 'Past',
  all: 'All dates',
  custom: 'Custom range',
}

export interface AppointmentFilters {
  q: string
  status: AppointmentStatus | 'all'
  range: RangePreset
  from: ISODate | null
  to: ISODate | null
  serviceId: ID | 'all'
  staffId: ID | 'all'
}

export const DEFAULT_FILTERS: AppointmentFilters = {
  q: '',
  status: 'all',
  range: 'upcoming',
  from: null,
  to: null,
  serviceId: 'all',
  staffId: 'all',
}

const MIN_DATE = '0000-01-01'
const MAX_DATE = '9999-12-31'

/** Inclusive date bounds for a preset, or null for "all dates". */
export function rangeBounds(filters: Pick<AppointmentFilters, 'range' | 'from' | 'to'>, today: ISODate): { from: ISODate; to: ISODate } | null {
  switch (filters.range) {
    case 'upcoming':
      return { from: today, to: MAX_DATE }
    case 'today':
      return { from: today, to: today }
    case 'week': {
      const from = startOfWeek(today)
      return { from, to: addDays(from, 6) }
    }
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'past':
      return { from: MIN_DATE, to: addDays(today, -1) }
    case 'custom':
      return { from: filters.from ?? MIN_DATE, to: filters.to ?? MAX_DATE }
    case 'all':
      return null
  }
}

/** Free-text match on reference, customer, contact details, service and staff. */
export function matchesSearch(a: Appointment, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  return (
    a.reference.toLowerCase().includes(q) ||
    a.customerName.toLowerCase().includes(q) ||
    a.customerEmail.includes(q) ||
    a.serviceName.toLowerCase().includes(q) ||
    a.staffName.toLowerCase().includes(q) ||
    (digits.length >= 3 && a.customerPhone.replace(/\D/g, '').includes(digits))
  )
}

export function applyFilters(rows: readonly Appointment[], f: AppointmentFilters): Appointment[] {
  return rows.filter(
    (a) =>
      (f.status === 'all' || a.status === f.status) &&
      (f.serviceId === 'all' || a.serviceId === f.serviceId) &&
      (f.staffId === 'all' || a.staffId === f.staffId) &&
      matchesSearch(a, f.q),
  )
}

/** Upcoming lists read soonest first; anything looking back reads newest first. */
export function defaultOrder(rows: Appointment[], range: RangePreset): Appointment[] {
  const key = (a: Appointment) => a.date + a.startTime
  const asc = range === 'upcoming' || range === 'today' || range === 'week'
  return [...rows].sort((a, b) => (asc ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a))))
}

export function filtersFromParams(params: URLSearchParams): AppointmentFilters {
  const status = params.get('status')
  const range = params.get('range')
  return {
    q: params.get('q') ?? '',
    status: status && (APPOINTMENT_STATUSES as readonly string[]).includes(status) ? (status as AppointmentStatus) : 'all',
    range: range && range in RANGE_LABELS ? (range as RangePreset) : DEFAULT_FILTERS.range,
    from: params.get('from'),
    to: params.get('to'),
    serviceId: params.get('service') ?? 'all',
    staffId: params.get('staff') ?? 'all',
  }
}

export function filtersToParams(f: AppointmentFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.status !== 'all') p.set('status', f.status)
  if (f.range !== DEFAULT_FILTERS.range) p.set('range', f.range)
  if (f.range === 'custom' && f.from) p.set('from', f.from)
  if (f.range === 'custom' && f.to) p.set('to', f.to)
  if (f.serviceId !== 'all') p.set('service', f.serviceId)
  if (f.staffId !== 'all') p.set('staff', f.staffId)
  return p
}

export function isFiltered(f: AppointmentFilters): boolean {
  return filtersToParams(f).toString() !== ''
}

export function exportColumns(currency: string): CsvColumn<Appointment>[] {
  return [
    { header: 'Reference', value: (a) => a.reference },
    { header: 'Date', value: (a) => a.date },
    { header: 'Start', value: (a) => a.startTime },
    { header: 'End', value: (a) => a.endTime },
    { header: 'Status', value: (a) => a.status },
    { header: 'Customer', value: (a) => a.customerName },
    { header: 'Email', value: (a) => a.customerEmail },
    { header: 'Phone', value: (a) => a.customerPhone },
    { header: 'Service', value: (a) => a.serviceName },
    { header: 'Staff', value: (a) => a.staffName },
    { header: 'Duration (min)', value: (a) => a.durationMinutes },
    { header: `Price (${currency})`, value: (a) => centsToAmount(a.priceCents).toFixed(2) },
    { header: 'Channel', value: (a) => a.channel },
    { header: 'Customer notes', value: (a) => a.customerNotes },
    { header: 'Internal notes', value: (a) => a.internalNotes },
    { header: 'Created', value: (a) => a.createdAt },
    { header: 'Cancelled', value: (a) => a.cancelledAt ?? '' },
    { header: 'Cancellation reason', value: (a) => a.cancellationReason },
  ]
}
