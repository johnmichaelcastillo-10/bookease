import { db } from '@/database/db'
import { normalizeEmail } from '@/lib/contact'
import type { Appointment, AppointmentStatus, ID, ISODate } from '@/types/models'

export const appointmentsRepository = {
  get(id: ID): Promise<Appointment | undefined> {
    return db.appointments.get(id)
  },
  getByReference(reference: string): Promise<Appointment | undefined> {
    return db.appointments.where('reference').equals(reference).first()
  },
  async referenceExists(reference: string): Promise<boolean> {
    return (await db.appointments.where('reference').equals(reference).count()) > 0
  },
  /** All appointments, newest date first. Use ranges for large views. */
  listAll(): Promise<Appointment[]> {
    return db.appointments.orderBy('date').reverse().toArray()
  },
  listByDate(date: ISODate): Promise<Appointment[]> {
    return db.appointments.where('date').equals(date).toArray()
  },
  /** Inclusive date range via the `date` index. */
  listRange(from: ISODate, to: ISODate): Promise<Appointment[]> {
    return db.appointments.where('date').between(from, to, true, true).toArray()
  },
  listByStaffAndDate(staffId: ID, date: ISODate): Promise<Appointment[]> {
    return db.appointments.where('[staffId+date]').equals([staffId, date]).toArray()
  },
  listByCustomer(customerId: ID): Promise<Appointment[]> {
    return db.appointments.where('customerId').equals(customerId).toArray()
  },
  listByStaff(staffId: ID): Promise<Appointment[]> {
    return db.appointments.where('staffId').equals(staffId).toArray()
  },
  listByEmail(email: string): Promise<Appointment[]> {
    return db.appointments.where('customerEmail').equals(normalizeEmail(email)).toArray()
  },
  listByStatus(status: AppointmentStatus): Promise<Appointment[]> {
    return db.appointments.where('status').equals(status).toArray()
  },
  countByService(serviceId: ID): Promise<number> {
    return db.appointments.where('serviceId').equals(serviceId).count()
  },
  countByCustomer(customerId: ID): Promise<number> {
    return db.appointments.where('customerId').equals(customerId).count()
  },
  count(): Promise<number> {
    return db.appointments.count()
  },
  put(appointment: Appointment): Promise<ID> {
    return db.appointments.put(appointment)
  },
}
