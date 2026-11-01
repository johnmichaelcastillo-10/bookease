/** Email and phone normalization shared by validation, services and the v2 migration. */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Keeps digits and a leading "+", drops spaces, dashes, dots and brackets.
 * "(555) 010-2030" → "5550102030", "+1 555 010 2030" → "+15550102030".
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

/** 7 to 15 digits (E.164 maximum), optional leading "+". */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  const digits = normalized.replace('+', '')
  return /^\+?\d+$/.test(normalized) && digits.length >= 7 && digits.length <= 15
}

/** Readable grouping for display; leaves unusual formats alone. */
export function formatPhone(phone: string): string {
  const n = normalizePhone(phone)
  if (/^\d{10}$/.test(n)) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
  if (/^\+1\d{10}$/.test(n)) return `+1 (${n.slice(2, 5)}) ${n.slice(5, 8)}-${n.slice(8)}`
  return n
}
