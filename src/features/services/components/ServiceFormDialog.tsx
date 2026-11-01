import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { centsToAmount } from '@/lib/format'
import { createService, updateService } from '@/services/catalog/catalogService'
import { errorMessage } from '@/services/errors'
import type { Service, ServiceCategory } from '@/types/models'
import { serviceInputSchema, type ServiceInput } from '@/validation/schemas'

function toFormValues(service: Service | null, categories: ServiceCategory[]): ServiceInput {
  if (service) {
    return {
      name: service.name,
      description: service.description,
      categoryId: service.categoryId,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      price: centsToAmount(service.priceCents),
      isActive: service.isActive,
      staffMode: service.staffMode,
    }
  }
  return {
    name: '',
    description: '',
    categoryId: categories[0]?.id ?? '',
    durationMinutes: 30,
    bufferMinutes: 0,
    price: 0,
    isActive: true,
    staffMode: 'any',
  }
}

/** Create or edit a service. `service` null = create. */
export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  categories,
  currency,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: Service | null
  categories: ServiceCategory[]
  currency: string
  onSaved?: (service: Service) => void
}) {
  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceInputSchema),
    defaultValues: toFormValues(service, categories),
  })
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form

  useEffect(() => {
    if (open) reset(toFormValues(service, categories))
    // Reset only when the dialog opens or switches record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service?.id])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = service ? await updateService(service.id, values) : await createService(values)
      toast.success(service ? `Saved "${saved.name}".` : `Added "${saved.name}".`)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  })

  const noCategories = categories.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? 'Edit service' : 'New service'}</DialogTitle>
          <DialogDescription>
            {service ? 'Changes apply to bookings made from now on.' : 'Services appear on the booking page while they are active.'}
          </DialogDescription>
        </DialogHeader>

        {service && (
          <p className="flex gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            Existing appointments keep the name, duration and price they were booked with.
          </p>
        )}

        <form id="service-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormItem label="Service name" htmlFor="svc-name" error={errors.name?.message} required>
            <Input id="svc-name" autoComplete="off" aria-invalid={!!errors.name} aria-describedby={describedBy('svc-name', errors.name?.message)} {...register('name')} />
          </FormItem>

          <FormItem label="Description" htmlFor="svc-description" error={errors.description?.message} description="Shown to customers on the booking page.">
            <Textarea
              id="svc-description"
              rows={3}
              aria-invalid={!!errors.description}
              aria-describedby={describedBy('svc-description', errors.description?.message, true)}
              {...register('description')}
            />
          </FormItem>

          <FormItem
            label="Category"
            htmlFor="svc-category"
            error={errors.categoryId?.message ?? (noCategories ? 'Create a category first (Manage categories).' : undefined)}
            required
          >
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={noCategories}>
                  <SelectTrigger id="svc-category" className="w-full" aria-invalid={!!errors.categoryId}>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormItem>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormItem label="Duration (min)" htmlFor="svc-duration" error={errors.durationMinutes?.message} required>
              <Input
                id="svc-duration"
                type="number"
                inputMode="numeric"
                min={5}
                step={5}
                aria-invalid={!!errors.durationMinutes}
                aria-describedby={describedBy('svc-duration', errors.durationMinutes?.message)}
                {...register('durationMinutes', { valueAsNumber: true })}
              />
            </FormItem>
            <FormItem label="Buffer after (min)" htmlFor="svc-buffer" error={errors.bufferMinutes?.message}>
              <Input
                id="svc-buffer"
                type="number"
                inputMode="numeric"
                min={0}
                step={5}
                aria-invalid={!!errors.bufferMinutes}
                aria-describedby={describedBy('svc-buffer', errors.bufferMinutes?.message)}
                {...register('bufferMinutes', { valueAsNumber: true })}
              />
            </FormItem>
            <FormItem label={`Price (${currency})`} htmlFor="svc-price" error={errors.price?.message} required>
              <Input
                id="svc-price"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                aria-invalid={!!errors.price}
                aria-describedby={describedBy('svc-price', errors.price?.message)}
                {...register('price', { valueAsNumber: true })}
              />
            </FormItem>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Buffer time blocks the staff member after each appointment (clean-up or travel) and isn’t shown to customers.
          </p>

          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">Who can perform it</legend>
            <Controller
              control={control}
              name="staffMode"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2">
                  <Label htmlFor="mode-any" className="flex items-start gap-2.5 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-brand-soft/40">
                    <RadioGroupItem id="mode-any" value="any" className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">Any staff member</span>
                      <span className="block text-xs text-muted-foreground">Every active staff member can take this booking.</span>
                    </span>
                  </Label>
                  <Label htmlFor="mode-assigned" className="flex items-start gap-2.5 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-brand-soft/40">
                    <RadioGroupItem id="mode-assigned" value="assigned" className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">Assigned staff only</span>
                      <span className="block text-xs text-muted-foreground">Only staff with this service on their profile (Staff → services).</span>
                    </span>
                  </Label>
                </RadioGroup>
              )}
            />
          </fieldset>

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <Label htmlFor="svc-active" className="grid gap-0.5 font-normal">
                  <span className="text-sm font-medium">Active</span>
                  <span className="text-xs text-muted-foreground">Inactive services can’t be booked but keep their history.</span>
                </Label>
                <Switch id="svc-active" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </form>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="service-form" disabled={isSubmitting || noCategories}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {service ? 'Save changes' : 'Create service'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
