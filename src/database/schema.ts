/**
 * IndexedDB schema, one entry per Dexie version. Never edit a released version's stores:
 * add a new version with its own upgrade instead. See ARCHITECTURE.md §3.
 */

export const DB_NAME = 'bookease'

/** Version 1: the original layout. */
export const SCHEMA_V1 = {
  services: 'id, categoryId, isActive, name, source',
  serviceCategories: 'id, name',
  staff: 'id, isActive, fullName, *serviceIds, source',
  customers: 'id, email, fullName, phone, createdAt, source',
  appointments: 'id, &reference, customerId, serviceId, staffId, date, status, customerEmail, createdAt, source',
  businessHours: 'weekday',
  staffSchedules: 'staffId',
  blockedDates: 'id, date, staffId, scope, kind',
  notifications: 'id, createdAt, read, &dedupeKey',
  activityLogs: 'id, createdAt, entityType, entityId',
  settings: 'key',
} as const

/**
 * Version 2: compound indexes for the calendar and day views, a normalized email index on
 * customers for duplicate detection (back-filled by `migrations/v2`), and a source index on
 * special dates so sample data can be cleared.
 */
export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  customers: 'id, normalizedEmail, fullName, phone, createdAt, source',
  blockedDates: 'id, date, staffId, scope, kind, source',
  appointments:
    'id, &reference, customerId, serviceId, staffId, date, status, customerEmail, createdAt, source, [staffId+date], [date+status]',
} as const

export const CURRENT_SCHEMA_VERSION = 2

export type StoreName = keyof typeof SCHEMA_V2
export const STORE_NAMES = Object.keys(SCHEMA_V2) as StoreName[]
