/**
 * Demo data for "BrightSpace Services". Dates are generated relative to today, and every
 * appointment is placed with the real scheduling engine, so the sample data obeys the same
 * hours, breaks, closures and conflict rules as real bookings. Records are tagged
 * `source: 'demo'` so they can be removed later without touching user data.
 */
import { allTables, db } from '@/database/db'
import { getAppState, getBusinessSettings, patchAppState, putBusinessSettings } from '@/database/repositories/settingsRepository'
import { normalizeEmail, normalizePhone } from '@/lib/contact'
import { generateReference, newId } from '@/lib/ids'
import { addDays, diffDays, fromMinutes, toMinutes, type WallClock } from '@/lib/time'
import { findCustomerOverlap, generateAvailableSlots, getEligibleStaff } from '@/services/availability/engine'
import { businessNow, currentInstant } from '@/services/clock'
import { logActivity, notify } from '@/services/events'
import { defaultBusinessSettings, defaultWeeklySchedule } from '@/services/settings/defaults'
import type {
  Appointment,
  AppointmentStatus,
  BlockedDate,
  BusinessHoursDay,
  Customer,
  DaySchedule,
  ID,
  ISODate,
  Service,
  ServiceCategory,
  Staff,
  StaffSchedule,
  Weekday,
  WeeklySchedule,
} from '@/types/models'

/** Small deterministic PRNG so the demo looks the same every time it's loaded. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const day = (intervals: [string, string][], breaks: [string, string][] = []): DaySchedule => ({
  isOpen: intervals.length > 0,
  intervals: intervals.map(([start, end]) => ({ start, end })),
  breaks: breaks.map(([start, end]) => ({ start, end })),
})

const WEEKDAY_HOURS = day([
  ['08:00', '12:00'],
  ['13:00', '17:00'],
])

function businessWeek(): BusinessHoursDay[] {
  const map: Record<Weekday, DaySchedule> = {
    0: day([]),
    1: WEEKDAY_HOURS,
    2: WEEKDAY_HOURS,
    3: WEEKDAY_HOURS,
    4: WEEKDAY_HOURS,
    5: WEEKDAY_HOURS,
    6: day([['09:00', '13:00']]),
  }
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => ({ weekday, ...structuredClone(map[weekday]) }))
}

function customWeek(days: Partial<Record<Weekday, DaySchedule>>): WeeklySchedule {
  const week = defaultWeeklySchedule()
  for (const wd of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) week[wd] = structuredClone(days[wd] ?? day([]))
  return week
}

const CUSTOMER_NAMES = [
  'Olivia Bennett', 'Liam Carter', 'Sophia Ramirez', 'Noah Patel', 'Ava Thompson', 'Ethan Brooks',
  'Isabella Nguyen', 'Mason Rivera', 'Mia Collins', 'Lucas Foster', 'Charlotte Kim', 'James Howard',
  'Amelia Ortiz', 'Benjamin Hayes', 'Harper Sullivan', 'Elijah Price', 'Evelyn Ward', 'Henry Coleman',
  'Abigail Reyes', 'Daniel Morris', 'Ella Jenkins', 'Matthew Perry', 'Grace Long', 'Samuel Butler',
  'Chloe Simmons', 'David Barnes', 'Zoe Fisher', 'Jack Henderson',
]

const NOTES = [
  'First visit, referred by a friend.',
  'Prefers morning appointments.',
  'Please call on arrival.',
  'Would like a quote for follow-up work.',
  '',
  '',
  '',
]

export interface SeedResult {
  seeded: boolean
  appointments: number
  customers: number
}

/**
 * Loads the demo business. Does nothing if demo data is already present. Adds records only:
 * business settings and hours are written only when they've never been set.
 */
