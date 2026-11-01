import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { LoadingState } from '@/components/feedback/states'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/contact'
import { formatDuration, formatISODate, formatMoney, formatTimeRange } from '@/lib/format'
import { fromMinutes, toMinutes } from '@/lib/time'
import { createBooking } from '@/services/booking/bookingService'
import { errorMessage, SchedulingError } from '@/services/errors'
import { StepHeading, StepIndicator } from '../components/BookingStep'
import { useBookingFlow } from '../hooks/useBookingFlow'
import { cancellationPolicyText } from '../lib/policy'

function Section({ title, editTo, children }: { title: string; editTo: string; children: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-4 last:border-b-0 sm:px-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        <Link to={editTo} className="text-sm font-medium text-primary hover:underline" aria-label={`Edit ${title.toLowerCase()}`}>
          Edit
        </Link>
      </div>
      {children}
    </section>
  )
}

export default function ReviewStepPage() {
  const navigate = useNavigate()
  const flow = useBookingFlow('review')
  const { business, draft, service } = flow
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState(false)

  // Once booked, the draft is cleared; don't let the step guard redirect while we leave.
  if (flow.loading || !business || booked) return <LoadingState />
  if (flow.redirect) return <Navigate to={flow.redirect} replace />
  if (!service || !draft.date || !draft.startTime || !draft.details) return <Navigate to="/book/service" replace />

  const { settings } = business
  const details = draft.details
  const date = draft.date
  const startTime = draft.startTime
  const end = fromMinutes(Math.min(1440, toMinutes(startTime) + service.durationMinutes))

  async function confirm() {
    setSubmitting(true)
    try {
      const appt = await createBooking({
        ...details,
        serviceId: service!.id,
        staffId: flow.staffId,
        date,
        startTime,
      })
      setBooked(true)
      await navigate(`/book/confirmation?ref=${encodeURIComponent(appt.reference)}`)
      // Clear the draft only after leaving, so this step's guard can't redirect first.
      draft.complete(appt.reference)
    } catch (error) {
      setSubmitting(false)
      if (error instanceof SchedulingError) {
        toast.error(`${error.message} Please choose another time.`)
        draft.selectTime(null)
        navigate('/book/date-time')
        return
      }
      toast.error(errorMessage(error))
    }
  }

  return (
    <div>
      <StepIndicator current="review" allowStaffSelection={flow.allowStaffSelection} />
      <div className="mx-auto max-w-2xl">
        <StepHeading title="Review and confirm" description="Check the details below, then confirm your booking." />
        <div className="rounded-lg border bg-card">
          <Section title="Service" editTo="/book/service">
            <p className="font-medium">{service.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground tabular">
              {formatDuration(service.durationMinutes)} · {formatMoney(service.priceCents, settings.currency)}
            </p>
          </Section>
          {flow.allowStaffSelection && (
            <Section title="Staff" editTo="/book/staff">
              <p className="font-medium">{flow.staff ? flow.staff.fullName : 'Any available'}</p>
              {!flow.staff && <p className="mt-0.5 text-sm text-muted-foreground">Assigned on confirmation to whoever is free.</p>}
            </Section>
          )}
          <Section title="Date and time" editTo="/book/date-time">
            <p className="font-medium">{formatISODate(date, 'EEEE, MMMM d, yyyy')}</p>
            <p className="mt-0.5 text-sm text-muted-foreground tabular">
              {formatTimeRange(startTime, end)} · {settings.timezone.replace(/_/g, ' ')}
            </p>
          </Section>
          <Section title="Your details" editTo="/book/details">
            <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{details.fullName}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{details.email}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{formatPhone(details.phone)}</dd>
              {details.notes && (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-line">{details.notes}</dd>
                </>
              )}
            </dl>
          </Section>
          <div className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-3 sm:px-5">
            <span className="text-sm text-muted-foreground">Total, paid at your visit</span>
            <span className="text-lg font-semibold tabular">{formatMoney(service.priceCents, settings.currency)}</span>
          </div>
        </div>

        <p className="mt-4 flex gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {cancellationPolicyText(settings)} Your booking is saved in this browser only; no email or text message is sent.
          </span>
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" asChild className="sm:-ml-2">
            <Link to="/book/details">
              <ArrowLeft /> Back
            </Link>
          </Button>
          <Button size="lg" className="h-10 px-5" onClick={confirm} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            Confirm booking
          </Button>
        </div>
      </div>
    </div>
  )
}
