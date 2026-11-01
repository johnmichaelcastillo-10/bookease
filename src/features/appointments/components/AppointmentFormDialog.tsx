import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { LoadingState } from '@/components/feedback/states'
import { DatePicker } from '@/components/shared/DatePicker'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatDuration, formatMoney, formatTimeRange } from '@/lib/format'
import { isValidISODate, isValidTime } from '@/lib/time'
import { createAppointment, updateAppointment } from '@/services/appointments/appointmentService'
import { isReschedulable } from '@/services/appointments/status'
import { getEligibleStaff } from '@/services/availability/engine'
import { errorMessage } from '@/services/errors'
import { useAppointmentUi, type AppointmentPrefill } from '@/store/appointmentUiStore'
import type { Appointment, ID } from '@/types/models'
import { appointmentInputSchema, type AppointmentInput } from '@/validation/schemas'
import { CustomerPicker } from './CustomerPicker'
import { useAdminSlots } from '../hooks/useAdminSlots'
import { SlotChooser } from './SlotChooser'

/** Same rules as the service schema, with messages that fit an empty form. */
const formSchema = appointmentInputSchema.extend({
  date: z.string().min(1, 'Choose a date.').refine(isValidISODate, 'Choose a valid date.'),
  startTime: z.string().min(1, 'Choose an available time.').refine(isValidTime, 'Enter a valid time (HH:mm).'),
})

