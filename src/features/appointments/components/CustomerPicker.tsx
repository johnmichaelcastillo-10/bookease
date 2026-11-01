import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronsUpDown, Loader2, UserPlus } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { customersRepository } from '@/database/repositories/customersRepository'
import { formatPhone } from '@/lib/contact'
import { cn } from '@/lib/utils'
import { createCustomer, DuplicateCustomerError, matchesCustomer } from '@/services/customers/customerService'
import { errorMessage } from '@/services/errors'
import type { Customer, ID } from '@/types/models'
import { customerInputSchema, type CustomerInput } from '@/validation/schemas'

/** Searchable customer combobox with an inline "new customer" form. */
export function CustomerPicker({
  value,
  onChange,
  disabled,
  invalid,
  id,
  describedById,
}: {
  value: ID
  onChange: (id: ID) => void
  disabled?: boolean
  invalid?: boolean
  id: string
  describedById?: string
}) {
  const customers = useLiveQuery(() => customersRepository.list(), [])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const listId = useId()

  const selected = customers?.find((c) => c.id === value)
  const matches = useMemo(() => (customers ?? []).filter((c) => matchesCustomer(c, query)).slice(0, 50), [customers, query])

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-invalid={invalid}
              aria-describedby={describedById}
              disabled={disabled}
              className={cn('min-w-0 flex-1 justify-between font-normal', !selected && 'text-muted-foreground')}
            >
              <span className="truncate">{selected ? `${selected.fullName} · ${selected.email}` : 'Select a customer'}</span>
              <ChevronsUpDown className="opacity-50" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
            <div className="border-b p-2">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email or phone"
                aria-label="Search customers"
                className="h-8"
              />
            </div>
            <ul id={listId} role="listbox" aria-label="Customers" className="max-h-64 overflow-y-auto p-1">
              {customers === undefined && <li className="px-2 py-3 text-sm text-muted-foreground">Loading…</li>}
              {customers && matches.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No customers match “{query}”.</li>}
              {matches.map((c) => (
                <li key={c.id} role="option" aria-selected={c.id === value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.id)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <Check className={cn('size-4 shrink-0', c.id === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.email} · {formatPhone(c.phone)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
        <Button type="button" variant="outline" disabled={disabled} onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
          <UserPlus /> <span className="hidden sm:inline">New</span>
          <span className="sr-only sm:hidden">New customer</span>
        </Button>
      </div>
      {creating && (
        <NewCustomerForm
          onCreated={(c) => {
            onChange(c.id)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  )
}

/** Not a <form>: it lives inside the appointment form, and forms can't nest. */
function NewCustomerForm({ onCreated, onCancel }: { onCreated: (c: Customer) => void; onCancel: () => void }) {
  const prefix = useId()
  const [duplicates, setDuplicates] = useState<Customer[] | null>(null)
  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerInputSchema),
    defaultValues: { fullName: '', email: '', phone: '', address: '', notes: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function save(values: CustomerInput, allowDuplicateEmail = false) {
    try {
      const customer = await createCustomer(values, { allowDuplicateEmail })
      toast.success(`Added ${customer.fullName}.`)
      onCreated(customer)
    } catch (error) {
      if (error instanceof DuplicateCustomerError) setDuplicates(error.existing)
      else toast.error(errorMessage(error))
    }
  }

  const field = (name: 'fullName' | 'email' | 'phone') => `${prefix}-${name}`

  return (
    <div
      className="rounded-md border bg-muted/30 p-3"
      role="group"
      aria-label="New customer"
      onKeyDown={(e) => {
        // Enter here must add the customer, not submit the surrounding appointment form.
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault()
          void form.handleSubmit((v) => save(v))()
        }
      }}
    >
      <p className="mb-3 text-sm font-medium">New customer</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormItem label="Full name" htmlFor={field('fullName')} error={errors.fullName?.message} required>
          <Input id={field('fullName')} aria-invalid={!!errors.fullName} aria-describedby={describedBy(field('fullName'), errors.fullName?.message)} {...form.register('fullName')} />
        </FormItem>
        <FormItem label="Email" htmlFor={field('email')} error={errors.email?.message} required>
          <Input id={field('email')} type="email" aria-invalid={!!errors.email} aria-describedby={describedBy(field('email'), errors.email?.message)} {...form.register('email')} />
        </FormItem>
        <FormItem label="Phone" htmlFor={field('phone')} error={errors.phone?.message} required>
          <Input id={field('phone')} type="tel" aria-invalid={!!errors.phone} aria-describedby={describedBy(field('phone'), errors.phone?.message)} {...form.register('phone')} />
        </FormItem>
      </div>
      {duplicates && (
        <div role="alert" className="mt-3 rounded-md border border-pending/40 bg-pending-soft px-3 py-2 text-sm text-pending-fg">
          <p className="font-medium">A customer with this email already exists.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {duplicates.map((c) => (
              <Button key={c.id} type="button" size="sm" variant="outline" onClick={() => onCreated(c)}>
                Use {c.fullName}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={form.handleSubmit((v) => save(v, true))}>
              Create a separate record anyway
            </Button>
          </div>
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={isSubmitting} onClick={form.handleSubmit((v) => save(v))}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Add customer
        </Button>
      </div>
    </div>
  )
}
