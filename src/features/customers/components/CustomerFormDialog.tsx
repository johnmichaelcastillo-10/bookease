import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatPhone } from '@/lib/contact'
import { formatTimestamp } from '@/lib/format'
import { createCustomer, DuplicateCustomerError, updateCustomer } from '@/services/customers/customerService'
import { errorMessage } from '@/services/errors'
import type { Customer } from '@/types/models'
import { customerInputSchema, type CustomerInput } from '@/validation/schemas'

function toFormValues(customer: Customer | null): CustomerInput {
  return customer
    ? { fullName: customer.fullName, email: customer.email, phone: formatPhone(customer.phone), address: customer.address, notes: customer.notes }
    : { fullName: '', email: '', phone: '', address: '', notes: '' }
}

/**
 * Add or edit a customer. When the email already belongs to another record the service
 * refuses; the dialog then shows the match and lets the admin open it or confirm a separate
 * record on purpose (e.g. a shared family address).
 */
export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSaved?: (customer: Customer) => void
}) {
  const [duplicates, setDuplicates] = useState<Customer[] | null>(null)
  const [savingAnyway, setSavingAnyway] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({ resolver: zodResolver(customerInputSchema), defaultValues: toFormValues(customer) })

  useEffect(() => {
    if (open) reset(toFormValues(customer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id])

  // Clear the duplicate warning whenever the dialog closes, so it never reappears stale.
  function close() {
    setDuplicates(null)
    onOpenChange(false)
  }

  async function save(values: CustomerInput, allowDuplicateEmail: boolean) {
    try {
      const saved = customer
        ? await updateCustomer(customer.id, values, { allowDuplicateEmail })
        : await createCustomer(values, { allowDuplicateEmail })
      toast.success(customer ? `Saved ${saved.fullName}.` : `Added ${saved.fullName}.`)
      onSaved?.(saved)
      close()
    } catch (error) {
      if (error instanceof DuplicateCustomerError) {
        setDuplicates(error.existing)
        return
      }
      toast.error(errorMessage(error))
    }
  }

  const onSubmit = handleSubmit((values) => save(values, false))

  async function saveAnyway() {
    setSavingAnyway(true)
    // Re-run validation through the schema so trimmed/lowercased values are saved.
    const parsed = customerInputSchema.safeParse(getValues())
    if (parsed.success) await save(parsed.data, true)
    setSavingAnyway(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit customer' : 'Add customer'}</DialogTitle>
          <DialogDescription>
            {customer
              ? 'Past appointments keep the contact details they were booked with.'
              : 'Customers who book online are added automatically.'}
          </DialogDescription>
        </DialogHeader>

        <form id="customer-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormItem label="Full name" htmlFor="cust-name" error={errors.fullName?.message} required>
            <Input id="cust-name" autoComplete="off" aria-invalid={!!errors.fullName} aria-describedby={describedBy('cust-name', errors.fullName?.message)} {...register('fullName')} />
          </FormItem>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormItem label="Email" htmlFor="cust-email" error={errors.email?.message} required>
              <Input
                id="cust-email"
                type="email"
                autoComplete="off"
                aria-invalid={!!errors.email}
                aria-describedby={describedBy('cust-email', errors.email?.message)}
                {...register('email', { onChange: () => setDuplicates(null) })}
              />
            </FormItem>
            <FormItem label="Phone" htmlFor="cust-phone" error={errors.phone?.message} required>
              <Input
                id="cust-phone"
                type="tel"
                autoComplete="off"
                aria-invalid={!!errors.phone}
                aria-describedby={describedBy('cust-phone', errors.phone?.message)}
                {...register('phone')}
              />
            </FormItem>
          </div>
          <FormItem label="Address" htmlFor="cust-address" error={errors.address?.message}>
            <Input id="cust-address" autoComplete="off" aria-invalid={!!errors.address} {...register('address')} />
          </FormItem>
          <FormItem label="Notes" htmlFor="cust-notes" error={errors.notes?.message} description="Internal only. Customers never see these notes.">
            <Textarea id="cust-notes" rows={3} aria-invalid={!!errors.notes} aria-describedby={describedBy('cust-notes', errors.notes?.message, true)} {...register('notes')} />
          </FormItem>
        </form>

        {duplicates && (
          <div role="alert" className="rounded-md border border-pending/50 bg-pending-soft p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-pending-fg">
              <TriangleAlert className="size-4" aria-hidden />
              This email already belongs to {duplicates.length === 1 ? 'a customer' : `${duplicates.length} customers`}
            </p>
            <ul className="mt-2 space-y-1.5">
              {duplicates.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded bg-background/70 px-2 py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {d.email} · added {formatTimestamp(d.createdAt, 'MMM d, yyyy')}
                    </span>
                  </span>
                  <Button size="xs" variant="outline" asChild>
                    <Link to={`/admin/customers/${d.id}`} onClick={close}>
                      Open existing
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Usually this is the same person. Only keep a separate record if two people genuinely share this address.
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={saveAnyway} disabled={savingAnyway}>
              {savingAnyway && <Loader2 className="animate-spin" aria-hidden />}
              {customer ? 'Save anyway with the shared email' : 'Create a separate customer anyway'}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" disabled={isSubmitting || savingAnyway}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {customer ? 'Save changes' : 'Add customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
