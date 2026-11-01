import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleSlash, Info, Loader2, Search, SearchX } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { LoadingState } from '@/components/feedback/states'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatISODate, formatTime } from '@/lib/format'
import { cancelBooking, canCustomerCancel, lookupBooking } from '@/services/booking/bookingService'
import { errorMessage } from '@/services/errors'
import { lookupSchema } from '@/validation/schemas'
import { BookingDetailsCard } from '../components/BookingDetailsCard'

type Lookup = { status: 'idle' } | { status: 'not-found' } | { status: 'found'; id: string; email: string }

export default function LookupPage() {
  const business = useBusinessContext()
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(lookupSchema), defaultValues: { reference: '', email: '' } })

  const foundId = lookup.status === 'found' ? lookup.id : null
  // Live, so the page reflects a cancellation (or an admin change in another tab) immediately.
  const appointment = useLiveQuery(
    async () => (foundId ? ((await appointmentsRepository.get(foundId)) ?? null) : null),
    [foundId],
  )

  if (!business) return <LoadingState />
  const { settings, now } = business

  const onSubmit = handleSubmit(async (values) => {
    const found = await lookupBooking(values.reference, values.email)
    setLookup(found ? { status: 'found', id: found.id, email: values.email } : { status: 'not-found' })
  })

  const check = appointment ? canCustomerCancel(appointment, settings, now) : null

  async function cancel() {
    if (!appointment || lookup.status !== 'found') return
    try {
      await cancelBooking(appointment.reference, lookup.email, reason)
      toast.success('Your booking was cancelled. The time is free for others again.')
      setReason('')
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Find my booking</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Enter the reference from your confirmation and the email you booked with.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1.3fr_auto] sm:items-start sm:p-5">
        <FormItem label="Booking reference" htmlFor="reference" error={errors.reference?.message}>
          <Input
            id="reference"
            placeholder="BE-7K4M9Q"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
            aria-invalid={!!errors.reference}
            aria-describedby={describedBy('reference', errors.reference?.message)}
            {...register('reference')}
          />
        </FormItem>
        <FormItem label="Email" htmlFor="lookup-email" error={errors.email?.message}>
          <Input
            id="lookup-email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={describedBy('lookup-email', errors.email?.message)}
            {...register('email')}
          />
        </FormItem>
        <Button type="submit" className="sm:mt-6.5" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
          Find booking
        </Button>
      </form>

      <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Lookup only works in the browser where the booking was made, because bookings are stored on that device.
      </p>

      <div aria-live="polite" className="mt-8">
        {lookup.status === 'not-found' && (
          <div className="flex gap-3 rounded-lg border bg-card p-4 text-sm">
            <SearchX className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium">No booking matches that reference and email</p>
              <p className="mt-1 text-muted-foreground">
                Check both for typos. If you booked on another device or browser, or cleared this browser’s data, the booking isn’t stored
                here.
              </p>
            </div>
          </div>
        )}

        {lookup.status === 'found' && appointment === undefined && <LoadingState />}
        {lookup.status === 'found' && appointment && check && (
          <div className="space-y-4">
            <BookingDetailsCard appointment={appointment} settings={settings} />
            {appointment.status === 'cancelled' ? (
              <p className="text-sm text-muted-foreground">
                This booking is cancelled.{' '}
                <Link to="/book/service" className="font-medium text-primary hover:underline">
                  Make a new booking
                </Link>
              </p>
            ) : check.allowed ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Can’t make it? Cancelling frees the time for someone else.</p>
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                  <CircleSlash /> Cancel booking
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{check.reason}</p>
            )}
          </div>
        )}
      </div>

      {appointment && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Cancel this booking?"
          description={`${appointment.serviceName} on ${formatISODate(appointment.date)} at ${formatTime(appointment.startTime)}. This can't be undone; you would need to book again.`}
          confirmLabel="Cancel booking"
          cancelLabel="Keep booking"
          destructive
          onConfirm={cancel}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea id="cancel-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
