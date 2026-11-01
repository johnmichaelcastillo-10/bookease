import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  ActivityLog,
  AppNotification,
  Appointment,
  BlockedDate,
  BusinessHoursDay,
  Customer,
  Service,
  ServiceCategory,
  SettingsRecord,
  Staff,
  StaffSchedule,
  Weekday,
} from '@/types/models'
import { upgradeToV2 } from './migrations/v2'
import { DB_NAME, SCHEMA_V1, SCHEMA_V2 } from './schema'

export class BookEaseDB extends Dexie {
  services!: EntityTable<Service, 'id'>
  serviceCategories!: EntityTable<ServiceCategory, 'id'>
  staff!: EntityTable<Staff, 'id'>
  customers!: EntityTable<Customer, 'id'>
  appointments!: EntityTable<Appointment, 'id'>
  businessHours!: Table<BusinessHoursDay, Weekday>
  staffSchedules!: Table<StaffSchedule, string>
  blockedDates!: EntityTable<BlockedDate, 'id'>
  notifications!: EntityTable<AppNotification, 'id'>
  activityLogs!: EntityTable<ActivityLog, 'id'>
  settings!: Table<SettingsRecord, SettingsRecord['key']>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores(SCHEMA_V1)
    this.version(2).stores(SCHEMA_V2).upgrade(upgradeToV2)
  }
}

export const db = new BookEaseDB()

/** Every table, for whole-database transactions (backup restore, reset). */
export function allTables(database: BookEaseDB = db) {
  return [
    database.services,
    database.serviceCategories,
    database.staff,
    database.customers,
    database.appointments,
    database.businessHours,
    database.staffSchedules,
    database.blockedDates,
    database.notifications,
    database.activityLogs,
    database.settings,
  ]
}

export class DatabaseUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      'BookEase could not open its local database. Private browsing modes and some browser settings block IndexedDB.',
    )
    this.name = 'DatabaseUnavailableError'
    this.cause = cause
  }
}

export async function openDatabase(): Promise<void> {
  try {
    if (!db.isOpen()) await db.open()
  } catch (error) {
    throw new DatabaseUnavailableError(error)
  }
}
