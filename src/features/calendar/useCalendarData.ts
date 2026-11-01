import { useLiveQuery } from 'dexie-react-hooks'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { blockedDatesRepository, businessHoursRepository } from '@/database/repositories/availabilityRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { staffRepository, staffSchedulesRepository } from '@/database/repositories/staffRepository'
import type { Appointment, BlockedDate, BusinessHoursDay, Service, Staff, StaffSchedule } from '@/types/models'
import type { VisibleRange } from './calendarUtils'

export interface CalendarData {
  appointments: Appointment[]
  staff: Staff[]
  services: Service[]
  businessHours: BusinessHoursDay[]
  blocks: BlockedDate[]
  schedules: Map<string, StaffSchedule>
}

/** Loads only the visible date range of appointments, plus the reference data the grid needs. */
export function useCalendarData(range: VisibleRange): CalendarData | undefined {
  const appointments = useLiveQuery(() => appointmentsRepository.listRange(range.from, range.to), [range.from, range.to])
  const blocks = useLiveQuery(() => blockedDatesRepository.listOverlapping(range.from, range.to), [range.from, range.to])
  const reference = useLiveQuery(async () => {
    const [staff, services, businessHours, schedules] = await Promise.all([
      staffRepository.list(),
      servicesRepository.list(),
      businessHoursRepository.list(),
      staffSchedulesRepository.list(),
    ])
    return { staff, services, businessHours, schedules: new Map(schedules.map((s) => [s.staffId, s])) }
  }, [])

  if (!appointments || !blocks || !reference) return undefined
  return { appointments, blocks, ...reference }
}
