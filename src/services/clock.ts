import { nowInTimeZone, type WallClock } from '@/lib/time'

/**
 * The single source of "now" for services. Tests (and the demo seed) can pin it so that
 * past/future rules are deterministic.
 */
let override: (() => Date) | null = null

export function currentInstant(): Date {
  return override ? override() : new Date()
}

export function nowTimestamp(): string {
  return currentInstant().toISOString()
}

export function businessNow(timeZone: string): WallClock {
  return nowInTimeZone(timeZone, currentInstant())
}

/** Test helper. Pass null to restore the real clock. */
export function setClock(fn: (() => Date) | null): void {
  override = fn
}
