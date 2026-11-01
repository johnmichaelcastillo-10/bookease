import { useAppointmentUi } from '@/store/appointmentUiStore'
import { AppointmentDetailsSheet } from './AppointmentDetailsSheet'
import { AppointmentFormDialog } from './AppointmentFormDialog'
import { RescheduleDialog } from './RescheduleDialog'

/**
 * Mounted once in the admin layout. Any page opens these through `useAppointmentUi`
 * (openDetails / openCreate / openEdit / openReschedule).
 */
export function AppointmentDialogs() {
  const dialog = useAppointmentUi((s) => s.dialog)
  const close = useAppointmentUi((s) => s.close)
  const onOpenChange = (open: boolean) => {
    if (!open) close()
  }

  switch (dialog.kind) {
    case 'details':
      return <AppointmentDetailsSheet key={dialog.id} id={dialog.id} open onOpenChange={onOpenChange} />
    case 'create':
      return <AppointmentFormDialog mode="create" prefill={dialog.prefill} open onOpenChange={onOpenChange} />
    case 'edit':
      return <AppointmentFormDialog key={dialog.id} mode="edit" id={dialog.id} open onOpenChange={onOpenChange} />
    case 'reschedule':
      return <RescheduleDialog key={dialog.id} id={dialog.id} open onOpenChange={onOpenChange} />
    case 'none':
      return null
  }
}
