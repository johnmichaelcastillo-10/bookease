import { db } from '@/database/db'
import { putBusinessSettings } from '@/database/repositories/settingsRepository'
import { createCategory, createService } from '@/services/catalog/catalogService'
import { setClock } from '@/services/clock'
import { createCustomer } from '@/services/customers/customerService'
import { defaultBusinessHours, defaultBusinessSettings } from '@/services/settings/defaults'
import { createStaff } from '@/services/staff/staffService'
import type { BusinessSettings } from '@/types/models'

/** Monday 2026-11-02, 07:00 UTC. Business timezone in tests is UTC. */
export const TEST_NOW = new Date('2026-11-02T07:00:00.000Z')
export const TODAY = '2026-11-02'
export const TOMORROW = '2026-11-03'

export async function resetDb(settings: Partial<BusinessSettings> = {}) {
  setClock(() => TEST_NOW)
  db.close()
  await db.delete()
  await db.open()
  await putBusinessSettings({ ...defaultBusinessSettings(), timezone: 'UTC', minNoticeMinutes: 0, ...settings })
  await db.businessHours.bulkPut(defaultBusinessHours()) // Mon–Fri 09–12, 13–17
}

/** One category, two services, two staff, one customer. */
export async function seedBasics() {
  const category = await createCategory('Consultation')
  const consult = await createService({
    name: 'Consultation',
    description: '',
    categoryId: category.id,
    durationMinutes: 60,
    bufferMinutes: 0,
    price: 50,
    isActive: true,
    staffMode: 'any',
  })
  const repair = await createService({
    name: 'Repair',
    description: '',
    categoryId: category.id,
    durationMinutes: 30,
    bufferMinutes: 15,
    price: 80,
    isActive: true,
    staffMode: 'assigned',
  })
  const alice = await createStaff({ fullName: 'Alice Adams', email: '', phone: '', position: '', description: '', serviceIds: [repair.id], isActive: true, color: 'teal' })
  const bob = await createStaff({ fullName: 'Bob Brown', email: '', phone: '', position: '', description: '', serviceIds: [], isActive: true, color: 'blue' })
  const customer = await createCustomer({ fullName: 'Casey Customer', email: 'Casey@Example.com', phone: '(555) 010-2030', address: '', notes: '' })
  return { category, consult, repair, alice, bob, customer }
}
