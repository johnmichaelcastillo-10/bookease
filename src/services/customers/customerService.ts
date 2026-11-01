import { db } from '@/database/db'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { customersRepository } from '@/database/repositories/customersRepository'
import { normalizeEmail, normalizePhone } from '@/lib/contact'
import { newId } from '@/lib/ids'
import { nowTimestamp } from '@/services/clock'
import { BusinessRuleError, DomainError, NotFoundError, ValidationError } from '@/services/errors'
import { logActivity } from '@/services/events'
import type { Appointment, Customer, ID, RecordSource } from '@/types/models'
import { customerInputSchema, type CustomerInput } from '@/validation/schemas'

/** Raised when another customer already uses the email. The UI can retry with `allowDuplicateEmail`. */
export class DuplicateCustomerError extends DomainError {
  readonly existing: Customer[]

  constructor(existing: Customer[]) {
    super(
      `A customer with this email already exists (${existing.map((c) => c.fullName).join(', ')}). Open that record, or confirm you want a separate one.`,
      'duplicate-customer',
    )
    this.name = 'DuplicateCustomerError'
    this.existing = existing
  }
}

export interface SaveCustomerOptions {
  /** Explicitly allow another record with the same email (e.g. a shared family address). */
  allowDuplicateEmail?: boolean
  source?: RecordSource
}

function parse(input: CustomerInput): CustomerInput {
  const parsed = customerInputSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  return { ...parsed.data, phone: normalizePhone(parsed.data.phone) }
}

/** Must run inside a transaction that includes customers and activityLogs. */
export async function insertCustomer(input: CustomerInput, options: SaveCustomerOptions = {}): Promise<Customer> {
  const value = parse(input)
  const duplicates = await customersRepository.findByEmail(value.email)
  if (duplicates.length > 0 && !options.allowDuplicateEmail) throw new DuplicateCustomerError(duplicates)
  const now = nowTimestamp()
  const customer: Customer = {
    id: newId(),
    ...value,
    normalizedEmail: normalizeEmail(value.email),
    lastAppointmentDate: null,
    source: options.source ?? 'user',
    createdAt: now,
    updatedAt: now,
  }
  await customersRepository.put(customer)
  await logActivity({
    entityType: 'customer',
    entityId: customer.id,
    action: 'customer.created',
    description: `Added customer ${customer.fullName}${duplicates.length > 0 ? ' (same email as an existing customer, confirmed)' : ''}.`,
  })
  return customer
}

export function createCustomer(input: CustomerInput, options: SaveCustomerOptions = {}): Promise<Customer> {
  return db.transaction('rw', db.customers, db.activityLogs, () => insertCustomer(input, options))
}

/**
 * Updates contact details. Existing appointments keep the name/email/phone they were booked
 * with (snapshots); only new bookings use the new details.
 */
export function updateCustomer(id: ID, input: CustomerInput, options: SaveCustomerOptions = {}): Promise<Customer> {
  const value = parse(input)
  return db.transaction('rw', db.customers, db.activityLogs, async () => {
    const existing = await customersRepository.get(id)
    if (!existing) throw new NotFoundError('The customer')
    const normalizedEmail = normalizeEmail(value.email)
    if (normalizedEmail !== existing.normalizedEmail) {
      const others = (await customersRepository.findByEmail(value.email)).filter((c) => c.id !== id)
      if (others.length > 0 && !options.allowDuplicateEmail) throw new DuplicateCustomerError(others)
    }
    const updated: Customer = { ...existing, ...value, normalizedEmail, updatedAt: nowTimestamp() }
    await customersRepository.put(updated)
    await logActivity({ entityType: 'customer', entityId: id, action: 'customer.updated', description: `Updated customer ${updated.fullName}.` })
    return updated
  })
}

/** Deleting is only allowed for customers with no appointments, so history is never orphaned. */
export function deleteCustomer(id: ID): Promise<void> {
  return db.transaction('rw', db.customers, db.appointments, db.activityLogs, async () => {
    const existing = await customersRepository.get(id)
    if (!existing) throw new NotFoundError('The customer')
    if ((await appointmentsRepository.countByCustomer(id)) > 0) {
      throw new BusinessRuleError(`${existing.fullName} has appointments on record, so the customer can't be deleted.`, 'customer-in-use')
    }
    await customersRepository.delete(id)
    await logActivity({ entityType: 'customer', entityId: id, action: 'customer.deleted', description: `Deleted customer ${existing.fullName}.` })
  })
}

/** Case-insensitive search across name, email and phone digits. */
export function matchesCustomer(customer: Customer, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  return (
    customer.fullName.toLowerCase().includes(q) ||
    customer.normalizedEmail.includes(q) ||
    (digits.length >= 3 && customer.phone.replace(/\D/g, '').includes(digits))
  )
}

export async function findCustomer(query: string): Promise<Customer[]> {
  const all = await customersRepository.list()
  return all.filter((c) => matchesCustomer(c, query))
}

export interface CustomerHistory {
  appointments: Appointment[]
  total: number
  completed: number
  cancelled: number
  noShows: number
  upcoming: number
  completedRevenueCents: number
}

export function summarizeCustomerAppointments(appointments: Appointment[], today: string): CustomerHistory {
  const sorted = [...appointments].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))
  return {
    appointments: sorted,
    total: sorted.length,
    completed: sorted.filter((a) => a.status === 'completed').length,
    cancelled: sorted.filter((a) => a.status === 'cancelled').length,
    noShows: sorted.filter((a) => a.status === 'no-show').length,
    upcoming: sorted.filter((a) => (a.status === 'pending' || a.status === 'confirmed') && a.date >= today).length,
    completedRevenueCents: sorted.filter((a) => a.status === 'completed').reduce((s, a) => s + a.priceCents, 0),
  }
}

export async function getCustomerHistory(id: ID, today: string): Promise<CustomerHistory> {
  return summarizeCustomerAppointments(await appointmentsRepository.listByCustomer(id), today)
}
