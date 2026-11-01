/**
 * Locally generated reminders. Runs while the admin is open; dedupe keys make it safe to run
 * repeatedly. No email, SMS or push is sent.
 */
import { db } from '@/database/db'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { notificationsRepository } from '@/database/repositories/eventsRepository'
import { getBusinessSettings } from '@/database/repositories/settingsRepository'
import { formatTime } from '@/lib/format'
import { addDays, toMinutes, wallClockDiffMinutes } from '@/lib/time'
import { businessNow } from '@/services/clock'
import { notify } from '@/services/events'

export async function syncReminders(): Promise<number> {
  const settings = await getBusinessSettings()
  const now = businessNow(settings.timezone)
  return db.transaction('rw', db.appointments, db.notifications, async () => {
    let created = 0
    const window = await appointmentsRepository.listRange(addDays(now.date, -7), addDays(now.date, 1))

    for (const a of window) {
      if (a.status !== 'pending' && a.status !== 'confirmed') continue
      const minutesUntil = wallClockDiffMinutes({ date: a.date, minutes: toMinutes(a.startTime) }, now)
      if (minutesUntil > 0 && minutesUntil <= 24 * 60) {
        const made = await notify({
          type: 'upcoming',
          title: 'Starting within 24 hours',
          message: `${a.customerName} · ${a.serviceName} at ${formatTime(a.startTime)}${a.date === now.date ? ' today' : ' tomorrow'} with ${a.staffName}${a.status === 'pending' ? ' (still pending confirmation)' : ''}.`,
          appointmentId: a.id,
          dedupeKey: `upcoming:${a.id}:${a.date}:${a.startTime}`,
        })
        if (made) created++
      }
    }

    // Operational alert: appointments that ended but still need an outcome.
    const stale = window.filter(
      (a) =>
        (a.status === 'pending' || a.status === 'confirmed') &&
        wallClockDiffMinutes({ date: a.date, minutes: toMinutes(a.endTime) }, now) < 0,
    )
    if (stale.length > 0) {
      const made = await notify({
        type: 'operational',
        title: 'Past appointments need an outcome',
        message: `${stale.length} appointment${stale.length === 1 ? ' has' : 's have'} ended but ${stale.length === 1 ? 'is' : 'are'} still pending or confirmed. Mark them completed, no-show or cancelled.`,
        dedupeKey: `stale:${now.date}`,
      })
      if (made) created++
    }
    return created
  })
}

export const markNotificationRead = (id: string) => notificationsRepository.markRead(id)
export const markAllNotificationsRead = () => notificationsRepository.markAllRead()
export const clearNotifications = () => notificationsRepository.clear()
