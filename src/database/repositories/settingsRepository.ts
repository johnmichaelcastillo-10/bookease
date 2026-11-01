import { db } from '@/database/db'
import { defaultAppState, defaultBusinessSettings } from '@/services/settings/defaults'
import type { AppState, BusinessSettings } from '@/types/models'

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const row = await db.settings.get('business')
  // Merge with defaults so settings added in later versions always have a value.
  return { ...defaultBusinessSettings(), ...(row?.key === 'business' ? row.value : {}) }
}

export async function putBusinessSettings(value: BusinessSettings): Promise<void> {
  await db.settings.put({ key: 'business', value })
}

export async function getAppState(): Promise<AppState> {
  const row = await db.settings.get('app')
  return { ...defaultAppState(), ...(row?.key === 'app' ? row.value : {}) }
}

export async function putAppState(value: AppState): Promise<void> {
  await db.settings.put({ key: 'app', value })
}

export async function patchAppState(patch: Partial<AppState>): Promise<AppState> {
  const next = { ...(await getAppState()), ...patch }
  await putAppState(next)
  return next
}
