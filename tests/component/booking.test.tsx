import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/database/db'
import BookingHomePage from '@/features/booking/pages/BookingHomePage'
import ConfirmationPage from '@/features/booking/pages/ConfirmationPage'
import DateTimeStepPage from '@/features/booking/pages/DateTimeStepPage'
import DetailsStepPage from '@/features/booking/pages/DetailsStepPage'
import LookupPage from '@/features/booking/pages/LookupPage'
import ReviewStepPage from '@/features/booking/pages/ReviewStepPage'
import ServiceStepPage from '@/features/booking/pages/ServiceStepPage'
import StaffStepPage from '@/features/booking/pages/StaffStepPage'
import { buildIcs, escapeIcsText, foldIcsLine } from '@/features/booking/lib/calendarFiles'
import { guardRedirect } from '@/features/booking/lib/flow'
import { getBusinessSettings } from '@/database/repositories/settingsRepository'
import { createAppointment } from '@/services/appointments/appointmentService'
import { createBooking } from '@/services/booking/bookingService'
import { useBookingDraft } from '@/store/bookingDraftStore'
import { resetDb, seedBasics, TODAY, TOMORROW } from '../helpers/db'

const routes = [
  { path: '/book', element: <BookingHomePage /> },
  { path: '/book/service', element: <ServiceStepPage /> },
  { path: '/book/staff', element: <StaffStepPage /> },
  { path: '/book/date-time', element: <DateTimeStepPage /> },
  { path: '/book/details', element: <DetailsStepPage /> },
  { path: '/book/review', element: <ReviewStepPage /> },
  { path: '/book/confirmation', element: <ConfirmationPage /> },
  { path: '/booking-lookup', element: <LookupPage /> },
]

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

let ctx: Awaited<ReturnType<typeof seedBasics>>

beforeEach(async () => {
  await resetDb()
  ctx = await seedBasics()
  useBookingDraft.getState().reset()
})

describe('booking portal', () => {
  it('books an appointment end to end and saves it', async () => {
    const user = userEvent.setup()
    const router = renderAt('/book/service')

    await user.click(await screen.findByRole('button', { name: /^Consultation/ }))
    await user.click(await screen.findByRole('button', { name: /Any available/ }))

    // Today (Mon 2026-11-02, 07:00 in the test clock) is open, so its times are shown.
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }, { timeout: 4000 }))

    await screen.findByRole('heading', { name: 'Your details' })
    await user.type(screen.getByLabelText(/Full name/), 'Dana Diaz')
    await user.type(screen.getByLabelText(/Email/), 'dana@example.com')
    await user.type(screen.getByLabelText(/Phone/), '555 010 4444')
    await user.click(screen.getByRole('button', { name: /Review booking/ }))

    await screen.findByRole('heading', { name: 'Review and confirm' })
    expect(screen.getByText('Dana Diaz')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    await screen.findByRole('heading', { name: 'Your booking is saved' }, { timeout: 4000 })
    const saved = await db.appointments.toArray()
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ channel: 'portal', startTime: '09:00', customerName: 'Dana Diaz' })
    expect(router.state.location.search).toContain(saved[0]!.reference)
    expect(screen.getByText(saved[0]!.reference)).toBeInTheDocument()
    expect(screen.getByText(/No confirmation email or text was sent/)).toBeInTheDocument()
  }, 20_000)

  it('validates the details form before continuing', async () => {
    const user = userEvent.setup()
    useBookingDraft.setState({ serviceId: ctx.consult.id, staffId: null, staffChosen: true, date: TOMORROW, startTime: '10:00' })
    renderAt('/book/details')

    await user.click(await screen.findByRole('button', { name: /Review booking/ }))
    expect(await screen.findByText('Full name must be at least 2 characters.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Phone number is required.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Phone/), '123')
    await user.click(screen.getByRole('button', { name: /Review booking/ }))
    expect(await screen.findByText(/Enter a valid phone number/)).toBeInTheDocument()
    expect(useBookingDraft.getState().details).toBeNull()
  })

  it('redirects to the first incomplete step', async () => {
    const router = renderAt('/book/review')
    await screen.findByRole('heading', { name: 'Choose a service' })
    expect(router.state.location.pathname).toBe('/book/service')
  })

  it('sends the customer back to pick a time when the slot was taken', async () => {
    const user = userEvent.setup()
    useBookingDraft.setState({
      serviceId: ctx.repair.id,
      staffId: ctx.alice.id,
      staffChosen: true,
      date: TOMORROW,
      startTime: '10:00',
      details: { fullName: 'Dana Diaz', email: 'dana@example.com', phone: '5550104444', notes: '' },
    })
    const router = renderAt('/book/review')
    await screen.findByRole('heading', { name: 'Review and confirm' })

    // Someone else takes 10:00 with Alice before the customer confirms.
    await createAppointment({ customerId: ctx.customer.id, serviceId: ctx.repair.id, staffId: ctx.alice.id, date: TOMORROW, startTime: '10:00', customerNotes: '', internalNotes: '' })
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    await screen.findByRole('heading', { name: 'Pick a date and time' }, { timeout: 4000 })
    expect(router.state.location.pathname).toBe('/book/date-time')
    expect(useBookingDraft.getState().startTime).toBeNull()
    expect(await db.appointments.count()).toBe(1)
  })
})

