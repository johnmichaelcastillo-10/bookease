import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, CheckCircle2, FileText, Info, Printer, RotateCcw, Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { EmptyState, LoadingState } from '@/components/feedback/states'
import { Button } from '@/components/ui/button'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { useBusinessSettings } from '@/hooks/useBusiness'
import { downloadFile } from '@/lib/download'
import { normalizeReference } from '@/lib/ids'
import { useBookingDraft } from '@/store/bookingDraftStore'
import { BookingDetailsCard, BusinessContact } from '../components/BookingDetailsCard'
import { buildIcs, buildTextSummary } from '../lib/calendarFiles'
import { cancellationPolicyText } from '../lib/policy'

export default function ConfirmationPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const lastReference = useBookingDraft((s) => s.lastReference)
  const reset = useBookingDraft((s) => s.reset)
  const raw = params.get('ref') ?? lastReference
  const reference = raw ? normalizeReference(raw) : null
  const settings = useBusinessSettings()
  const appointment = useLiveQuery(async () => (reference ? ((await appointmentsRepository.getByReference(reference)) ?? null) : null), [reference])
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (appointment) headingRef.current?.focus()
  }, [appointment])

  if (!settings || appointment === undefined) return <LoadingState />
  if (!appointment) {
    return (
      <EmptyState
        icon={Search}
        title="We couldn't find that booking"
        description="Bookings are stored in the browser where they were made. If you booked on another device or cleared your browser data, it won't show here."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/book/service">Make a booking</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/booking-lookup">Find my booking</Link>
            </Button>
          </div>
        }
        className="rounded-lg border bg-card"
      />
    )
  }

  const fileBase = `booking-${appointment.reference}`

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start gap-3">
        <CheckCircle2 className="mt-1 size-6 shrink-0 text-completed" aria-hidden />
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
            {appointment.status === 'cancelled' ? 'This booking was cancelled' : 'Your booking is saved'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {appointment.status === 'pending'
              ? `${settings.name} will review it; it shows as pending until confirmed.`
              : appointment.status === 'confirmed'
                ? 'It is confirmed. Keep your reference to look it up later.'
                : 'Keep your reference to look it up later.'}
          </p>
        </div>
      </div>

      <BookingDetailsCard appointment={appointment} settings={settings} />

      <p className="mt-4 flex gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          No confirmation email or text was sent. This booking is stored in this browser only, so print it or download a copy.{' '}
          {cancellationPolicyText(settings)}
        </span>
      </p>

      <div className="no-print mt-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
        <Button variant="outline" onClick={() => downloadFile(`${fileBase}.ics`, buildIcs(appointment, settings), 'text/calendar;charset=utf-8')}>
          <CalendarPlus /> Add to calendar (.ics)
        </Button>
        <Button variant="outline" onClick={() => downloadFile(`${fileBase}.txt`, buildTextSummary(appointment, settings))}>
          <FileText /> Download details
        </Button>
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">Business contact</h2>
        <BusinessContact settings={settings} />
      </div>

      <div className="no-print mt-8 flex flex-wrap gap-2 border-t pt-6">
        <Button
          onClick={() => {
            reset()
            navigate('/book/service')
          }}
        >
          <RotateCcw /> Book another appointment
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/booking-lookup">
            <Search /> Find my booking
          </Link>
        </Button>
      </div>
    </div>
  )
}
