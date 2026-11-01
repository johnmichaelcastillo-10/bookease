import { create } from 'zustand'
import type { ID, ISODate, TimeHM } from '@/types/models'

/**
 * Opens appointment dialogs from anywhere in the admin (calendar, dashboard, customer and
 * staff profiles). `AppointmentDialogs`, mounted once in the admin layout, renders them.
 */
export interface AppointmentPrefill {
  customerId?: ID
  serviceId?: ID
  staffId?: ID
  date?: ISODate
  startTime?: TimeHM
}

type Dialog =
  | { kind: 'none' }
  | { kind: 'details'; id: ID }
  | { kind: 'create'; prefill: AppointmentPrefill }
  | { kind: 'edit'; id: ID }
  | { kind: 'reschedule'; id: ID }

interface AppointmentUiState {
  dialog: Dialog
  openDetails: (id: ID) => void
  openCreate: (prefill?: AppointmentPrefill) => void
  openEdit: (id: ID) => void
  openReschedule: (id: ID) => void
  close: () => void
}

export const useAppointmentUi = create<AppointmentUiState>((set) => ({
  dialog: { kind: 'none' },
  openDetails: (id) => set({ dialog: { kind: 'details', id } }),
  openCreate: (prefill = {}) => set({ dialog: { kind: 'create', prefill } }),
  openEdit: (id) => set({ dialog: { kind: 'edit', id } }),
  openReschedule: (id) => set({ dialog: { kind: 'reschedule', id } }),
  close: () => set({ dialog: { kind: 'none' } }),
}))
