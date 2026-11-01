import { z } from 'zod'
import { isValidPhone } from '@/lib/contact'
import { isValidISODate, isValidTime, toMinutes } from '@/lib/time'

export const nameField = (label = 'Name') =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters.`)
    .max(120, `${label} must be at most 120 characters.`)

export const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'))

export const optionalEmailField = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address.')

export const phoneField = z
  .string()
  .trim()
  .min(1, 'Phone number is required.')
  .refine(isValidPhone, 'Enter a valid phone number (7 to 15 digits).')

export const optionalPhoneField = z
  .string()
  .trim()
  .refine((v) => v === '' || isValidPhone(v), 'Enter a valid phone number (7 to 15 digits).')

export const isoDateField = z.string().refine(isValidISODate, 'Choose a valid date.')

export const timeField = z.string().refine((v) => isValidTime(v) || v === '24:00', 'Enter a valid time (HH:mm).')

export const notesField = (max = 1000) => z.string().trim().max(max, `Keep this under ${max} characters.`)

export const timeRangeSchema = z
  .object({ start: timeField, end: timeField })
  .refine((r) => (r.end === '24:00' ? 1440 : toMinutes(r.end)) > toMinutes(r.start), {
    message: 'End time must be after start time.',
    path: ['end'],
  })

export const timestampField = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid timestamp.')
