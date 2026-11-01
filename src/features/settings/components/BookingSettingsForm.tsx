import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatDuration } from '@/lib/format'
import { errorMessage } from '@/services/errors'
import { updateBookingSettings } from '@/services/settings/settingsService'
import type { BusinessSettings } from '@/types/models'
import { bookingSettingsSchema, type BookingSettingsInput } from '@/validation/schemas'

const NOTICE_PRESETS = [0, 15, 30, 60, 120, 240, 720, 1440, 2880, 4320, 10080]
const INTERVALS = [5, 10, 15, 20, 30, 45, 60]

function noticeLabel(minutes: number): string {
  if (minutes === 0) return 'No minimum (book up to the start time)'
  if (minutes % 1440 === 0) return minutes === 10080 ? '1 week' : `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`
  return formatDuration(minutes)
}

function toFormValues(s: BusinessSettings): BookingSettingsInput {
  return {
    minNoticeMinutes: s.minNoticeMinutes,
    maxAdvanceDays: s.maxAdvanceDays,
    slotIntervalMinutes: s.slotIntervalMinutes,
    cancellationNoticeHours: s.cancellationNoticeHours,
    allowCustomerCancellation: s.allowCustomerCancellation,
    allowStaffSelection: s.allowStaffSelection,
    defaultStatus: s.defaultStatus,
  }
}

function SwitchRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p id={`${id}-description`} className="mt-0.5 text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-description`} />
    </div>
  )
}

export function BookingSettingsForm({ settings }: { settings: BusinessSettings }) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BookingSettingsInput>({
    resolver: zodResolver(bookingSettingsSchema),
    defaultValues: toFormValues(settings),
  })
  const allowCancel = useWatch({ control, name: 'allowCustomerCancellation' })
  const notice = useWatch({ control, name: 'minNoticeMinutes' })
  const noticeOptions = NOTICE_PRESETS.includes(notice) ? NOTICE_PRESETS : [...NOTICE_PRESETS, notice].sort((a, b) => a - b)

  async function onSubmit(values: BookingSettingsInput) {
    try {
      const saved = await updateBookingSettings(values)
      reset(toFormValues(saved))
      toast.success('Booking rules saved.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Booking rules"
        description="Applied to the customer booking portal. Administrators can book any open time that isn’t in the past."
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 p-4 sm:grid-cols-2">
        <FormItem
          label="Minimum booking notice"
          htmlFor="bs-notice"
          error={errors.minNoticeMinutes?.message}
          description="How far ahead customers must book. Slots closer than this are hidden."
        >
          <Controller
            control={control}
            name="minNoticeMinutes"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                <SelectTrigger id="bs-notice" className="w-full" aria-describedby={describedBy('bs-notice', errors.minNoticeMinutes?.message, true)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {noticeOptions.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {noticeLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormItem>

        <FormItem
          label="Maximum advance booking (days)"
          htmlFor="bs-advance"
          error={errors.maxAdvanceDays?.message}
          description="The furthest date customers can pick, counted from today."
        >
          <Input
            id="bs-advance"
            type="number"
            inputMode="numeric"
            min={1}
            max={730}
            {...register('maxAdvanceDays', { valueAsNumber: true })}
            aria-invalid={!!errors.maxAdvanceDays}
            aria-describedby={describedBy('bs-advance', errors.maxAdvanceDays?.message, true)}
          />
        </FormItem>

        <FormItem
          label="Slot interval"
          htmlFor="bs-interval"
          error={errors.slotIntervalMinutes?.message}
          description="Start times are offered every this many minutes (e.g. :00, :15, :30)."
        >
          <Controller
            control={control}
            name="slotIntervalMinutes"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                <SelectTrigger id="bs-interval" className="w-full" aria-describedby={describedBy('bs-interval', errors.slotIntervalMinutes?.message, true)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(INTERVALS.includes(field.value) ? INTERVALS : [...INTERVALS, field.value].sort((a, b) => a - b)).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      Every {formatDuration(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormItem>

        <FormItem
          label="Cancellation notice (hours)"
          htmlFor="bs-cancel"
          error={errors.cancellationNoticeHours?.message}
          description="Customers can cancel online until this many hours before the start."
        >
          <Input
            id="bs-cancel"
            type="number"
            inputMode="numeric"
            min={0}
            disabled={!allowCancel}
            {...register('cancellationNoticeHours', { valueAsNumber: true })}
            aria-invalid={!!errors.cancellationNoticeHours}
            aria-describedby={describedBy('bs-cancel', errors.cancellationNoticeHours?.message, true)}
          />
        </FormItem>

        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          <Controller
            control={control}
            name="allowCustomerCancellation"
            render={({ field }) => (
              <SwitchRow
                id="bs-allow-cancel"
                label="Allow online cancellation"
                description="Customers can cancel from “My booking” with their reference and email."
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="allowStaffSelection"
            render={({ field }) => (
              <SwitchRow
                id="bs-allow-staff"
                label="Let customers choose staff"
                description="When off, bookings go to any available qualified staff member."
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Status of new online bookings</legend>
          <Controller
            control={control}
            name="defaultStatus"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['pending', 'Pending', 'You confirm each booking yourself.'],
                    ['confirmed', 'Confirmed', 'Bookings are confirmed as soon as they are made.'],
                  ] as const
                ).map(([value, label, help]) => (
                  <Label key={value} htmlFor={`bs-status-${value}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-data-checked:border-primary/50 has-data-checked:bg-brand-soft/40">
                    <RadioGroupItem id={`bs-status-${value}`} value={value} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">{help}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            )}
          />
        </fieldset>

        <div className="flex justify-end gap-2 border-t pt-4 sm:col-span-2">
          <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset(toFormValues(settings))}>
            Discard changes
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save rules
          </Button>
        </div>
      </form>
    </Panel>
  )
}
