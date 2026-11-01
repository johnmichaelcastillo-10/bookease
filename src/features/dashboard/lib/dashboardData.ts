import { toMinutes, wallClockDiffMinutes, type WallClock } from '@/lib/time'
import type { Appointment } from '@/types/models'

const isOpen = (a: Appointment) => a.status === 'pending' || a.status === 'confirmed'
const startOf = (a: Appointment) => ({ date: a.date, minutes: toMinutes(a.startTime) })
const endOf = (a: Appointment) => ({ date: a.date, minutes: toMinutes(a.endTime) })
const byStart = (a: Appointment, b: Appointment) => (a.date + a.startTime).localeCompare(b.date + b.startTime)

/** Next pending/confirmed appointments that haven't started yet. */
export function upcomingAppointments(all: readonly Appointment[], now: WallClock, limit = 8): Appointment[] {
  return all
    .filter((a) => isOpen(a) && wallClockDiffMinutes(startOf(a), now) >= 0)
    .sort(byStart)
    .slice(0, limit)
}

/** Pending bookings starting within the next 48 hours: confirm or follow up. */
export function pendingSoon(all: readonly Appointment[], now: WallClock, hours = 48): Appointment[] {
  return all
    .filter((a) => {
      if (a.status !== 'pending') return false
      const until = wallClockDiffMinutes(startOf(a), now)
      return until >= 0 && until <= hours * 60
    })
    .sort(byStart)
}

/** Appointments that have ended but are still pending or confirmed: need an outcome. */
export function pastStillOpen(all: readonly Appointment[], now: WallClock): Appointment[] {
  return all.filter((a) => isOpen(a) && wallClockDiffMinutes(endOf(a), now) < 0).sort(byStart)
}
