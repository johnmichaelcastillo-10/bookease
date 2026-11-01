import { useLiveQuery } from 'dexie-react-hooks'
import { generateSlotsFor } from '@/services/availability/availabilityService'
import type { SlotResult } from '@/services/availability/engine'
import { errorMessage } from '@/services/errors'
import type { ID, ISODate } from '@/types/models'

interface SlotQueryParams {
  serviceId: ID | null | undefined
  staffId: ID | null | undefined
  date: ISODate | null | undefined
  excludeAppointmentId?: ID
  durationMinutes?: number
  bufferMinutes?: number
}

export type SlotState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; result: SlotResult } | { status: 'error'; message: string }

/**
 * Admin slots for a service + staff member + date. Live: recomputes when appointments,
 * hours or special dates change in IndexedDB (in this or another tab).
 */
export function useAdminSlots(params: SlotQueryParams): SlotState {
  const { serviceId, staffId, date, excludeAppointmentId, durationMinutes, bufferMinutes } = params
  const ready = Boolean(serviceId && staffId && date)
  const result = useLiveQuery(async (): Promise<SlotState> => {
    if (!serviceId || !staffId || !date) return { status: 'idle' }
    try {
      const r = await generateSlotsFor({ serviceId, staffId, date, actor: 'admin', excludeAppointmentId, durationMinutes, bufferMinutes })
      return { status: 'ready', result: r }
    } catch (error) {
      return { status: 'error', message: errorMessage(error) }
    }
  }, [serviceId, staffId, date, excludeAppointmentId, durationMinutes, bufferMinutes])
  if (!ready) return { status: 'idle' }
  return result ?? { status: 'loading' }
}

