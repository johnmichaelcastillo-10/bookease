import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import CalendarPage from '@/features/calendar/pages/CalendarPage'
import { gridBounds, layoutLanes, periodTitle, shiftDate, visibleRange } from '@/features/calendar/calendarUtils'
import { createAppointment } from '@/services/appointments/appointmentService'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import { resetDb, seedBasics, TOMORROW } from '../helpers/db'

function renderCalendar(url = '/admin/calendar?view=week&date=2026-11-02') {
  const router = createMemoryRouter([{ path: '/admin/calendar', element: <CalendarPage /> }], { initialEntries: [url] })
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  )
  return router
}

const title = () => screen.findByTestId('calendar-title')

beforeEach(async () => {
  await resetDb()
  const ctx = await seedBasics()
  await createAppointment({
    customerId: ctx.customer.id,
    serviceId: ctx.consult.id,
    staffId: ctx.alice.id,
    date: TOMORROW,
    startTime: '10:00',
    customerNotes: '',
    internalNotes: '',
  })
  useAppointmentUi.getState().close()
})

describe('CalendarPage', () => {
  it('renders seeded appointments in week view', async () => {
    renderCalendar()
    expect(await screen.findByRole('button', { name: /Casey Customer, Consultation with Alice Adams/ })).toBeInTheDocument()
    expect(await title()).toHaveTextContent('Nov 2 – 8, 2026')
  })

  it('navigates with previous, next and today', async () => {
    const user = userEvent.setup()
    renderCalendar()
    expect(await title()).toHaveTextContent('Nov 2 – 8, 2026')
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(await title()).toHaveTextContent('Oct 26 – Nov 1, 2026')
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await title()).toHaveTextContent('Nov 9 – 15, 2026')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(await title()).toHaveTextContent('Nov 2 – 8, 2026')
  })

  it('switches between views and keeps them in the URL', async () => {
    const user = userEvent.setup()
    const router = renderCalendar()
    await title()
    const views = screen.getByRole('radiogroup', { name: 'Calendar view' })
    await user.click(within(views).getByRole('radio', { name: 'Month' }))
    expect(await title()).toHaveTextContent('November 2026')
    expect(router.state.location.search).toContain('view=month')

    await user.click(within(views).getByRole('radio', { name: 'Day' }))
    expect(await title()).toHaveTextContent('Monday, November 2, 2026')
    expect(await screen.findByText('Alice Adams')).toBeInTheDocument()

    await user.click(within(views).getByRole('radio', { name: 'Agenda' }))
    expect(await screen.findByRole('button', { name: /Casey Customer/ })).toBeInTheDocument()
  })

  it('opens appointment details on click', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Casey Customer/ }))
    expect(useAppointmentUi.getState().dialog).toMatchObject({ kind: 'details' })
  })

  it('opens the create dialog with the current date from the toolbar', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await title()
    await user.click(screen.getByRole('button', { name: /New appointment/ }))
    expect(useAppointmentUi.getState().dialog).toMatchObject({ kind: 'create', prefill: { date: '2026-11-02' } })
  })
})

describe('calendar utilities', () => {
  it('computes ranges and titles per view', () => {
    expect(visibleRange('week', '2026-11-04')).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(visibleRange('month', '2026-11-15')).toEqual({ from: '2026-10-26', to: '2026-12-06' })
    expect(periodTitle('week', '2026-12-30')).toBe('Dec 28, 2026 – Jan 3, 2027')
    expect(shiftDate('month', '2026-01-31', 1)).toBe('2026-02-28')
  })

  it('places overlapping appointments side by side', () => {
    const laid = layoutLanes([
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '09:30', endTime: '10:30' },
      { startTime: '11:00', endTime: '11:30' },
    ])
    expect(laid.map((l) => [l.lane, l.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ])
  })

  it('derives grid hours from business hours and appointments', () => {
    const day = { weekday: 1 as const, isOpen: true, intervals: [{ start: '09:00', end: '17:00' }], breaks: [] }
    expect(gridBounds([day], [])).toEqual({ start: 540, end: 1020 })
    expect(gridBounds([day], [{ startTime: '07:30', endTime: '08:00' }])).toEqual({ start: 420, end: 1020 })
    expect(gridBounds([], [])).toEqual({ start: 480, end: 1080 })
  })
})