describe('booking lookup', () => {
  it('finds a booking by reference and email, and cancels it', async () => {
    const user = userEvent.setup()
    const appt = await createBooking({
      fullName: 'Dana Diaz', email: 'dana@example.com', phone: '5550104444', notes: '',
      serviceId: ctx.consult.id, staffId: null, date: '2026-11-05', startTime: '10:00',
    })
    renderAt('/booking-lookup')

    await user.type(await screen.findByLabelText('Booking reference'), appt.reference.toLowerCase())
    await user.type(screen.getByLabelText('Email'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /Find booking/ }))
    expect(await screen.findByText(/No booking matches/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'DANA@example.com')
    await user.click(screen.getByRole('button', { name: /Find booking/ }))
    expect(await screen.findByText(appt.reference)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.type(within(dialog).getByLabelText(/Reason/), 'Plans changed')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

    expect(await screen.findByText(/This booking is cancelled/)).toBeInTheDocument()
    await waitFor(async () => expect((await db.appointments.get(appt.id))?.status).toBe('cancelled'))
    expect((await db.appointments.get(appt.id))?.cancellationReason).toBe('Plans changed')
  })

  it('explains why a booking inside the notice period cannot be cancelled online', async () => {
    const user = userEvent.setup()
    const appt = await createBooking({
      fullName: 'Dana Diaz', email: 'dana@example.com', phone: '5550104444', notes: '',
      serviceId: ctx.consult.id, staffId: null, date: TODAY, startTime: '13:00',
    })
    renderAt('/booking-lookup')
    await user.type(await screen.findByLabelText('Booking reference'), appt.reference)
    await user.type(screen.getByLabelText('Email'), 'dana@example.com')
    await user.click(screen.getByRole('button', { name: /Find booking/ }))
    expect(await screen.findByText(/up to 24 hours before the start time/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument()
  })
})

describe('booking helpers', () => {
  it('guards steps in order and skips staff when selection is off', () => {
    const empty = { serviceId: null, staffId: null, staffChosen: false, date: null, startTime: null, details: null }
    expect(guardRedirect('details', empty, true)).toBe('/book/service')
    expect(guardRedirect('date-time', { ...empty, serviceId: 's' }, true)).toBe('/book/staff')
    expect(guardRedirect('date-time', { ...empty, serviceId: 's' }, false)).toBeNull()
    expect(guardRedirect('staff', { ...empty, serviceId: 's' }, false)).toBe('/book/date-time')
  })

  it('builds a valid .ics file', async () => {
    const appt = await createBooking({
      fullName: 'Dana, Diaz', email: 'dana@example.com', phone: '5550104444', notes: '',
      serviceId: ctx.consult.id, staffId: null, date: '2026-11-05', startTime: '10:00',
    })
    const ics = buildIcs(appt, await getBusinessSettings(), new Date('2026-11-02T07:00:00Z'))
    expect(ics).toContain('\r\nDTSTART;TZID=UTC:20261105T100000\r\n')
    expect(ics).toContain('DTEND;TZID=UTC:20261105T110000')
    expect(ics).toContain(`UID:${appt.reference}@bookease.local`)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(escapeIcsText('a;b,c\nd\\e')).toBe('a\\;b\\,c\\nd\\\\e')
    expect(foldIcsLine('X'.repeat(160)).split('\r\n ').every((l) => l.length <= 75)).toBe(true)
  })
})
