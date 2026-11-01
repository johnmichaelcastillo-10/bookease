import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { BookEaseDB, db } from '@/database/db'
import { getAppState } from '@/database/repositories/settingsRepository'
import { SCHEMA_V1 } from '@/database/schema'
import { seedDemoData } from '@/database/seed/demoData'
import { createAppointment } from '@/services/appointments/appointmentService'
import { clearDemoData, exportBackup, importBackup, parseBackup, resetApplication } from '@/services/data/backupService'
import { createCustomer, DuplicateCustomerError, updateCustomer } from '@/services/customers/customerService'
import { deleteService } from '@/services/catalog/catalogService'
import { ValidationError } from '@/services/errors'
import { resetDb, seedBasics, TOMORROW } from '../helpers/db'

beforeEach(async () => {
  await resetDb()
})

describe('database', () => {
  it('opens at the current version with every store', async () => {
    expect(db.verno).toBe(2)
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['activityLogs', 'appointments', 'blockedDates', 'businessHours', 'customers', 'notifications', 'serviceCategories', 'services', 'settings', 'staff', 'staffSchedules'].sort(),
    )
  })

  it('migrates a version 1 database and back-fills normalized emails', async () => {
    const name = 'bookease-migration-test'
    await Dexie.delete(name)
    const v1 = new Dexie(name)
    v1.version(1).stores(SCHEMA_V1)
    await v1.open()
    await v1.table('customers').add({ id: 'c1', fullName: 'Old Record', email: '  Mixed@Case.COM ', phone: '', createdAt: '2026-01-01T00:00:00.000Z' })
    v1.close()

    const upgraded = new BookEaseDB(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(2)
    expect(await upgraded.customers.where('normalizedEmail').equals('mixed@case.com').count()).toBe(1)
    upgraded.close()
    await Dexie.delete(name)
  })

  it('supports CRUD through services with duplicate-email protection', async () => {
    const a = await createCustomer({ fullName: 'Pat Lee', email: 'pat@example.com', phone: '5550100000', address: '', notes: '' })
    await expect(createCustomer({ fullName: 'Pat L.', email: 'PAT@example.com', phone: '5550100001', address: '', notes: '' })).rejects.toBeInstanceOf(DuplicateCustomerError)
    await expect(createCustomer({ fullName: 'Pat Partner', email: 'pat@example.com', phone: '5550100001', address: '', notes: '' }, { allowDuplicateEmail: true })).resolves.toBeTruthy()
    const updated = await updateCustomer(a.id, { fullName: 'Pat Lee-Smith', email: 'pat@example.com', phone: '555 010 0000', address: '1 Main St', notes: '' })
    expect(updated).toMatchObject({ fullName: 'Pat Lee-Smith', address: '1 Main St', phone: '5550100000' })
  })

  it('refuses to delete a service that appointments use', async () => {
    const ctx = await seedBasics()
    await createAppointment({ customerId: ctx.customer.id, serviceId: ctx.consult.id, staffId: ctx.bob.id, date: TOMORROW, startTime: '09:00', customerNotes: '', internalNotes: '' })
    await expect(deleteService(ctx.consult.id)).rejects.toMatchObject({ code: 'service-in-use' })
    await expect(deleteService(ctx.repair.id)).resolves.toBeUndefined()
    expect((await db.staff.get(ctx.alice.id))?.serviceIds).toEqual([])
  })
})

