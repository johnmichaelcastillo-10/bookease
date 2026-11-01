import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { DatePicker } from '@/components/shared/DatePicker'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { staffRepository } from '@/database/repositories/staffRepository'
import { saveBlockedDate } from '@/services/availability/availabilityService'
import { errorMessage } from '@/services/errors'
import type { BlockKind, BlockScope, BlockedDate, ID, ISODate } from '@/types/models'
import { blockedDateInputSchema, type BlockedDateInput } from '@/validation/schemas'
import { KIND_DESCRIPTIONS, KIND_LABELS, KINDS_BY_SCOPE, nextRange } from '../lib'
import { TimeRangeList } from './TimeRangeList'

export interface SpecialDateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this record; omit to create. */
  initial?: BlockedDate | null
  /** Lock the dialog to one staff member (staff profile). */
  fixedStaffId?: ID
  /** Default start date for new records. */
  defaultDate: ISODate
}

function defaults(props: SpecialDateDialogProps): BlockedDateInput {
  const b = props.initial
  if (b) {
    return { scope: b.scope, staffId: b.staffId, kind: b.kind, date: b.date, endDate: b.endDate || b.date, allDay: b.allDay, ranges: b.ranges.map((r) => ({ ...r })), label: b.label }
  }
  const scope: BlockScope = props.fixedStaffId ? 'staff' : 'business'
  return {
    scope,
    staffId: props.fixedStaffId ?? null,
    kind: scope === 'staff' ? 'leave' : 'holiday',
    date: props.defaultDate,
    endDate: props.defaultDate,
    allDay: true,
    ranges: [],
    label: '',
  }
}

/** Create or edit a holiday, closure, special-hours day, staff leave or unavailable period. */
export function SpecialDateDialog(props: SpecialDateDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {/* Remount the form for each open so defaults reflect the record being edited. */}
        {props.open && <SpecialDateForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function SpecialDateForm(props: SpecialDateDialogProps) {
  const { initial, fixedStaffId, onOpenChange } = props
  const staff = useLiveQuery(() => staffRepository.list(), []) ?? []
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BlockedDateInput>({ resolver: zodResolver(blockedDateInputSchema), defaultValues: defaults(props) })

  const scope = useWatch({ control, name: 'scope' })
  const kind = useWatch({ control, name: 'kind' })
  const allDay = useWatch({ control, name: 'allDay' })
  const date = useWatch({ control, name: 'date' })
  const ranges = useWatch({ control, name: 'ranges' })
  const isSpecialHours = kind === 'special-hours'
  const showRanges = isSpecialHours || !allDay

  const onSubmit = async (values: BlockedDateInput) => {
    try {
      const payload: BlockedDateInput = {
        ...values,
        staffId: values.scope === 'staff' ? values.staffId : null,
        allDay: values.kind === 'special-hours' ? false : values.allDay,
        ranges: values.kind !== 'special-hours' && values.allDay ? [] : values.ranges,
      }
      await saveBlockedDate(payload, initial?.id)
      toast.success(initial ? 'Special date updated.' : 'Special date added.')
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const setScope = (next: BlockScope) => {
    setValue('scope', next)
    if (!KINDS_BY_SCOPE[next].includes(kind)) setValue('kind', KINDS_BY_SCOPE[next][0]!)
    if (next === 'business') setValue('staffId', null)
  }

  const setKind = (next: BlockKind) => {
    setValue('kind', next)
    if (next === 'special-hours') {
      setValue('allDay', false)
      if (ranges.length === 0) setValue('ranges', [{ start: '09:00', end: '13:00' }])
    }
  }

  const rangeErrors = (errors.ranges as unknown as ({ start?: { message?: string }; end?: { message?: string } } | undefined)[] | undefined) ?? []
  const rangesRootError = errors.ranges?.message ?? errors.ranges?.root?.message

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{initial ? 'Edit special date' : fixedStaffId ? 'Add time off' : 'Add special date'}</DialogTitle>
        <DialogDescription>{KIND_DESCRIPTIONS[kind]}</DialogDescription>
      </DialogHeader>

      {!fixedStaffId && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormItem label="Applies to" htmlFor="sd-scope">
            <Select value={scope} onValueChange={(v) => setScope(v as BlockScope)}>
              <SelectTrigger id="sd-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="business">Whole business</SelectItem>
                <SelectItem value="staff">One staff member</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
          {scope === 'staff' && (
            <FormItem label="Staff member" htmlFor="sd-staff" error={errors.staffId?.message} required>
              <Controller
                control={control}
                name="staffId"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger id="sd-staff" className="w-full" aria-invalid={!!errors.staffId} aria-describedby={describedBy('sd-staff', errors.staffId?.message)}>
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.fullName}
                          {!s.isActive && ' (inactive)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormItem>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormItem label="Type" htmlFor="sd-kind">
          <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
            <SelectTrigger id="sd-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS_BY_SCOPE[scope].map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
        <FormItem label="Label" htmlFor="sd-label" error={errors.label?.message} required>
          <Input
            id="sd-label"
            placeholder={scope === 'staff' ? 'e.g. Annual leave' : 'e.g. Public holiday'}
            aria-invalid={!!errors.label}
            aria-describedby={describedBy('sd-label', errors.label?.message)}
            {...register('label')}
          />
        </FormItem>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormItem label="From" htmlFor="sd-date" error={errors.date?.message}>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker
                id="sd-date"
                value={field.value}
                onChange={(d) => {
                  field.onChange(d)
                  setValue('endDate', d)
                }}
                aria-invalid={!!errors.date}
              />
            )}
          />
        </FormItem>
        <FormItem label="To" htmlFor="sd-end" error={errors.endDate?.message} description="Same as the start for a single day.">
          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <DatePicker
                id="sd-end"
                value={field.value}
                onChange={field.onChange}
                fromDate={date}
                aria-invalid={!!errors.endDate}
              />
            )}
          />
        </FormItem>
      </div>

      {!isSpecialHours && (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
          <div>
            <label htmlFor="sd-allday" className="text-sm font-medium">
              All day
            </label>
            <p className="text-xs text-muted-foreground">Turn off to block only certain times.</p>
          </div>
          <Controller
            control={control}
            name="allDay"
            render={({ field }) => (
              <Switch
                id="sd-allday"
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked)
                  if (!checked && ranges.length === 0) setValue('ranges', [{ start: '12:00', end: '14:00' }])
                }}
              />
            )}
          />
        </div>
      )}

      {showRanges && (
        <div>
          <p className="mb-1.5 text-sm font-medium">{isSpecialHours ? 'Opening hours on these dates' : 'Unavailable times'}</p>
          <Controller
            control={control}
            name="ranges"
            render={({ field }) => (
              <TimeRangeList
                ranges={field.value}
                onChange={field.onChange}
                onAdd={() => field.onChange([...field.value, nextRange(field.value, { start: '09:00', end: '12:00' })])}
                addLabel="Add time range"
                label={isSpecialHours ? 'Opening hours' : 'Unavailable time'}
                idPrefix="sd-range"
                errors={rangeErrors.map((e) => e?.end?.message ?? e?.start?.message)}
              />
            )}
          />
          {rangesRootError && (
            <p role="alert" className="mt-1 text-xs font-medium text-destructive">
              {rangesRootError}
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {initial ? 'Save changes' : 'Add'}
        </Button>
      </DialogFooter>
    </form>
  )
}
