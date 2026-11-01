/**
 * Report calculations. Pure functions over records read from IndexedDB, so the dashboard,
 * reports page and tests all use the same numbers. Revenue definitions: ARCHITECTURE.md §8.
 */
import { format } from 'date-fns'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { customersRepository } from '@/database/repositories/customersRepository'
import {
  addDays,
  diffDays,
  eachDate,
  endOfMonth,
  isoDateToLocalDate,
  nowInTimeZone,
  startOfMonth,
  startOfWeek,
  addMonths,
} from '@/lib/time'
import type { Appointment, AppointmentStatus, Customer, ID, ISODate } from '@/types/models'
import { APPOINTMENT_STATUSES } from '@/types/models'

export interface DateRange {
  from: ISODate
  to: ISODate
}

export type StatusCounts = Record<AppointmentStatus, number>

export function emptyStatusCounts(): StatusCounts {
  return Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [s, 0])) as StatusCounts
}

export function inRange(date: ISODate, range: DateRange): boolean {
  return date >= range.from && date <= range.to
}

export function filterByRange<T extends { date: ISODate }>(rows: readonly T[], range: DateRange): T[] {
  return rows.filter((r) => inRange(r.date, range))
}

export interface AppointmentStatistics {
  total: number
  byStatus: StatusCounts
  /** Appointments on `today` that aren't cancelled. */
  today: number
  completionRate: number
  cancellationRate: number
  noShowRate: number
}

export function calculateAppointmentStatistics(appointments: readonly Appointment[], today: ISODate): AppointmentStatistics {
  const byStatus = emptyStatusCounts()
  for (const a of appointments) byStatus[a.status]++
  const total = appointments.length
  const decided = byStatus.completed + byStatus['no-show']
  return {
    total,
    byStatus,
    today: appointments.filter((a) => a.date === today && a.status !== 'cancelled').length,
    completionRate: decided === 0 ? 0 : byStatus.completed / decided,
    cancellationRate: total === 0 ? 0 : byStatus.cancelled / total,
    noShowRate: decided === 0 ? 0 : byStatus['no-show'] / decided,
  }
}

export interface RevenueSummary {
  /** Realized: completed appointments only. */
  completedCents: number
  /** Not yet realized: pending + confirmed. */
  projectedCents: number
  /** Completed + projected. */
  estimatedCents: number
  /** Value of cancelled and no-show bookings (not counted as revenue). */
  lostCents: number
  averageCompletedCents: number
}

export function calculateRevenue(appointments: readonly Appointment[]): RevenueSummary {
  let completed = 0
  let projected = 0
  let lost = 0
  let completedCount = 0
  for (const a of appointments) {
    if (a.status === 'completed') {
      completed += a.priceCents
      completedCount++
    } else if (a.status === 'pending' || a.status === 'confirmed') projected += a.priceCents
    else lost += a.priceCents
  }
  return {
    completedCents: completed,
    projectedCents: projected,
    estimatedCents: completed + projected,
    lostCents: lost,
    averageCompletedCents: completedCount === 0 ? 0 : Math.round(completed / completedCount),
  }
}

export interface BreakdownRow {
  id: ID
  name: string
  total: number
  byStatus: StatusCounts
  completedCents: number
  projectedCents: number
}

