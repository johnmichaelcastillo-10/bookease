import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ID, ISODate, TimeHM } from '@/types/models'
import type { BookingDetails } from '@/validation/schemas'

/** The customer's in-progress booking. Lives in sessionStorage: survives refresh, not the tab. */
interface BookingDraft {
  serviceId: ID | null
  /** null with `staffChosen` = "any available". */
  staffId: ID | null
  staffChosen: boolean
  date: ISODate | null
  startTime: TimeHM | null
  details: BookingDetails | null
  /** Reference of the booking just made, for the confirmation page. */
  lastReference: string | null
}

interface BookingDraftState extends BookingDraft {
  selectService: (serviceId: ID) => void
  selectStaff: (staffId: ID | null) => void
  selectDate: (date: ISODate) => void
  selectTime: (startTime: TimeHM | null) => void
  setDetails: (details: BookingDetails) => void
  complete: (reference: string) => void
  reset: () => void
}

const empty: BookingDraft = {
  serviceId: null,
  staffId: null,
  staffChosen: false,
  date: null,
  startTime: null,
  details: null,
  lastReference: null,
}

export const useBookingDraft = create<BookingDraftState>()(
  persist(
    (set) => ({
      ...empty,
      // Changing an earlier step clears the choices that depended on it.
      selectService: (serviceId) => set((s) => ({ ...empty, details: s.details, serviceId })),
      selectStaff: (staffId) => set({ staffId, staffChosen: true, date: null, startTime: null }),
      selectDate: (date) => set({ date, startTime: null }),
      selectTime: (startTime) => set({ startTime }),
      setDetails: (details) => set({ details }),
      complete: (reference) => set((s) => ({ ...empty, details: s.details, lastReference: reference })),
      reset: () => set({ ...empty }),
    }),
    {
      name: 'bookease-booking-draft',
      version: 1,
      storage: createJSONStorage(() => {
        try {
          return window.sessionStorage
        } catch {
          return undefined as unknown as Storage
        }
      }),
    },
  ),
)