describe('demo data', () => {
  it('seeds once, never duplicates, and respects scheduling rules', async () => {
    const first = await seedDemoData()
    expect(first.seeded).toBe(true)
    expect(first.appointments).toBeGreaterThan(50)
    const statuses = new Set((await db.appointments.toArray()).map((a) => a.status))
    for (const s of ['pending', 'confirmed', 'completed', 'cancelled', 'no-show']) expect(statuses).toContain(s)

    const again = await seedDemoData()
    expect(again.seeded).toBe(false)
    expect(await db.services.where('source').equals('demo').count()).toBe(6)
  })

  it('clears demo data but keeps user records and anything they reference', async () => {
    await seedDemoData()
    const demoService = (await db.services.where('source').equals('demo').toArray()).find((s) => s.name === 'General Consultation')!
    const demoStaff = (await db.staff.where('source').equals('demo').toArray()).find((s) => s.fullName === 'Alex Morgan')!
    const mine = await createCustomer({ fullName: 'My Customer', email: 'mine@example.com', phone: '5550109999', address: '', notes: '' })
    // Find a free slot for Alex in the coming two weeks.
    const { generateSlotsFor } = await import('@/services/availability/availabilityService')
    let booked = false
    for (let i = 1; i < 14 && !booked; i++) {
      const date = new Date(Date.UTC(2026, 10, 2 + i)).toISOString().slice(0, 10)
      const r = await generateSlotsFor({ serviceId: demoService.id, staffId: demoStaff.id, date, actor: 'admin' })
      if (r.slots[0]) {
        await createAppointment({ customerId: mine.id, serviceId: demoService.id, staffId: demoStaff.id, date, startTime: r.slots[0].start, customerNotes: '', internalNotes: '' })
        booked = true
      }
    }
    expect(booked).toBe(true)

    const result = await clearDemoData()
    expect(result.kept).toBe(2) // the service and staff member my appointment uses
    expect(await db.appointments.count()).toBe(1)
    expect(await db.customers.count()).toBe(1)
    expect(await db.services.count()).toBe(1)
    expect((await getAppState()).demoSeededAt).toBeNull()
  })
})

describe('backup and restore', () => {
  it('round-trips every store', async () => {
    const ctx = await seedBasics()
    await createAppointment({ customerId: ctx.customer.id, serviceId: ctx.consult.id, staffId: ctx.bob.id, date: TOMORROW, startTime: '09:00', customerNotes: 'hi', internalNotes: '' })
    const backup = await exportBackup()
    const text = JSON.stringify(backup)

    await resetApplication()
    expect(await db.appointments.count()).toBe(0)

    const parsed = parseBackup(text)
    expect(parsed.summary.appointments).toBe(1)
    await importBackup(parsed)
    expect(await db.appointments.count()).toBe(1)
    expect(await db.customers.count()).toBe(1)
    expect((await db.appointments.toArray())[0]?.customerNotes).toBe('hi')
  })

  it('rejects files that are not BookEase backups', () => {
    expect(() => parseBackup('not json')).toThrow(ValidationError)
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow(/not a BookEase backup/)
    expect(() => parseBackup(JSON.stringify({ app: 'bookease', schemaVersion: 99, data: {} }))).toThrow(/newer version/)
  })

  it('rejects a backup with an invalid record and writes nothing', async () => {
    const ctx = await seedBasics()
    const backup = await exportBackup()
    ;(backup.data.services[0] as { priceCents: number }).priceCents = -5
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/invalid record/)
    expect(await db.services.get(ctx.consult.id)).toBeTruthy()
  })

  it('rolls back the whole import if a write fails part-way', async () => {
    await seedBasics()
    const before = await db.services.count()
    const backup = await exportBackup()
    const parsed = parseBackup(JSON.stringify(backup))
    // Two appointments with the same unique reference: the second bulkAdd throws mid-transaction.
    const appt = { ...(await import('../helpers/sampleAppointment')).sampleAppointment() }
    parsed.data.appointments = [appt, { ...appt, id: 'other-id' }]
    await expect(importBackup(parsed)).rejects.toBeTruthy()
    expect(await db.services.count()).toBe(before)
  })

  it('upgrades customers from a schema 1 backup', () => {
    const file = {
      app: 'bookease',
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: {
        customers: [{ id: 'c1', fullName: 'Old', email: 'Old@Example.com', phone: '', address: '', notes: '', lastAppointmentDate: null, source: 'user', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      },
    }
    const parsed = parseBackup(JSON.stringify(file))
    expect((parsed.data.customers[0] as { normalizedEmail: string }).normalizedEmail).toBe('old@example.com')
  })
})
