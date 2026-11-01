/**
 * JSON backup, restore, reset and "clear sample data". Imports are validated record by record
 * before anything is written, then applied in one transaction: if any write fails, IndexedDB
 * rolls the whole import back and the existing data stays as it was.
 */
import type { z } from 'zod'
import { allTables, db } from '@/database/db'
import { getAppState, patchAppState } from '@/database/repositories/settingsRepository'
import { CURRENT_SCHEMA_VERSION, STORE_NAMES, type StoreName } from '@/database/schema'
import { normalizeEmail } from '@/lib/contact'
import { nowTimestamp } from '@/services/clock'
import { ValidationError } from '@/services/errors'
import { logActivity } from '@/services/events'
import type { ID } from '@/types/models'
import {
  activityRecord,
  appointmentRecord,
  blockedDateRecord,
  businessHoursRecord,
  categoryRecord,
  customerRecord,
  notificationRecord,
  serviceRecord,
  settingsRecord,
  staffRecord,
  staffScheduleRecord,
} from '@/validation/records'

export const BACKUP_APP_ID = 'bookease'

const RECORD_SCHEMAS: Record<StoreName, z.ZodType> = {
  services: serviceRecord,
  serviceCategories: categoryRecord,
  staff: staffRecord,
  customers: customerRecord,
  appointments: appointmentRecord,
  businessHours: businessHoursRecord,
  staffSchedules: staffScheduleRecord,
  blockedDates: blockedDateRecord,
  notifications: notificationRecord,
  activityLogs: activityRecord,
  settings: settingsRecord,
}

const PRIMARY_KEYS: Record<StoreName, string> = {
  services: 'id',
  serviceCategories: 'id',
  staff: 'id',
  customers: 'id',
  appointments: 'id',
  businessHours: 'weekday',
  staffSchedules: 'staffId',
  blockedDates: 'id',
  notifications: 'id',
  activityLogs: 'id',
  settings: 'key',
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  data: Record<StoreName, unknown[]>
}

export type BackupSummary = Record<StoreName, number>

export async function exportBackup(): Promise<BackupFile> {
  const data = {} as Record<StoreName, unknown[]>
  await db.transaction('r', allTables(), async () => {
    for (const name of STORE_NAMES) data[name] = await db.table(name).toArray()
  })
  return { app: BACKUP_APP_ID, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: nowTimestamp(), data }
}

export async function markBackupTaken(): Promise<void> {
  await patchAppState({ lastBackupAt: nowTimestamp() })
}

export interface ParsedBackup {
  schemaVersion: number
  exportedAt: string
  data: Record<StoreName, unknown[]>
  summary: BackupSummary
}

/** Upgrades records from older backup versions to the current shape. */
function migrateRecords(store: StoreName, rows: unknown[], fromVersion: number): unknown[] {
  if (fromVersion < 2 && store === 'customers') {
    return rows.map((r) =>
      r && typeof r === 'object' && !('normalizedEmail' in r)
        ? { ...r, normalizedEmail: normalizeEmail(String((r as { email?: unknown }).email ?? '')) }
        : r,
    )
  }
  return rows
}

/**
 * Parses and validates a backup file. Throws a ValidationError listing the first problems
 * found; never writes anything.
 */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new ValidationError('This file is not valid JSON.')
  }
  if (!json || typeof json !== 'object') throw new ValidationError('This file is not a BookEase backup.')
  const file = json as Partial<BackupFile>
  if (file.app !== BACKUP_APP_ID) throw new ValidationError('This file is not a BookEase backup.')
  if (typeof file.schemaVersion !== 'number' || file.schemaVersion < 1) throw new ValidationError('The backup has no valid schema version.')
  if (file.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new ValidationError(`This backup was made by a newer version of BookEase (schema ${file.schemaVersion}). Update the app first.`)
  }
  if (!file.data || typeof file.data !== 'object') throw new ValidationError('The backup has no data section.')

  const issues: { path: string; message: string }[] = []
  const data = {} as Record<StoreName, unknown[]>
  const summary = {} as BackupSummary

  for (const store of STORE_NAMES) {
    const raw = (file.data as Record<string, unknown>)[store] ?? []
    if (!Array.isArray(raw)) {
      issues.push({ path: store, message: `"${store}" must be a list.` })
      continue
    }
    const rows = migrateRecords(store, raw, file.schemaVersion)
    const parsed: unknown[] = []
    const seen = new Set<unknown>()
    rows.forEach((row, index) => {
      const result = RECORD_SCHEMAS[store].safeParse(row)
      if (!result.success) {
        const first = result.error.issues[0]
        issues.push({ path: `${store}[${index}]${first?.path.length ? '.' + first.path.join('.') : ''}`, message: first?.message ?? 'Invalid record.' })
        return
      }
      const key = (result.data as Record<string, unknown>)[PRIMARY_KEYS[store]]
      if (seen.has(key)) {
        issues.push({ path: `${store}[${index}]`, message: `Duplicate key "${String(key)}".` })
        return
      }
      seen.add(key)
      parsed.push(result.data)
    })
    data[store] = parsed
    summary[store] = parsed.length
  }

  const refs = new Set<unknown>()
  for (const [i, a] of (data.appointments as { reference: string }[]).entries()) {
    if (refs.has(a.reference)) issues.push({ path: `appointments[${i}].reference`, message: `Duplicate booking reference ${a.reference}.` })
    refs.add(a.reference)
  }

  if (issues.length > 0) {
    const shown = issues.slice(0, 5).map((i) => `${i.path}: ${i.message}`).join(' · ')
    throw new ValidationError(
      `The backup has ${issues.length} invalid record${issues.length === 1 ? '' : 's'}. Nothing was imported. ${shown}`,
      issues,
    )
  }
  return { schemaVersion: file.schemaVersion, exportedAt: String(file.exportedAt ?? ''), data, summary }
}