function breakdown(appointments: readonly Appointment[], key: (a: Appointment) => [ID, string]): BreakdownRow[] {
  const rows = new Map<ID, BreakdownRow>()
  for (const a of appointments) {
    const [id, name] = key(a)
    let row = rows.get(id)
    if (!row) {
      row = { id, name, total: 0, byStatus: emptyStatusCounts(), completedCents: 0, projectedCents: 0 }
      rows.set(id, row)
    }
    row.total++
    row.byStatus[a.status]++
    if (a.status === 'completed') row.completedCents += a.priceCents
    if (a.status === 'pending' || a.status === 'confirmed') row.projectedCents += a.priceCents
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

/** Grouped by the service snapshot, so renamed or deleted services still report correctly. */
export function generateServiceReport(appointments: readonly Appointment[]): BreakdownRow[] {
  return breakdown(appointments, (a) => [a.serviceId, a.serviceName])
}

export function generateStaffReport(appointments: readonly Appointment[]): BreakdownRow[] {
  return breakdown(appointments, (a) => [a.staffId, a.staffName])
}

export type Granularity = 'day' | 'week' | 'month'

export function pickGranularity(range: DateRange): Granularity {
  const days = diffDays(range.to, range.from) + 1
  if (days <= 31) return 'day'
  if (days <= 180) return 'week'
  return 'month'
}

export interface VolumePoint {
  /** First day of the bucket. */
  key: ISODate
  label: string
  total: number
  byStatus: StatusCounts
  completedCents: number
  projectedCents: number
}

function bucketKey(date: ISODate, granularity: Granularity): ISODate {
  if (granularity === 'week') return startOfWeek(date)
  if (granularity === 'month') return startOfMonth(date)
  return date
}

function bucketKeys(range: DateRange, granularity: Granularity): ISODate[] {
  if (granularity === 'day') return eachDate(range.from, range.to)
  const keys: ISODate[] = []
  if (granularity === 'week') {
    for (let d = startOfWeek(range.from); d <= range.to; d = addDays(d, 7)) keys.push(d)
  } else {
    for (let d = startOfMonth(range.from); d <= range.to; d = addMonths(d, 1)) keys.push(d)
  }
  return keys
}

function bucketLabel(key: ISODate, granularity: Granularity): string {
  const d = isoDateToLocalDate(key)
  if (granularity === 'month') return format(d, 'MMM yyyy')
  if (granularity === 'week') return `Wk of ${format(d, 'MMM d')}`
  return format(d, 'MMM d')
}

/** Appointment volume and revenue per day/week/month, with empty buckets filled in. */
export function volumeSeries(appointments: readonly Appointment[], range: DateRange, granularity = pickGranularity(range)): VolumePoint[] {
  const points = new Map<ISODate, VolumePoint>()
  for (const key of bucketKeys(range, granularity)) {
    points.set(key, { key, label: bucketLabel(key, granularity), total: 0, byStatus: emptyStatusCounts(), completedCents: 0, projectedCents: 0 })
  }
  for (const a of appointments) {
    if (!inRange(a.date, range)) continue
    const point = points.get(bucketKey(a.date, granularity))
    if (!point) continue
    point.total++
    point.byStatus[a.status]++
    if (a.status === 'completed') point.completedCents += a.priceCents
    if (a.status === 'pending' || a.status === 'confirmed') point.projectedCents += a.priceCents
  }
  return [...points.values()]
}

export interface CustomerReport {
  totalCustomers: number
  newCustomers: number
  /** Booked in the period and had an earlier non-cancelled appointment. */
  returningCustomers: number
  /** Booked in the period for the first time. */
  firstTimeCustomers: number
  activeCustomers: number
  averageAppointmentsPerActiveCustomer: number
  frequency: { label: string; customers: number }[]
  topCustomers: { id: ID; name: string; email: string; appointments: number; completed: number; completedCents: number; lastDate: ISODate }[]
}

export function generateCustomerReport(
  customers: readonly Customer[],
  allAppointments: readonly Appointment[],
  range: DateRange,
  timeZone: string,
): CustomerReport {
  const live = allAppointments.filter((a) => a.status !== 'cancelled')
  const inPeriod = filterByRange(live, range)
  const byCustomer = new Map<ID, Appointment[]>()
  for (const a of inPeriod) byCustomer.set(a.customerId, [...(byCustomer.get(a.customerId) ?? []), a])

  const firstDate = new Map<ID, ISODate>()
  for (const a of live) {
    const prev = firstDate.get(a.customerId)
    if (!prev || a.date < prev) firstDate.set(a.customerId, a.date)
  }

  let returning = 0
  let firstTime = 0
  for (const id of byCustomer.keys()) {
    if ((firstDate.get(id) ?? range.from) < range.from) returning++
    else firstTime++
  }

  const buckets = [
    { label: '1 visit', min: 1, max: 1 },
    { label: '2 visits', min: 2, max: 2 },
    { label: '3–5 visits', min: 3, max: 5 },
    { label: '6+ visits', min: 6, max: Infinity },
  ]
  const counts = [...byCustomer.values()].map((list) => list.length)
  const names = new Map(customers.map((c) => [c.id, c]))

  return {
    totalCustomers: customers.length,
    newCustomers: customers.filter((c) => inRange(nowInTimeZone(timeZone, new Date(c.createdAt)).date, range)).length,
    returningCustomers: returning,
    firstTimeCustomers: firstTime,
    activeCustomers: byCustomer.size,
    averageAppointmentsPerActiveCustomer: byCustomer.size === 0 ? 0 : inPeriod.length / byCustomer.size,
    frequency: buckets.map((b) => ({ label: b.label, customers: counts.filter((n) => n >= b.min && n <= b.max).length })),
    topCustomers: [...byCustomer.entries()]
      .map(([id, list]) => {
        const completed = list.filter((a) => a.status === 'completed')
        const latest = list.reduce((m, a) => (a.date > m.date ? a : m), list[0]!)
        return {
          id,
          name: names.get(id)?.fullName ?? latest.customerName,
          email: names.get(id)?.email ?? latest.customerEmail,
          appointments: list.length,
          completed: completed.length,
          completedCents: completed.reduce((s, a) => s + a.priceCents, 0),
          lastDate: latest.date,
        }
      })
      .sort((a, b) => b.appointments - a.appointments || b.completedCents - a.completedCents)
      .slice(0, 10),
  }
}

/** Loads what a report period needs. Customer reports also need history before the period. */
export async function loadReportData(range: DateRange) {
  const [inPeriod, all, customers] = await Promise.all([
    appointmentsRepository.listRange(range.from, range.to),
    appointmentsRepository.listAll(),
    customersRepository.list(),
  ])
  return { inPeriod, all, customers }
}

export type RangePreset = 'today' | 'week' | 'month' | 'year' | 'last30' | 'custom'

export function presetRange(preset: Exclude<RangePreset, 'custom'>, today: ISODate): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'week': {
      const from = startOfWeek(today)
      return { from, to: addDays(from, 6) }
    }
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` }
    case 'last30':
      return { from: addDays(today, -29), to: today }
  }
}
