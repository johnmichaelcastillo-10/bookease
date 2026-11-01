/**
 * Full-record schemas used to validate backup files before anything is written. Stricter than
 * the TypeScript types in one way: unknown keys are stripped.
 */
import { z } from 'zod'
import { APPOINTMENT_STATUSES } from '@/types/models'
import { isoDateField, timeField, timeRangeSchema, timestampField } from './common'

const id = z.string().min(1).max(100)
const source = z.enum(['demo', 'user'])
const weekday = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)])
const daySchedule = z.object({ isOpen: z.boolean(), intervals: z.array(timeRangeSchema), breaks: z.array(timeRangeSchema) })
const status = z.enum(APPOINTMENT_STATUSES)
const actor = z.enum(['admin', 'customer', 'system'])

export const serviceRecord = z.object({
  id,
  name: z.string().min(1),
  description: z.string(),
  categoryId: id,
  durationMinutes: z.number().int().positive(),
  bufferMinutes: z.number().int().min(0),
  priceCents: z.number().int().min(0),
  isActive: z.boolean(),
  staffMode: z.enum(['any', 'assigned']),
  source,
  createdAt: timestampField,
  updatedAt: timestampField,
})

export const categoryRecord = z.object({ id, name: z.string().min(1), createdAt: timestampField })

export const staffRecord = z.object({
  id,
  fullName: z.string().min(1),
  email: z.string(),
  phone: z.string(),
  position: z.string(),
  description: z.string(),
  serviceIds: z.array(id),
  isActive: z.boolean(),
  color: z.string(),
  source,
  createdAt: timestampField,
  updatedAt: timestampField,
})

export const customerRecord = z.object({
  id,
  fullName: z.string().min(1),
  email: z.string(),
  normalizedEmail: z.string(),
  phone: z.string(),
  address: z.string(),
  notes: z.string(),
  lastAppointmentDate: isoDateField.nullable(),
  source,
  createdAt: timestampField,
  updatedAt: timestampField,
})

export const appointmentRecord = z.object({
  id,
  reference: z.string().min(3).max(20),
  customerId: id,
  customerName: z.string(),
  customerEmail: z.string(),
  customerPhone: z.string(),
  serviceId: id,
  serviceName: z.string(),
  staffId: id,
  staffName: z.string(),
  date: isoDateField,
  startTime: timeField,
  endTime: timeField,
  durationMinutes: z.number().int().positive(),
  bufferMinutes: z.number().int().min(0),
  priceCents: z.number().int().min(0),
  status,
  statusHistory: z.array(z.object({ status, at: timestampField, by: actor })),
  customerNotes: z.string(),
  internalNotes: z.string(),
  channel: z.enum(['admin', 'portal']),
  createdAt: timestampField,
  updatedAt: timestampField,
  cancelledAt: timestampField.nullable(),
  cancelledBy: actor.nullable(),
  cancellationReason: z.string(),
  source,
})

export const businessHoursRecord = daySchedule.extend({ weekday })

export const staffScheduleRecord = z.object({
  staffId: id,
  mode: z.enum(['business-hours', 'custom']),
  days: z.object({ 0: daySchedule, 1: daySchedule, 2: daySchedule, 3: daySchedule, 4: daySchedule, 5: daySchedule, 6: daySchedule }),
})

export const blockedDateRecord = z.object({
  id,
  scope: z.enum(['business', 'staff']),
  staffId: id.nullable(),
  kind: z.enum(['holiday', 'closure', 'special-hours', 'leave', 'unavailable']),
  date: isoDateField,
  endDate: isoDateField,
  allDay: z.boolean(),
  ranges: z.array(timeRangeSchema),
  label: z.string(),
  source,
  createdAt: timestampField,
})

export const notificationRecord = z.object({
  id,
  type: z.enum([
    'appointment-created',
    'appointment-confirmed',
    'appointment-cancelled',
    'appointment-rescheduled',
    'appointment-completed',
    'appointment-no-show',
    'upcoming',
    'operational',
  ]),
  title: z.string(),
  message: z.string(),
  appointmentId: id.nullable(),
  read: z.union([z.literal(0), z.literal(1)]),
  dedupeKey: z.string().optional(),
  createdAt: timestampField,
})

export const activityRecord = z.object({
  id,
  entityType: z.enum(['appointment', 'service', 'staff', 'customer', 'availability', 'settings', 'data']),
  entityId: id.nullable(),
  action: z.string(),
  description: z.string(),
  actor,
  createdAt: timestampField,
})

const businessSettingsValue = z.object({
  name: z.string(),
  description: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  currency: z.string(),
  timezone: z.string(),
  logoDataUrl: z.string().nullable(),
  minNoticeMinutes: z.number().int().min(0),
  maxAdvanceDays: z.number().int().min(1),
  slotIntervalMinutes: z.number().int().min(5),
  cancellationNoticeHours: z.number().int().min(0),
  allowCustomerCancellation: z.boolean(),
  allowStaffSelection: z.boolean(),
  defaultStatus: z.enum(['pending', 'confirmed']),
})

const appStateValue = z.object({
  onboardingCompletedAt: timestampField.nullable(),
  demoSeededAt: timestampField.nullable(),
  lastBackupAt: timestampField.nullable(),
})

export const settingsRecord = z.discriminatedUnion('key', [
  z.object({ key: z.literal('business'), value: businessSettingsValue }),
  z.object({ key: z.literal('app'), value: appStateValue }),
])
