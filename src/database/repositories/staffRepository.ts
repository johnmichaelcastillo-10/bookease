import { db } from '@/database/db'
import type { ID, Staff, StaffSchedule } from '@/types/models'

export const staffRepository = {
  list(): Promise<Staff[]> {
    return db.staff.orderBy('fullName').toArray()
  },
  listActive(): Promise<Staff[]> {
    return db.staff.orderBy('fullName').filter((s) => s.isActive).toArray()
  },
  get(id: ID): Promise<Staff | undefined> {
    return db.staff.get(id)
  },
  put(staff: Staff): Promise<ID> {
    return db.staff.put(staff)
  },
  listByService(serviceId: ID): Promise<Staff[]> {
    return db.staff.where('serviceIds').equals(serviceId).toArray()
  },
}

export const staffSchedulesRepository = {
  list(): Promise<StaffSchedule[]> {
    return db.staffSchedules.toArray()
  },
  get(staffId: ID): Promise<StaffSchedule | undefined> {
    return db.staffSchedules.get(staffId)
  },
  put(schedule: StaffSchedule): Promise<string> {
    return db.staffSchedules.put(schedule)
  },
}
