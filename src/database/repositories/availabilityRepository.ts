import { db } from '@/database/db'
import type { BlockedDate, BusinessHoursDay, ID, ISODate } from '@/types/models'

export const businessHoursRepository = {
  list(): Promise<BusinessHoursDay[]> {
    return db.businessHours.orderBy('weekday').toArray()
  },
  putAll(days: BusinessHoursDay[]): Promise<unknown> {
    return db.businessHours.bulkPut(days)
  },
}

export const blockedDatesRepository = {
  list(): Promise<BlockedDate[]> {
    return db.blockedDates.orderBy('date').toArray()
  },
  /** Blocks that start on or before `to` and end on or after `from`. */
  async listOverlapping(from: ISODate, to: ISODate): Promise<BlockedDate[]> {
    const startedBefore = await db.blockedDates.where('date').belowOrEqual(to).toArray()
    return startedBefore.filter((b) => (b.endDate || b.date) >= from)
  },
  get(id: ID): Promise<BlockedDate | undefined> {
    return db.blockedDates.get(id)
  },
  put(block: BlockedDate): Promise<ID> {
    return db.blockedDates.put(block)
  },
  delete(id: ID): Promise<void> {
    return db.blockedDates.delete(id)
  },
}
