import { db } from '@/database/db'
import { getBusinessSettings, patchAppState, putBusinessSettings } from '@/database/repositories/settingsRepository'
import { normalizePhone } from '@/lib/contact'
import { nowTimestamp } from '@/services/clock'
import { ValidationError } from '@/services/errors'
import { logActivity } from '@/services/events'
import type { BusinessSettings } from '@/types/models'
import {
  bookingSettingsSchema,
  generalSettingsSchema,
  type BookingSettingsInput,
  type GeneralSettingsInput,
} from '@/validation/schemas'

async function save(patch: Partial<BusinessSettings>, description: string): Promise<BusinessSettings> {
  return db.transaction('rw', db.settings, db.activityLogs, async () => {
    const next = { ...(await getBusinessSettings()), ...patch }
    await putBusinessSettings(next)
    await logActivity({ entityType: 'settings', entityId: null, action: 'settings.updated', description })
    return next
  })
}

export function updateGeneralSettings(input: GeneralSettingsInput): Promise<BusinessSettings> {
  const parsed = generalSettingsSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  const value = { ...parsed.data, phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : '' }
  return save(value, 'Updated general business settings.')
}

export function updateBookingSettings(input: BookingSettingsInput): Promise<BusinessSettings> {
  const parsed = bookingSettingsSchema.safeParse(input)
  if (!parsed.success) throw ValidationError.fromZod(parsed.error)
  return save(parsed.data, 'Updated booking rules.')
}

/** Logos are stored as small data URLs (≤ 200 KB) in the settings record. */
export const MAX_LOGO_BYTES = 200_000

export function updateLogo(dataUrl: string | null): Promise<BusinessSettings> {
  if (dataUrl !== null) {
    if (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(dataUrl)) throw new ValidationError('Use a PNG, JPEG, WebP or SVG image.')
    if (dataUrl.length > MAX_LOGO_BYTES * 1.37) throw new ValidationError('The logo is too large. Use an image under 200 KB.')
  }
  return save({ logoDataUrl: dataUrl }, dataUrl ? 'Updated the business logo.' : 'Removed the business logo.')
}

export async function completeOnboarding(): Promise<void> {
  await patchAppState({ onboardingCompletedAt: nowTimestamp() })
}
