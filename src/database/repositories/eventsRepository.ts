import { db } from '@/database/db'
import type { ActivityEntity, ActivityLog, AppNotification, ID } from '@/types/models'

export const notificationsRepository = {
  listRecent(limit = 50): Promise<AppNotification[]> {
    return db.notifications.orderBy('createdAt').reverse().limit(limit).toArray()
  },
  countUnread(): Promise<number> {
    return db.notifications.where('read').equals(0).count()
  },
  async hasDedupeKey(key: string): Promise<boolean> {
    return (await db.notifications.where('dedupeKey').equals(key).count()) > 0
  },
  add(notification: AppNotification): Promise<ID> {
    return db.notifications.add(notification)
  },
  async markRead(id: ID): Promise<void> {
    await db.notifications.update(id, { read: 1 })
  },
  async markAllRead(): Promise<void> {
    await db.notifications.where('read').equals(0).modify({ read: 1 })
  },
  clear(): Promise<void> {
    return db.notifications.clear()
  },
}

export interface ActivityQuery {
  entityType?: ActivityEntity
  entityId?: ID
  offset?: number
  limit?: number
}

export const activityRepository = {
  add(entry: ActivityLog): Promise<ID> {
    return db.activityLogs.add(entry)
  },
  async page(query: ActivityQuery = {}): Promise<{ rows: ActivityLog[]; total: number }> {
    let collection = db.activityLogs.orderBy('createdAt').reverse()
    if (query.entityType) collection = collection.filter((a) => a.entityType === query.entityType)
    if (query.entityId) collection = collection.filter((a) => a.entityId === query.entityId)
    const total = await collection.clone().count()
    const rows = await collection
      .offset(query.offset ?? 0)
      .limit(query.limit ?? 25)
      .toArray()
    return { rows, total }
  },
  listForEntity(entityId: ID, limit = 20): Promise<ActivityLog[]> {
    return db.activityLogs
      .where('entityId')
      .equals(entityId)
      .reverse()
      .sortBy('createdAt')
      .then((rows) => rows.slice(0, limit))
  },
}