/** Replaces every store with the backup's contents in a single transaction. */
export async function importBackup(backup: ParsedBackup): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    for (const store of STORE_NAMES) await db.table(store).clear()
    for (const store of STORE_NAMES) {
      const rows = backup.data[store]
      if (rows.length) await db.table(store).bulkAdd(rows)
    }
    await logActivity({
      entityType: 'data',
      entityId: null,
      action: 'data.imported',
      description: `Restored a backup from ${backup.exportedAt ? new Date(backup.exportedAt).toLocaleString() : 'an unknown date'} (${backup.summary.appointments} appointments, ${backup.summary.customers} customers).`,
    })
  })
  // Restoring onto a fresh browser shouldn't show first-launch onboarding again.
  const state = await getAppState()
  if (!state.onboardingCompletedAt) await patchAppState({ onboardingCompletedAt: nowTimestamp() })
}

/** Deletes everything. The next visit shows first-launch onboarding again. */
export async function resetApplication(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    for (const table of allTables()) await table.clear()
  })
}

export interface ClearDemoResult {
  removed: number
  /** Demo records kept because records you created still reference them. */
  kept: number
}

/**
 * Removes seeded records (`source: 'demo'`). Demo customers, services and staff that your own
 * appointments still point to are kept so nothing you created loses its references.
 */
export async function clearDemoData(): Promise<ClearDemoResult> {
  return db.transaction('rw', allTables(), async () => {
    const userAppointments = await db.appointments.filter((a) => a.source === 'user').toArray()
    const referenced = new Set<ID>(userAppointments.flatMap((a) => [a.customerId, a.serviceId, a.staffId]))
    const removedIds = new Set<ID>()
    let kept = 0

    const demoAppointments = await db.appointments.where('source').equals('demo').toArray()
    for (const a of demoAppointments) removedIds.add(a.id)
    await db.appointments.bulkDelete(demoAppointments.map((a) => a.id))

    for (const table of [db.customers, db.services, db.staff] as const) {
      const demo = await table.where('source').equals('demo').toArray()
      const removable = demo.filter((r) => !referenced.has(r.id))
      kept += demo.length - removable.length
      for (const r of removable) removedIds.add(r.id)
      await table.bulkDelete(removable.map((r) => r.id))
    }
    // Schedules of removed staff, demo special dates, and events about removed records.
    await db.staffSchedules.filter((s) => removedIds.has(s.staffId)).delete()
    await db.staff.toCollection().modify((s) => {
      s.serviceIds = s.serviceIds.filter((id) => !removedIds.has(id))
    })
    const demoBlocks = await db.blockedDates.where('source').equals('demo').primaryKeys()
    await db.blockedDates.bulkDelete(demoBlocks)
    await db.notifications.filter((n) => n.appointmentId !== null && removedIds.has(n.appointmentId)).delete()
    await db.activityLogs.filter((l) => l.entityId !== null && removedIds.has(l.entityId)).delete()

    await patchAppState({ demoSeededAt: null })
    const removed = removedIds.size + demoBlocks.length
    await logActivity({
      entityType: 'data',
      entityId: null,
      action: 'data.demo-cleared',
      description: `Cleared sample data (${removed} records removed${kept ? `, ${kept} kept because your appointments use them` : ''}).`,
    })
    return { removed, kept }
  })
}

export interface StorageInfo {
  usageBytes: number | null
  quotaBytes: number | null
  persisted: boolean | null
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!storage) return { usageBytes: null, quotaBytes: null, persisted: null }
  const [estimate, persisted] = await Promise.all([
    storage.estimate ? storage.estimate().catch(() => null) : Promise.resolve(null),
    storage.persisted ? storage.persisted().catch(() => null) : Promise.resolve(null),
  ])
  return { usageBytes: estimate?.usage ?? null, quotaBytes: estimate?.quota ?? null, persisted }
}

/** Asks the browser not to evict BookEase's data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export function backupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 16).replace(/[:T]/g, '-')
  return `bookease-backup-${stamp}.json`
}
