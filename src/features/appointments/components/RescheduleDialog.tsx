import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { LoadingState } from '@/components/feedback/states'
import { DatePicker } from '@/components/shared/DatePicker'
import { FormItem } from '@/components/shared/FormItem'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatISODate, formatTime, formatTimeRange } from '@/lib/format'
import { fromMinutes, toMinutes } from '@/lib/time'
import { rescheduleAppointment } from '@/services/appointments/appointmentService'
import { isReschedulable } from '@/services/appointments/status'
import { getEligibleStaff } from '@/services/availability/engine'
import { errorMessage } from '@/services/errors'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { Appointment, ID, ISODate, TimeHM } from '@/types/models'
import { useAdminSlots } from '../hooks/useAdminSlots'
import { SlotChooser } from './SlotChooser'

export function RescheduleDialog({ id, open, onOpenChange }: { id: ID; open: boolean; onOpenChange: (open: boolean) => void }) {
  const appt = useLiveQuery(async () => (await appointmentsRepository.get(id)) ?? null, [id])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>
            {appt ? `${appt.reference} · ${appt.serviceName} for ${appt.customerName}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>
        {appt === undefined ? (
          <LoadingState />
        ) : appt === null ? (
          <p className="text-sm text-muted-foreground">This appointment no longer exists.</p>
        ) : !isReschedulable(appt.status) ? (
          <p className="text-sm text-muted-foreground">Only pending or confirmed appointments can be rescheduled. This one is {appt.status}.</p>
        ) : (
          <RescheduleForm key={appt.id} appt={appt} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RescheduleForm({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const ctx = useBusinessContext()
  const service = useLiveQuery(() => servicesRepository.get(appt.serviceId), [appt.serviceId])
  const staff = useLiveQuery(() => staffRepository.list(), [])
  const openDetails = useAppointmentUi((s) => s.openDetails)
  const [staffId, setStaffId] = useState<ID>(appt.staffId)
  const [date, setDate] = useState<ISODate>(appt.date)
  const [time, setTime] = useState<TimeHM | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const staffOptions = useMemo(() => {
    if (!staff) return []
    // The service may have been deleted or changed since booking; fall back to active staff.
    const eligible = service ? getEligibleStaff(service, staff) : staff.filter((s) => s.isActive)
    return eligible
  }, [service, staff])

  const slots = useAdminSlots({
    serviceId: service ? appt.serviceId : null,
    staffId,
    date,
    excludeAppointmentId: appt.id,
    durationMinutes: appt.durationMinutes,
    bufferMinutes: appt.bufferMinutes,
  })

  async function save() {
    if (!time) {
      setError('Choose a new time.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await rescheduleAppointment(appt.id, { date, startTime: time, staffId })
      toast.success(`Moved ${appt.reference} to ${formatISODate(date)} at ${formatTime(time)}.`)
      openDetails(appt.id)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!ctx || staff === undefined || service === undefined) return <LoadingState />
  const unchanged = date === appt.date && time === appt.startTime && staffId === appt.staffId
  const newEnd = time ? fromMinutes(toMinutes(time) + appt.durationMinutes) : null

  return (
    <div className="grid gap-4">
      <div className="rounded-md bg-muted px-3 py-2 text-sm">
        <span className="text-muted-foreground">Currently </span>
        {formatISODate(appt.date)}, {formatTimeRange(appt.startTime, appt.endTime)} with {appt.staffName}
      </div>
      {!service && (
        <p className="text-sm text-destructive">The service on this appointment no longer exists, so it can't be rescheduled. Cancel it and book again.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormItem label="Date" htmlFor="resched-date" required>
          <DatePicker
            id="resched-date"
            value={date}
            onChange={(d) => {
              setDate(d)
              setTime(null)
            }}
            fromDate={ctx.now.date}
          />
        </FormItem>
        <FormItem label="Staff member" htmlFor="resched-staff" required>
          <Select
            value={staffId}
            onValueChange={(v) => {
              setStaffId(v)
              setTime(null)
            }}
          >
            <SelectTrigger id="resched-staff" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!staffOptions.some((s) => s.id === appt.staffId) && (
                <SelectItem value={appt.staffId} disabled>
                  {appt.staffName} (unavailable)
                </SelectItem>
              )}
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      </div>
      <div className="grid gap-1.5">
        <p className="text-sm font-medium">New time</p>
        <SlotChooser state={slots} value={time} onChange={setTime} />
      </div>
      {time && newEnd && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">New:</span>
          {formatISODate(date)}, {formatTimeRange(time, newEnd)}
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          {staffOptions.find((s) => s.id === staffId)?.fullName ?? appt.staffName}
        </p>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={saving || !service || !time || unchanged}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Reschedule
        </Button>
      </DialogFooter>
    </div>
  )
}