export async function seedDemoData(): Promise<SeedResult> {
  const state = await getAppState()
  const alreadyDemo = (await db.services.where('source').equals('demo').count()) > 0
  if (state.demoSeededAt || alreadyDemo) return { seeded: false, appointments: 0, customers: 0 }

  const rand = mulberry32(20261101)
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!
  const createdAt = currentInstant().toISOString()

  return db.transaction('rw', allTables(), async () => {
    // Settings and hours: only on a fresh database, never over the user's own configuration.
    const settingsRow = await db.settings.get('business')
    if (!settingsRow) {
      await putBusinessSettings({
        ...defaultBusinessSettings(),
        name: 'BrightSpace Services',
        description: 'Consultations, personal care and on-site maintenance, booked online in a couple of minutes.',
        email: 'hello@brightspace.example',
        phone: '5550102030',
        address: '120 Market Street, Suite 4, Springfield',
      })
    }
    const settings = await getBusinessSettings()
    const now: WallClock = businessNow(settings.timezone)
    const today = now.date
    const businessHours = (await db.businessHours.count()) === 0 ? businessWeek() : await db.businessHours.toArray()
    if ((await db.businessHours.count()) === 0) await db.businessHours.bulkPut(businessHours)

    // Categories: reuse same-named ones the user already has.
    const existingCategories = await db.serviceCategories.toArray()
    const categoryId = (name: string): ID => {
      const found = existingCategories.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (found) return found.id
      const created: ServiceCategory = { id: newId(), name, createdAt }
      existingCategories.push(created)
      return created.id
    }

    const svc = (name: string, description: string, category: string, duration: number, buffer: number, price: number, staffMode: Service['staffMode'], isActive = true): Service => ({
      id: newId(), name, description, categoryId: categoryId(category), durationMinutes: duration, bufferMinutes: buffer,
      priceCents: price * 100, isActive, staffMode, source: 'demo', createdAt, updatedAt: createdAt,
    })
    const services = {
      general: svc('General Consultation', 'A focused 30-minute session to talk through your needs and next steps.', 'Consultation', 30, 0, 45, 'any'),
      professional: svc('Professional Consultation', 'An in-depth hour with a senior consultant, including a written summary.', 'Professional Services', 60, 15, 120, 'assigned'),
      care: svc('Personal Care Session', 'A relaxing 45-minute personal care treatment tailored to you.', 'Personal Care', 45, 15, 75, 'assigned'),
      maintenance: svc('Maintenance Service', 'Scheduled maintenance visit with inspection and minor repairs.', 'Maintenance', 90, 30, 160, 'assigned'),
      followUp: svc('Follow-up Appointment', 'A short check-in after a previous visit.', 'Consultation', 20, 10, 30, 'any'),
      workshop: svc('Group Workshop', 'Half-day group workshop. Currently not offered.', 'Other', 120, 30, 200, 'assigned', false),
    }
    categoryId('Other')
    await db.serviceCategories.bulkPut(existingCategories)
    await db.services.bulkAdd(Object.values(services))

    const person = (fullName: string, position: string, description: string, serviceIds: ID[], color: string): Staff => ({
      id: newId(), fullName, email: normalizeEmail(`${fullName.split(' ')[0]}@brightspace.example`), phone: normalizePhone(`555010${Math.floor(rand() * 9000 + 1000)}`),
      position, description, serviceIds, isActive: true, color, source: 'demo', createdAt, updatedAt: createdAt,
    })
    const staff = {
      alex: person('Alex Morgan', 'Senior Consultant', 'Leads professional consultations and planning sessions.', [services.general.id, services.professional.id, services.followUp.id, services.workshop.id], 'teal'),
      sarah: person('Sarah Johnson', 'Personal Care Specialist', 'Ten years of experience in personal care and wellbeing.', [services.care.id, services.followUp.id], 'blue'),
      michael: person('Michael Lee', 'Maintenance Technician', 'Handles maintenance visits, inspections and repairs.', [services.maintenance.id, services.general.id], 'amber'),
      emily: person('Emily Davis', 'Client Care Coordinator', 'First point of contact for new clients and follow-ups.', [services.general.id, services.followUp.id, services.care.id], 'violet'),
    }
    await db.staff.bulkAdd(Object.values(staff))

    const schedules: StaffSchedule[] = [
      { staffId: staff.alex.id, mode: 'business-hours', days: defaultWeeklySchedule() },
      { staffId: staff.michael.id, mode: 'business-hours', days: defaultWeeklySchedule() },
      {
        staffId: staff.sarah.id,
        mode: 'custom',
        days: customWeek({ 2: day([['09:00', '17:00']], [['12:00', '13:00']]), 3: day([['09:00', '17:00']], [['12:00', '13:00']]), 4: day([['09:00', '17:00']], [['12:00', '13:00']]), 5: day([['09:00', '17:00']], [['12:00', '13:00']]), 6: day([['09:00', '13:00']]) }),
      },
      {
        staffId: staff.emily.id,
        mode: 'custom',
        days: customWeek({ 1: day([['09:00', '12:00'], ['13:00', '16:00']]), 2: day([['09:00', '12:00'], ['13:00', '16:00']]), 3: day([['09:00', '12:00'], ['13:00', '16:00']]), 4: day([['09:00', '12:00'], ['13:00', '16:00']]) }),
      },
    ]
    await db.staffSchedules.bulkPut(schedules)

    // Special dates in the coming weeks.
    const nextWeekday = (offset: number, allowed: Weekday[]) => {
      let d = addDays(today, offset)
      while (!allowed.includes(new Date(`${d}T12:00:00Z`).getUTCDay() as Weekday)) d = addDays(d, 1)
      return d
    }
    const holiday = nextWeekday(12, [1, 2, 3, 4, 5])
    const earlyClose = nextWeekday(5, [5])
    const leaveStart = nextWeekday(8, [1, 2, 3])
    const training = nextWeekday(3, [1, 2, 3, 4])
    const block = (b: Omit<BlockedDate, 'id' | 'source' | 'createdAt'>): BlockedDate => ({ id: newId(), source: 'demo', createdAt, ...b })
    const blocks: BlockedDate[] = [
      block({ scope: 'business', staffId: null, kind: 'holiday', date: holiday, endDate: holiday, allDay: true, ranges: [], label: 'Community holiday' }),
      block({ scope: 'business', staffId: null, kind: 'special-hours', date: earlyClose, endDate: earlyClose, allDay: false, ranges: [{ start: '08:00', end: '12:00' }], label: 'Early close for inventory' }),
      block({ scope: 'staff', staffId: staff.michael.id, kind: 'leave', date: leaveStart, endDate: addDays(leaveStart, 1), allDay: true, ranges: [], label: 'Annual leave' }),
      block({ scope: 'staff', staffId: staff.alex.id, kind: 'unavailable', date: training, endDate: training, allDay: false, ranges: [{ start: '13:00', end: '15:00' }], label: 'Training session' }),
    ]
    await db.blockedDates.bulkAdd(blocks)

    // Customers registered over the past four months.
    const customers: Customer[] = CUSTOMER_NAMES.map((fullName, i) => {
      const [first, last] = fullName.toLowerCase().split(' ')
      const registered = new Date(currentInstant().getTime() - (120 - i * 3.5) * 86_400_000).toISOString()
      return {
        id: newId(), fullName, email: `${first}.${last}@example.com`, normalizedEmail: `${first}.${last}@example.com`,
        phone: normalizePhone(`555${String(1000000 + Math.floor(rand() * 8999999)).slice(0, 7)}`),
        address: i % 3 === 0 ? `${100 + i * 7} Oak Avenue, Springfield` : '', notes: i % 5 === 0 ? 'Prefers email reminders.' : '',
        lastAppointmentDate: null, source: 'demo', createdAt: registered, updatedAt: registered,
      }
    })

    // Appointments: walk each day, ask the engine for free slots, book a few of them.
    const staffList = Object.values(staff)
    const weights = [services.general, services.general, services.general, services.followUp, services.followUp, services.care, services.care, services.professional, services.maintenance]
    const scheduleMap = new Map(schedules.map((s) => [s.staffId, s]))
    const appointments: Appointment[] = []
    const usedRefs = new Set<string>()

    for (let d = addDays(today, -45); d <= addDays(today, 21); d = addDays(d, 1)) {
      // Busier in the past and near term, thinning out further ahead.
      const base = d <= today ? 6 : Math.max(1, 6 - Math.floor(diffDays(d, today) / 4))
      const target = Math.round(base * (0.6 + rand() * 0.6))
      for (let n = 0; n < target; n++) {
        const service = pick(weights)
        const eligible = getEligibleStaff(service, staffList)
        // Pretend it's the morning of that day so past days can be filled too.
        const result = generateAvailableSlots({
          date: d, durationMinutes: service.durationMinutes, bufferMinutes: service.bufferMinutes,
          staff: eligible.map((s) => ({ id: s.id, schedule: scheduleMap.get(s.id) })),
          businessHours, blocks, appointments, intervalMinutes: 30,
          now: { date: d, minutes: 0 }, minNoticeMinutes: 0, maxAdvanceDays: null,
        })
        if (result.slots.length === 0) continue
        const slot = pick(result.slots)
        const staffId = pick(slot.staffIds)
        const member = staffList.find((s) => s.id === staffId)!
        const customer = pick(customers)
        const overlap = findCustomerOverlap({ customerId: customer.id, date: d, startMinutes: slot.startMinutes, endMinutes: slot.endMinutes }, appointments)
        if (overlap) continue

        const endMinutes = toMinutes(slot.start) + service.durationMinutes
        const ended = d < today || (d === today && endMinutes <= now.minutes)
        const r = rand()
        let status: AppointmentStatus
        if (ended) status = r < 0.76 ? 'completed' : r < 0.86 ? 'cancelled' : r < 0.93 ? 'no-show' : d >= addDays(today, -2) ? 'confirmed' : 'completed'
        else status = r < 0.58 ? 'confirmed' : r < 0.9 ? 'pending' : 'cancelled'

        const bookedDaysBefore = 1 + Math.floor(rand() * 12)
        const booked = new Date(Date.parse(`${addDays(d, -bookedDaysBefore)}T${fromMinutes(420 + Math.floor(rand() * 600))}:00`))
        const bookedAt = (booked.getTime() > currentInstant().getTime() ? currentInstant() : booked).toISOString()
        const history: Appointment['statusHistory'] = [{ status: 'pending', at: bookedAt, by: 'customer' }]
        if (status !== 'pending' && !(status === 'cancelled' && rand() < 0.4)) history.push({ status: 'confirmed', at: bookedAt, by: 'admin' })
        if (status !== 'pending' && status !== 'confirmed') history.push({ status, at: bookedAt, by: status === 'cancelled' && rand() < 0.5 ? 'customer' : 'admin' })

        let reference = generateReference(rand)
        while (usedRefs.has(reference)) reference = generateReference(rand)
        usedRefs.add(reference)

        appointments.push({
          id: newId(), reference,
          customerId: customer.id, customerName: customer.fullName, customerEmail: customer.normalizedEmail, customerPhone: customer.phone,
          serviceId: service.id, serviceName: service.name, staffId: member.id, staffName: member.fullName,
          date: d, startTime: slot.start, endTime: fromMinutes(endMinutes),
          durationMinutes: service.durationMinutes, bufferMinutes: service.bufferMinutes, priceCents: service.priceCents,
          status, statusHistory: history, customerNotes: pick(NOTES), internalNotes: rand() < 0.15 ? 'Repeat client, offer loyalty discount.' : '',
          channel: rand() < 0.45 ? 'portal' : 'admin', createdAt: bookedAt, updatedAt: bookedAt,
          cancelledAt: status === 'cancelled' ? bookedAt : null,
          cancelledBy: status === 'cancelled' ? history.at(-1)!.by : null,
          cancellationReason: status === 'cancelled' ? pick(['Schedule conflict', 'Feeling unwell', 'Booked by mistake', '']) : '',
          source: 'demo',
        })
      }
    }

    // Keep customers' registration before their first visit, and set last-appointment dates.
    for (const c of customers) {
      const mine = appointments.filter((a) => a.customerId === c.id)
      const live = mine.filter((a) => a.status !== 'cancelled').map((a) => a.date).sort()
      c.lastAppointmentDate = live.at(-1) ?? null
      const first = mine.map((a) => a.createdAt).sort()[0]
      if (first && first < c.createdAt) c.createdAt = c.updatedAt = first
    }
    await db.customers.bulkAdd(customers)
    await db.appointments.bulkAdd(appointments)

    await patchAppState({ demoSeededAt: createdAt })
    await logActivity({
      entityType: 'data',
      entityId: null,
      action: 'data.demo-loaded',
      description: `Loaded sample data for BrightSpace Services (${appointments.length} appointments, ${customers.length} customers, ${staffList.length} staff).`,
      actor: 'system',
    })
    await notify({
      type: 'operational',
      title: 'Sample data loaded',
      message: 'BrightSpace Services demo records are tagged as sample data. Remove them any time in Settings → Data.',
      dedupeKey: `demo-loaded:${createdAt}`,
    })
    return { seeded: true, appointments: appointments.length, customers: customers.length }
  })
}

/** For tests and tooling: today's date in the stored business timezone. */
export async function businessToday(): Promise<ISODate> {
  const settings = await getBusinessSettings()
  return businessNow(settings.timezone).date
}
