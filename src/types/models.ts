/**
 * Shared record shapes. Every IndexedDB store, service and form uses these types.
 * See ARCHITECTURE.md §3 for the conventions (IDs, minor units, date/time strings).
 */

export type ID = string
/** Date-only value in the business calendar: `YYYY-MM-DD`. */
export type ISODate = string
/** Wall-clock time: `HH:mm`. */
export type TimeHM = string
/** UTC instant, ISO 8601. Only used for "when did this happen" fields. */
export type Timestamp = string
/** Seeded demo records are `demo`; anything the user creates is `user`. */
export type RecordSource = 'demo' | 'user'

/** 0 = Sunday … 6 = Saturday (same as `Date#getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/** Half-open interval `[start, end)`. */
export interface TimeRange {
  start: TimeHM
  end: TimeHM
}

export interface DaySchedule {
  isOpen: boolean
  intervals: TimeRange[]
  breaks: TimeRange[]
}

export type WeeklySchedule = Record<Weekday, DaySchedule>

export interface BusinessHoursDay extends DaySchedule {
  weekday: Weekday
}

export type StaffMode = 'any' | 'assigned'

export interface ServiceCategory {
  id: ID
  name: string
  createdAt: Timestamp
}

export interface Service {
  id: ID
  name: string
  description: string
  categoryId: ID
  durationMinutes: number
  bufferMinutes: number
  priceCents: number
  isActive: boolean
  /** `any`: every active staff member can perform it. `assigned`: only staff who list it. */
  staffMode: StaffMode
  source: RecordSource
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Staff {
  id: ID
  fullName: string
  email: string
  phone: string
  position: string
  description: string
  serviceIds: ID[]
  isActive: boolean
  /** Calendar accent, one of STAFF_COLORS. */
  color: string
  source: RecordSource
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface StaffSchedule {
  staffId: ID
  mode: 'business-hours' | 'custom'
  days: WeeklySchedule
}

export type BlockScope = 'business' | 'staff'
export type BlockKind = 'holiday' | 'closure' | 'special-hours' | 'leave' | 'unavailable'

export interface BlockedDate {
  id: ID
  scope: BlockScope
  staffId: ID | null
  kind: BlockKind
  /** First day, inclusive. */
  date: ISODate
  /** Last day, inclusive. Equal to `date` for a single day. */
  endDate: ISODate
  /** All-day blocks ignore `ranges`. */
  allDay: boolean
  /** Blocked ranges, or the open ranges when `kind` is `special-hours`. */
  ranges: TimeRange[]
  label: string
  source: RecordSource
  createdAt: Timestamp
}

export interface Customer {
  id: ID
  fullName: string
  email: string
  normalizedEmail: string
  phone: string
  address: string
  notes: string
  lastAppointmentDate: ISODate | null
  source: RecordSource
  createdAt: Timestamp
  updatedAt: Timestamp
}

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export type Actor = 'admin' | 'customer' | 'system'
export type BookingChannel = 'admin' | 'portal'

export interface StatusChange {
  status: AppointmentStatus
  at: Timestamp
  by: Actor
}

export interface Appointment {
  id: ID
  reference: string
  customerId: ID
  customerName: string
  customerEmail: string
  customerPhone: string
  serviceId: ID
  serviceName: string
  staffId: ID
  staffName: string
  date: ISODate
  startTime: TimeHM
  endTime: TimeHM
  durationMinutes: number
  bufferMinutes: number
  priceCents: number
  status: AppointmentStatus
  statusHistory: StatusChange[]
  customerNotes: string
  internalNotes: string
  channel: BookingChannel
  createdAt: Timestamp
  updatedAt: Timestamp
  cancelledAt: Timestamp | null
  cancelledBy: Actor | null
  cancellationReason: string
  source: RecordSource
}

export type NotificationType =
  | 'appointment-created'
  | 'appointment-confirmed'
  | 'appointment-cancelled'
  | 'appointment-rescheduled'
  | 'appointment-completed'
  | 'appointment-no-show'
  | 'upcoming'
  | 'operational'

export interface AppNotification {
  id: ID
  type: NotificationType
  title: string
  message: string
  appointmentId: ID | null
  read: 0 | 1
  /** Unique when set; prevents generating the same reminder twice. */
  dedupeKey?: string
  createdAt: Timestamp
}

export type ActivityEntity = 'appointment' | 'service' | 'staff' | 'customer' | 'availability' | 'settings' | 'data'

export interface ActivityLog {
  id: ID
  entityType: ActivityEntity
  entityId: ID | null
  action: string
  description: string
  actor: Actor
  createdAt: Timestamp
}

export type DefaultStatus = 'pending' | 'confirmed'

export interface BusinessSettings {
  name: string
  description: string
  email: string
  phone: string
  address: string
  /** ISO 4217, e.g. `USD`. */
  currency: string
  /** IANA zone, e.g. `America/New_York`. */
  timezone: string
  /** Small data-URL image stored locally, or null. */
  logoDataUrl: string | null
  minNoticeMinutes: number
  maxAdvanceDays: number
  slotIntervalMinutes: number
  cancellationNoticeHours: number
  allowCustomerCancellation: boolean
  allowStaffSelection: boolean
  defaultStatus: DefaultStatus
}

export interface AppState {
  onboardingCompletedAt: Timestamp | null
  demoSeededAt: Timestamp | null
  lastBackupAt: Timestamp | null
}

export type SettingsRecord =
  | { key: 'business'; value: BusinessSettings }
  | { key: 'app'; value: AppState }