export function AppointmentFormDialog(props: { open: boolean; onOpenChange: (open: boolean) => void } & ({ mode: 'create'; prefill: AppointmentPrefill } | { mode: 'edit'; id: ID })) {
  const editId = props.mode === 'edit' ? props.id : null
  const existing = useLiveQuery(async () => (editId ? ((await appointmentsRepository.get(editId)) ?? null) : null), [editId])

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.mode === 'create' ? 'New appointment' : 'Edit appointment'}</DialogTitle>
          <DialogDescription>
            {props.mode === 'create'
              ? 'Only free times are offered: hours, breaks, closures and existing bookings are checked again when you save.'
              : existing
                ? `${existing.reference} · changes to the time or staff are re-validated when you save.`
                : 'Loading…'}
          </DialogDescription>
        </DialogHeader>
        {props.mode === 'edit' && existing === undefined ? (
          <LoadingState />
        ) : props.mode === 'edit' && existing === null ? (
          <p className="text-sm text-muted-foreground">This appointment no longer exists.</p>
        ) : (
          <AppointmentForm
            key={existing?.id ?? 'new'}
            existing={existing ?? null}
            prefill={props.mode === 'create' ? props.prefill : {}}
            onDone={() => props.onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AppointmentForm({ existing, prefill, onDone }: { existing: Appointment | null; prefill: AppointmentPrefill; onDone: () => void }) {
  const ctx = useBusinessContext()
  const services = useLiveQuery(() => servicesRepository.list(), [])
  const staff = useLiveQuery(() => staffRepository.list(), [])
  const openDetails = useAppointmentUi((s) => s.openDetails)
  const locked = existing !== null && !isReschedulable(existing.status)

  const form = useForm<AppointmentInput>({
    resolver: zodResolver(formSchema),
    defaultValues: existing
      ? {
          customerId: existing.customerId,
          serviceId: existing.serviceId,
          staffId: existing.staffId,
          date: existing.date,
          startTime: existing.startTime,
          customerNotes: existing.customerNotes,
          internalNotes: existing.internalNotes,
        }
      : {
          customerId: prefill.customerId ?? '',
          serviceId: prefill.serviceId ?? '',
          staffId: prefill.staffId ?? '',
          date: prefill.date ?? '',
          startTime: prefill.startTime ?? '',
          customerNotes: '',
          internalNotes: '',
        },
  })
  const { errors, isSubmitting } = form.formState
  const [serviceId, staffId, date, startTime] = useWatch({ control: form.control, name: ['serviceId', 'staffId', 'date', 'startTime'] })

  const service = services?.find((s) => s.id === serviceId)
  const serviceOptions = useMemo(
    () => (services ?? []).filter((s) => s.isActive || s.id === existing?.serviceId),
    [services, existing?.serviceId],
  )
  const staffOptions = useMemo(() => {
    if (!service || !staff) return []
    const eligible = getEligibleStaff(service, staff)
    const current = existing && staff.find((s) => s.id === existing.staffId)
    return current && !eligible.some((s) => s.id === current.id) ? [...eligible, current] : eligible
  }, [service, staff, existing])

  // When the service is unchanged the appointment keeps its own duration/buffer snapshot.
  const keepsSnapshot = existing !== null && serviceId === existing.serviceId
  const slots = useAdminSlots({
    serviceId,
    staffId,
    date,
    excludeAppointmentId: existing?.id,
    durationMinutes: keepsSnapshot ? existing.durationMinutes : undefined,
    bufferMinutes: keepsSnapshot ? existing.bufferMinutes : undefined,
  })

  const set = (name: 'serviceId' | 'staffId' | 'date' | 'startTime', value: string) =>
    form.setValue(name, value, { shouldValidate: form.formState.isSubmitted, shouldDirty: true })

  function changeService(id: string) {
    set('serviceId', id)
    const next = services?.find((s) => s.id === id)
    const eligible = next && staff ? getEligibleStaff(next, staff) : []
    if (!eligible.some((s) => s.id === form.getValues('staffId'))) set('staffId', eligible.length === 1 ? eligible[0]!.id : '')
    set('startTime', '')
  }

  async function onSubmit(values: AppointmentInput) {
    try {
      if (existing) {
        await updateAppointment(existing.id, values)
        toast.success(`Saved ${existing.reference}.`)
        openDetails(existing.id)
      } else {
        const created = await createAppointment(values)
        toast.success(`Appointment ${created.reference} created.`)
        openDetails(created.id)
      }
    } catch (error) {
      form.setError('root', { message: errorMessage(error) })
    }
  }

  if (!ctx || !services || !staff) return <LoadingState />
  const currency = ctx.settings.currency

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {locked && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          This appointment is {existing.status}. Only its notes can be changed.
        </p>
      )}

      <FormItem label="Customer" htmlFor="appt-customer" error={errors.customerId?.message} required>
        <Controller
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <CustomerPicker
              id="appt-customer"
              value={field.value}
              onChange={(v) => form.setValue('customerId', v, { shouldValidate: form.formState.isSubmitted, shouldDirty: true })}
              disabled={locked}
              invalid={!!errors.customerId}
              describedById={describedBy('appt-customer', errors.customerId?.message)}
            />
          )}
        />
      </FormItem>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormItem
          label="Service"
          htmlFor="appt-service"
          error={errors.serviceId?.message}
          required
          description={service ? `${formatDuration(keepsSnapshot ? existing.durationMinutes : service.durationMinutes)} · ${formatMoney(keepsSnapshot ? existing.priceCents : service.priceCents, currency)}` : undefined}
        >
          <Select value={serviceId || undefined} onValueChange={changeService} disabled={locked}>
            <SelectTrigger id="appt-service" className="w-full" aria-invalid={!!errors.serviceId} aria-describedby={describedBy('appt-service', errors.serviceId?.message, !!service)}>
              <SelectValue placeholder="Select a service" />
            </SelectTrigger>
            <SelectContent>
              {serviceOptions.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No active services. Add one under Services.</p>}
              {serviceOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {!s.isActive && ' (inactive)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>

        <FormItem label="Staff member" htmlFor="appt-staff" error={errors.staffId?.message} required>
          <Select
            value={staffId || undefined}
            onValueChange={(v) => {
              set('staffId', v)
              set('startTime', '')
            }}
            disabled={locked || !service}
          >
            <SelectTrigger id="appt-staff" className="w-full" aria-invalid={!!errors.staffId} aria-describedby={describedBy('appt-staff', errors.staffId?.message)}>
              <SelectValue placeholder={service ? 'Select staff' : 'Choose a service first'} />
            </SelectTrigger>
            <SelectContent>
              {service && staffOptions.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No active staff can perform this service.</p>}
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.fullName}
                  {!s.isActive && ' (inactive)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      </div>

      <FormItem label="Date" htmlFor="appt-date" error={errors.date?.message} required>
        <DatePicker
          id="appt-date"
          value={date || null}
          onChange={(d) => {
            set('date', d)
            set('startTime', '')
          }}
          fromDate={ctx.now.date}
          aria-invalid={!!errors.date}
          className={locked ? 'pointer-events-none opacity-60' : undefined}
        />
      </FormItem>

      <div className="grid gap-1.5">
        <p className="flex gap-1 text-sm font-medium" id="appt-time-label">
          Time<span className="text-destructive" aria-hidden>*</span>
        </p>
        {locked ? (
          <p className="text-sm text-muted-foreground">{formatTimeRange(existing.startTime, existing.endTime)}</p>
        ) : (
          <div aria-labelledby="appt-time-label">
            <SlotChooser state={slots} value={startTime || null} onChange={(t) => set('startTime', t)} currentTime={existing?.startTime} />
          </div>
        )}
        {errors.startTime && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.startTime.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormItem label="Customer notes" htmlFor="appt-customer-notes" error={errors.customerNotes?.message} description="Visible on the booking.">
          <Textarea id="appt-customer-notes" rows={3} {...form.register('customerNotes')} />
        </FormItem>
        <FormItem label="Internal notes" htmlFor="appt-internal-notes" error={errors.internalNotes?.message} description="Only staff see these.">
          <Textarea id="appt-internal-notes" rows={3} {...form.register('internalNotes')} />
        </FormItem>
      </div>

      {errors.root && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.root.message}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {existing ? 'Save changes' : 'Create appointment'}
        </Button>
      </DialogFooter>
    </form>
  )
}
