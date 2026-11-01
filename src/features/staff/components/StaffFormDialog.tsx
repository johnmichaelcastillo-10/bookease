import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Loader2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { staffColor } from '@/components/shared/StaffBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { formatPhone } from '@/lib/contact'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/services/errors'
import { STAFF_COLORS } from '@/services/settings/defaults'
import { createStaff, updateStaff } from '@/services/staff/staffService'
import type { Staff } from '@/types/models'
import { staffInputSchema, type StaffInput } from '@/validation/schemas'

export function StaffFormDialog({
  open,
  onOpenChange,
  staff,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this staff member; omit to add a new one. */
  staff?: Staff | null
  onSaved?: (staff: Staff) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {open && <StaffForm staff={staff ?? null} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function StaffForm({ staff, onClose, onSaved }: { staff: Staff | null; onClose: () => void; onSaved?: (staff: Staff) => void }) {
  const services = useLiveQuery(() => servicesRepository.list(), []) ?? []
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffInput>({
    resolver: zodResolver(staffInputSchema),
    defaultValues: staff
      ? {
          fullName: staff.fullName,
          email: staff.email,
          phone: staff.phone ? formatPhone(staff.phone) : '',
          position: staff.position,
          description: staff.description,
          serviceIds: [...staff.serviceIds],
          isActive: staff.isActive,
          color: staff.color,
        }
      : { fullName: '', email: '', phone: '', position: '', description: '', serviceIds: [], isActive: true, color: STAFF_COLORS[0] },
  })

  const onSubmit = async (values: StaffInput) => {
    try {
      const saved = staff ? await updateStaff(staff.id, values) : await createStaff(values)
      toast.success(staff ? 'Staff member updated.' : `${saved.fullName} was added.`)
      onSaved?.(saved)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{staff ? 'Edit staff member' : 'Add staff member'}</DialogTitle>
        <DialogDescription>Staff members are the people customers book with.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormItem label="Full name" htmlFor="staff-name" error={errors.fullName?.message} required className="sm:col-span-2">
          <Input id="staff-name" autoComplete="off" aria-invalid={!!errors.fullName} aria-describedby={describedBy('staff-name', errors.fullName?.message)} {...register('fullName')} />
        </FormItem>
        <FormItem label="Email" htmlFor="staff-email" error={errors.email?.message}>
          <Input id="staff-email" type="email" autoComplete="off" aria-invalid={!!errors.email} aria-describedby={describedBy('staff-email', errors.email?.message)} {...register('email')} />
        </FormItem>
        <FormItem label="Phone" htmlFor="staff-phone" error={errors.phone?.message}>
          <Input id="staff-phone" type="tel" autoComplete="off" aria-invalid={!!errors.phone} aria-describedby={describedBy('staff-phone', errors.phone?.message)} {...register('phone')} />
        </FormItem>
        <FormItem label="Position" htmlFor="staff-position" error={errors.position?.message} className="sm:col-span-2">
          <Input id="staff-position" placeholder="e.g. Senior Consultant" aria-invalid={!!errors.position} {...register('position')} />
        </FormItem>
        <FormItem label="Description" htmlFor="staff-description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="staff-description" rows={2} aria-invalid={!!errors.description} {...register('description')} />
        </FormItem>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Services</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          Required for services set to “assigned staff only”. Services open to any staff don’t need a tick.
        </p>
        <Controller
          control={control}
          name="serviceIds"
          render={({ field }) =>
            services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services yet.</p>
            ) : (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {services.map((s) => {
                  const id = `staff-svc-${s.id}`
                  const checked = field.value.includes(s.id)
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(on) => field.onChange(on ? [...field.value, s.id] : field.value.filter((v) => v !== s.id))}
                      />
                      <label htmlFor={id} className="min-w-0 truncate text-sm">
                        {s.name}
                        {!s.isActive && <span className="text-muted-foreground"> (inactive)</span>}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )
          }
        />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Calendar colour</legend>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Calendar colour" className="flex flex-wrap gap-2">
              {STAFF_COLORS.map((c) => {
                const selected = field.value === c
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={c}
                    onClick={() => field.onChange(c)}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:outline-2 focus-visible:outline-ring',
                      staffColor(c).dot,
                      selected && 'ring-2 ring-foreground',
                    )}
                  >
                    {selected && <Check className="size-4 text-white" aria-hidden />}
                  </button>
                )
              })}
            </div>
          )}
        />
      </fieldset>

      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
        <div>
          <label htmlFor="staff-active" className="text-sm font-medium">
            Active
          </label>
          <p className="text-xs text-muted-foreground">Inactive staff keep their history but can’t receive new bookings.</p>
        </div>
        <Controller control={control} name="isActive" render={({ field }) => <Switch id="staff-active" checked={field.value} onCheckedChange={field.onChange} />} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {staff ? 'Save changes' : 'Add staff member'}
        </Button>
      </DialogFooter>
    </form>
  )
}
