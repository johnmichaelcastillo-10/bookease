import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, CalendarX2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { EmptyState, LoadingState } from '@/components/feedback/states'
import { InlineCalendar } from '@/components/shared/DatePicker'
import { TimeSlotPicker } from '@/components/shared/TimeSlotPicker'
import { Button } from '@/components/ui/button'
import { formatISODate } from '@/lib/format'
import { addDays, addMonths, endOfMonth, startOfMonth } from '@/lib/time'
import { generateSlotsFor, getBookableDates } from '@/services/availability/availabilityService'
import type { SlotResult } from '@/services/availability/engine'
import type { ISODate } from '@/types/models'
import { BookingSummary } from '../components/BookingSummary'
import { StepHeading, StepIndicator } from '../components/BookingStep'
import { useBookingFlow } from '../hooks/useBookingFlow'

function unavailableMessage(result: SlotResult, staffName: string | null, maxAdvanceDays: number): { title: string; description: string } {
  switch (result.reason) {
    case 'holiday':
      return { title: `Closed${result.label ? ` for ${result.label}` : ' for a holiday'}`, description: 'Please pick another day.' }
    case 'closed':
      return { title: result.label ? `Closed: ${result.label}` : 'Closed on this day', description: 'Please pick another day.' }
    case 'fully-booked':
      return { title: 'Fully booked', description: 'Every time on this day is taken. Try another day.' }
    case 'staff-unavailable':
      return {
        title: staffName ? `${staffName} isn't working this day` : 'Nobody is working this day',
        description: staffName ? 'Pick another day, or go back and choose "Any available".' : 'Please pick another day.',
      }
    case 'outside-window':
      return { title: 'Too far ahead', description: `Online bookings open up to ${maxAdvanceDays} days in advance.` }
    case 'past':
      return { title: 'This day has passed', description: 'Please pick a day from today onwards.' }
    case 'no-staff':
      return { title: 'No staff available', description: 'Nobody currently offers this service online.' }
    default:
      return { title: 'No times available', description: 'Please pick another day.' }
  }
}

export default function DateTimeStepPage() {
  const navigate = useNavigate()
  const flow = useBookingFlow('date-time')
  const { business, draft, service, staffId } = flow

  const today = business?.now.date
  const windowEnd = business && today ? addDays(today, business.settings.maxAdvanceDays) : undefined
  const [month, setMonth] = useState<ISODate | null>(null)
  const visibleMonth = month ?? startOfMonth(draft.date ?? today ?? '2000-01-01')

  // Bookability for the visible month only, so the picker can disable full or closed days.
  const from = today && visibleMonth < today ? today : visibleMonth
  const monthEnd = endOfMonth(visibleMonth)
  const to = windowEnd && monthEnd > windowEnd ? windowEnd : monthEnd
  const monthResults = useLiveQuery(
    async () => (service && today && from <= to ? getBookableDates(service.id, staffId, from, to, 'customer') : new Map<ISODate, SlotResult>()),
    [service?.id, staffId, from, to, today],
  )
  const firstOpenInMonth = monthResults ? [...monthResults.values()].find((r) => r.slots.length > 0)?.date : undefined
  const selectedDate = draft.date ?? firstOpenInMonth ?? null

  const dayResult = useLiveQuery(
    async () => (service && selectedDate ? generateSlotsFor({ serviceId: service.id, staffId, date: selectedDate, actor: 'customer' }) : null),
    [service?.id, staffId, selectedDate],
  )

  if (flow.loading || !business || !today || !windowEnd) return <LoadingState />
  if (flow.redirect) return <Navigate to={flow.redirect} replace />
  if (!service) return <Navigate to="/book/service" replace />

  const nextMonth = addMonths(visibleMonth, 1)
  const canGoNext = startOfMonth(windowEnd) >= nextMonth
  const monthHasOpenDay = !!firstOpenInMonth

  function pickTime(start: string) {
    if (!selectedDate) return
    if (draft.date !== selectedDate) draft.selectDate(selectedDate)
    draft.selectTime(start)
    navigate('/book/details')
  }

  const backPath = flow.allowStaffSelection ? '/book/staff' : '/book/service'
  const selectedStillFree = dayResult?.slots.some((s) => s.start === draft.startTime) ? draft.startTime : null

  return (
    <div>
      <StepIndicator current="date-time" allowStaffSelection={flow.allowStaffSelection} />
      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <StepHeading
            title="Pick a date and time"
            description={`Times are shown in ${business.settings.timezone.replace(/_/g, ' ')}. Bookings open up to ${business.settings.maxAdvanceDays} days ahead.`}
          />
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div className="self-start rounded-lg border bg-card p-2">
              <InlineCalendar
                value={selectedDate}
                onChange={(d) => draft.selectDate(d)}
                fromDate={today}
                toDate={windowEnd}
                month={visibleMonth}
                onMonthChange={(m) => setMonth(startOfMonth(m))}
                isDisabled={(d) => {
                  const r = monthResults?.get(d)
                  return r ? r.slots.length === 0 : false
                }}
                className="mx-auto [--cell-size:--spacing(9)]"
              />
              {monthResults && !monthHasOpenDay && (
                <div className="border-t px-2 pt-3 pb-1 text-center text-sm text-muted-foreground">
                  <p>No open times left this month.</p>
                  {canGoNext && (
                    <Button variant="link" className="h-auto p-0" onClick={() => setMonth(nextMonth)}>
                      Show next month
                    </Button>
                  )}
                </div>
              )}
            </div>

            <section aria-labelledby="times-heading" aria-live="polite" className="min-w-0">
              <h2 id="times-heading" className="mb-3 text-sm font-semibold">
                {selectedDate ? formatISODate(selectedDate, 'EEEE, MMMM d') : 'Choose a day'}
              </h2>
              {!selectedDate ? (
                monthResults === undefined ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Checking availability…
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Pick a highlighted day to see open times.</p>
                )
              ) : dayResult === undefined || dayResult === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Loading times…
                </p>
              ) : dayResult.slots.length === 0 ? (
                <EmptyState
                  icon={CalendarX2}
                  {...unavailableMessage(dayResult, flow.staff?.fullName ?? null, business.settings.maxAdvanceDays)}
                  className="rounded-lg border border-dashed py-10"
                />
              ) : (
                <>
                  <TimeSlotPicker slots={dayResult.slots} value={selectedStillFree} onChange={pickTime} />
                  <p className="mt-4 text-xs text-muted-foreground">
                    {dayResult.slots.length} open {dayResult.slots.length === 1 ? 'time' : 'times'}
                    {flow.staff ? ` with ${flow.staff.fullName}` : ''}.
                  </p>
                </>
              )}
            </section>
          </div>
          <Button variant="ghost" asChild className="mt-6 -ml-2">
            <Link to={backPath}>
              <ArrowLeft /> Back
            </Link>
          </Button>
        </div>
        <BookingSummary
          service={service}
          staff={flow.staff}
          anyStaff={!staffId}
          date={selectedDate}
          startTime={selectedStillFree}
          currency={business.settings.currency}
          className="hidden self-start lg:block"
        />
      </div>
    </div>
  )
}
