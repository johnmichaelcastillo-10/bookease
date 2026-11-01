/** Builds downloadable booking files (.ics and .txt) entirely in the browser. */
import { formatPhone } from '@/lib/contact'
import { formatDuration, formatISODate, formatMoney, formatTimeRange } from '@/lib/format'
import { STATUS_LABELS } from '@/services/appointments/status'
import type { Appointment, BusinessSettings } from '@/types/models'

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Folds content lines longer than 75 octets (continuation lines start with a space). */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let currentBytes = 0
  for (const ch of line) {
    const bytes = encoder.encode(ch).length
    const limit = parts.length === 0 ? 75 : 74 // continuation lines lose one octet to the leading space
    if (currentBytes + bytes > limit) {
      parts.push(current)
      current = ''
      currentBytes = 0
    }
    current += ch
    currentBytes += bytes
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** `2026-11-03` + `10:30` → `20261103T103000` (local, no Z). */
export function icsLocalDateTime(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
}

function icsUtcStamp(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function buildIcs(appt: Appointment, settings: BusinessSettings, now: Date = new Date()): string {
  const tz = settings.timezone
  const description = [
    `Booking reference: ${appt.reference}`,
    `Service: ${appt.serviceName} (${formatDuration(appt.durationMinutes)})`,
    `With: ${appt.staffName}`,
    `Status: ${STATUS_LABELS[appt.status]}`,
    settings.phone ? `Phone: ${formatPhone(settings.phone)}` : '',
    settings.email ? `Email: ${settings.email}` : '',
    'Saved in your browser with BookEase. Nothing was sent to the business.',
  ]
    .filter(Boolean)
    .join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BookEase//Customer Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${appt.reference}@bookease.local`,
    `DTSTAMP:${icsUtcStamp(now)}`,
    `DTSTART;TZID=${tz}:${icsLocalDateTime(appt.date, appt.startTime)}`,
    `DTEND;TZID=${tz}:${icsLocalDateTime(appt.date, appt.endTime)}`,
    `SUMMARY:${escapeIcsText(`${appt.serviceName} at ${settings.name}`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    settings.address ? `LOCATION:${escapeIcsText(settings.address)}` : '',
    `STATUS:${appt.status === 'confirmed' ? 'CONFIRMED' : appt.status === 'cancelled' ? 'CANCELLED' : 'TENTATIVE'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

export function buildTextSummary(appt: Appointment, settings: BusinessSettings): string {
  const rows: [string, string][] = [
    ['Booking reference', appt.reference],
    ['Status', STATUS_LABELS[appt.status]],
    ['Service', appt.serviceName],
    ['Staff', appt.staffName],
    ['Date', formatISODate(appt.date, 'EEEE, MMMM d, yyyy')],
    ['Time', `${formatTimeRange(appt.startTime, appt.endTime)} (${settings.timezone})`],
    ['Duration', formatDuration(appt.durationMinutes)],
    ['Price', formatMoney(appt.priceCents, settings.currency)],
    ['Name', appt.customerName],
    ['Email', appt.customerEmail],
    ['Phone', formatPhone(appt.customerPhone)],
  ]
  if (appt.customerNotes) rows.push(['Notes', appt.customerNotes])
  const width = Math.max(...rows.map(([k]) => k.length))
  const contact = [settings.name, settings.address, settings.phone ? formatPhone(settings.phone) : '', settings.email].filter(Boolean)
  return [
    `${settings.name} booking`,
    '='.repeat(settings.name.length + 8),
    '',
    ...rows.map(([k, v]) => `${k.padEnd(width)}  ${v}`),
    '',
    'Business contact',
    ...contact.map((c) => `  ${c}`),
    '',
    'This booking is stored in the browser where it was made (BookEase local demo).',
    'No confirmation email or text message was sent.',
    '',
  ].join('\r\n')
}
