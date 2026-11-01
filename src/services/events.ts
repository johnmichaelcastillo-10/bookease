/**
 * Activity log entries and local notifications. Called by other services inside their
 * transactions, so the record and its audit entry are saved (or rolled back) together.
 * Nothing here sends anything over the network.
 */
import { activityRepository, notificationsRepository } from '@/database/repositories/eventsRepository'
import { newId } from '@/lib/ids'
import { nowTimestamp } from '@/services/clock'
import type { ActivityEntity, Actor, ID, NotificationType } from '@/types/models'

export async function logActivity(entry: {
  entityType: ActivityEntity
  entityId: ID | null
  action: string
  description: string
  actor?: Actor
}): Promise<void> {
  await activityRepository.add({ id: newId(), actor: 'admin', createdAt: nowTimestamp(), ...entry })
}

export async function notify(entry: {
  type: NotificationType
  title: string
  message: string
  appointmentId?: ID | null
  dedupeKey?: string
}): Promise<boolean> {
  if (entry.dedupeKey && (await notificationsRepository.hasDedupeKey(entry.dedupeKey))) return false
  await notificationsRepository.add({
    id: newId(),
    type: entry.type,
    title: entry.title,
    message: entry.message,
    appointmentId: entry.appointmentId ?? null,
    read: 0,
    ...(entry.dedupeKey ? { dedupeKey: entry.dedupeKey } : {}),
    createdAt: nowTimestamp(),
  })
  return true
}
