/** Stable unique IDs and human-readable booking references. */

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Fallback for very old browsers: RFC 4122 v4 from getRandomValues.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** No 0/O, 1/I/L: easy to read aloud and type. */
export const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const REFERENCE_PREFIX = 'BE-'
const REFERENCE_LENGTH = 6

export function generateReference(random: () => number = secureRandom): string {
  let code = ''
  for (let i = 0; i < REFERENCE_LENGTH; i++) {
    code += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)]
  }
  return REFERENCE_PREFIX + code
}

export const REFERENCE_RE = new RegExp(`^${REFERENCE_PREFIX}[${REFERENCE_ALPHABET}]{${REFERENCE_LENGTH}}$`)

/** Uppercases, trims and adds the prefix if the customer left it out. */
export function normalizeReference(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]+/g, '')
  const code = cleaned.length === REFERENCE_LENGTH + 2 && cleaned.startsWith('BE') ? cleaned.slice(2) : cleaned
  return REFERENCE_PREFIX + code
}

function secureRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! / 2 ** 32
}
