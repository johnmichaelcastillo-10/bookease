/**
 * Form and service-input schemas. Forms use them through `zodResolver`, and services parse the
 * same schemas again before writing, so validation never depends on the UI.
 */
import { z } from 'zod'
import { rangeMinutes } from '@/lib/time'
import { normalize, type MinuteRange } from '@/services/availability/intervals'
import {
  emailField,
  isoDateField,
  nameField,
  notesField,
  optionalEmailField,
  optionalPhoneField,
  phoneField,
  timeField,
  timeRangeSchema,
} from './common'

export const customerInputSchema = z.object({
  fullName: nameField('Full name'),
  email: emailField,
  phone: phoneField,
  address: z.string().trim().max(300, 'Keep the address under 300 characters.'),
  notes: notesField(),
})
export type CustomerInput = z.infer<typeof customerInputSchema>

export const serviceInputSchema = z.object({
  name: nameField('Service name'),
  description: z.string().trim().max(600, 'Keep the description under 600 characters.'),
  categoryId: z.string().min(1, 'Choose a category.'),
  durationMinutes: z
    .number({ error: 'Enter a duration in minutes.' })
    .int('Use whole minutes.')
    .min(5, 'Duration must be at least 5 minutes.')
    .max(720, 'Duration must be 12 hours or less.'),
  bufferMinutes: z
    .number({ error: 'Enter a buffer in minutes.' })
    .int('Use whole minutes.')
    .min(0, 'Buffer cannot be negative.')
    .max(240, 'Buffer must be 4 hours or less.'),
  /** Major units in the form (e.g. 45.5); stored as cents. */
  price: z.number({ error: 'Enter a price.' }).min(0, 'Price cannot be negative.').max(1_000_000, 'Price is too large.'),
  isActive: z.boolean(),
  staffMode: z.enum(['any', 'assigned']),
})
export type ServiceInput = z.infer<typeof serviceInputSchema>

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters.').max(60, 'Keep it under 60 characters.'),
})

export const staffInputSchema = z.object({
  fullName: nameField('Full name'),
  email: optionalEmailField,
  phone: optionalPhoneField,
  position: z.string().trim().max(80, 'Keep the position under 80 characters.'),
  description: z.string().trim().max(600, 'Keep the description under 600 characters.'),
  serviceIds: z.array(z.string()),
  isActive: z.boolean(),
  color: z.string().min(1),
})
export type StaffInput = z.infer<typeof staffInputSchema>

export const appointmentInputSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer.'),
  serviceId: z.string().min(1, 'Choose a service.'),
  staffId: z.string().min(1, 'Choose a staff member.'),
  date: isoDateField,
  startTime: timeField,
  customerNotes: notesField(),
  internalNotes: notesField(),
})
export type AppointmentInput = z.infer<typeof appointmentInputSchema>

export const rescheduleInputSchema = z.object({
  date: isoDateField,
  startTime: timeField,
  staffId: z.string().min(1, 'Choose a staff member.'),
})
export type RescheduleInput = z.infer<typeof rescheduleInputSchema>

export const bookingDetailsSchema = z.object({
  fullName: nameField('Full name'),
  email: emailField,
  phone: phoneField,
  notes: notesField(500),
})
export type BookingDetails = z.infer<typeof bookingDetailsSchema>

export const bookingRequestSchema = bookingDetailsSchema.extend({
  serviceId: z.string().min(1),
  /** null = any available staff member. */
  staffId: z.string().min(1).nullable(),
  date: isoDateField,
  startTime: timeField,
})
export type BookingRequest = z.infer<typeof bookingRequestSchema>

export const lookupSchema = z.object({
  reference: z.string().trim().min(6, 'Enter your booking reference.'),
  email: emailField,
})

function noOverlap(ranges: { start: string; end: string }[]): boolean {
  const mins: MinuteRange[] = ranges.map(rangeMinutes)
  const total = mins.reduce((sum, r) => sum + (r.end - r.start), 0)
  const merged = normalize(mins).reduce((sum, r) => sum + (r.end - r.start), 0)
  return total === merged
}

export const dayScheduleSchema = z
  .object({
    isOpen: z.boolean(),
    intervals: z.array(timeRangeSchema).max(6),
    breaks: z.array(timeRangeSchema).max(6),
  })
  .refine((d) => !d.isOpen || d.intervals.length > 0, { message: 'Add at least one working interval.', path: ['intervals'] })
  .refine((d) => noOverlap(d.intervals), { message: 'Working intervals overlap.', path: ['intervals'] })

export const blockedDateInputSchema = z
  .object({
    scope: z.enum(['business', 'staff']),
    staffId: z.string().nullable(),
    kind: z.enum(['holiday', 'closure', 'special-hours', 'leave', 'unavailable']),
    date: isoDateField,
    endDate: isoDateField,
    allDay: z.boolean(),
    ranges: z.array(timeRangeSchema).max(6),
    label: z.string().trim().min(2, 'Add a short label.').max(80, 'Keep the label under 80 characters.'),
  })
  .refine((b) => b.endDate >= b.date, { message: 'End date must be on or after the start date.', path: ['endDate'] })
  .refine((b) => b.scope === 'business' || !!b.staffId, { message: 'Choose a staff member.', path: ['staffId'] })
  .refine((b) => b.kind !== 'special-hours' || b.ranges.length > 0, {
    message: 'Add the opening hours for this date.',
    path: ['ranges'],
  })
  .refine((b) => b.kind === 'special-hours' || b.allDay || b.ranges.length > 0, {
    message: 'Add the unavailable time, or mark it all day.',
    path: ['ranges'],
  })
export type BlockedDateInput = z.infer<typeof blockedDateInputSchema>

export const generalSettingsSchema = z.object({
  name: nameField('Business name'),
  description: z.string().trim().max(400, 'Keep the description under 400 characters.'),
  email: optionalEmailField,
  phone: optionalPhoneField,
  address: z.string().trim().max(300, 'Keep the address under 300 characters.'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Choose a currency.'),
  timezone: z.string().min(1, 'Choose a timezone.'),
})
export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>

export const bookingSettingsSchema = z.object({
  minNoticeMinutes: z.number().int().min(0, 'Cannot be negative.').max(60 * 24 * 14, 'At most 14 days.'),
  maxAdvanceDays: z.number().int().min(1, 'At least 1 day.').max(730, 'At most 2 years.'),
  slotIntervalMinutes: z.number().int().min(5, 'At least 5 minutes.').max(240, 'At most 4 hours.'),
  cancellationNoticeHours: z.number().int().min(0, 'Cannot be negative.').max(24 * 30, 'At most 30 days.'),
  allowCustomerCancellation: z.boolean(),
  allowStaffSelection: z.boolean(),
  defaultStatus: z.enum(['pending', 'confirmed']),
})
export type BookingSettingsInput = z.infer<typeof bookingSettingsSchema>

export { emailField, timeField, isoDateField }
