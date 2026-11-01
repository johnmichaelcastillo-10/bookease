import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { db } from '@/database/db'
import { AppointmentDialogs } from '@/features/appointments/components/AppointmentDialogs'
import AppointmentsPage from '@/features/appointments/pages/AppointmentsPage'
import { createAppointment } from '@/services/appointments/appointmentService'
import { createCustomer } from '@/services/customers/customerService'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import { resetDb, seedBasics, TOMORROW } from '../helpers/db'

function renderAdmin(path = '/admin/appointments') {
  const router = createMemoryRouter(
    [
      {
        path: '/admin/appointments',
        element: (
          <>
            <AppointmentsPage />
            <AppointmentDialogs />
          </>
        ),
      },
      { path: '/admin/*', element: <AppointmentDialogs /> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  )
}

let ctx: Awaited<ReturnType<typeof seedBasics>>
let caseyApptId: string

beforeEach(async () => {
  useAppointmentUi.getState().close()
  await resetDb()
  ctx = await seedBasics()
  const zed = await createCustomer({ fullName: 'Zed Zimmer', email: 'zed@example.com', phone: '5550109999', address: '', notes: '' })
  const casey = await createAppointment({
    customerId: ctx.customer.id, serviceId: ctx.consult.id, staffId: ctx.bob.id, date: TOMORROW, startTime: '09:00', customerNotes: '', internalNotes: '',
  })
  caseyApptId = casey.id
  await createAppointment({
    customerId: zed.id, serviceId: ctx.consult.id, staffId: ctx.alice.id, date: TOMORROW, startTime: '10:00', customerNotes: '', internalNotes: '',
  })
})

describe('AppointmentsPage', () => {
  it('lists upcoming appointments and filters them by search', async () => {
    const user = userEvent.setup()
    renderAdmin()
    expect((await screen.findAllByText('Casey Customer')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Zed Zimmer').length).toBeGreaterThan(0)

    await user.type(screen.getByRole('searchbox', { name: 'Search appointments' }), 'zed')
    await waitFor(() => expect(screen.queryAllByText('Casey Customer')).toHaveLength(0))
    expect(screen.getAllByText('Zed Zimmer').length).toBeGreaterThan(0)
  })

  it('reads filters from the URL and explains an empty result', async () => {
    renderAdmin('/admin/appointments?status=completed')
    expect(await screen.findByText('No appointments match')).toBeInTheDocument()
  })
})

describe('Appointment details', () => {
  it('cancels an appointment through the confirmation dialog', async () => {
    const user = userEvent.setup()
    renderAdmin()
    act(() => useAppointmentUi.getState().openDetails(caseyApptId))

    const sheet = await screen.findByRole('dialog')
    await user.click(await within(sheet).findByRole('button', { name: /Cancel appointment/ }))
    const confirm = await screen.findByRole('alertdialog')
    await user.type(within(confirm).getByLabelText('Reason (optional)'), 'Called to cancel')
    await user.click(within(confirm).getByRole('button', { name: 'Cancel appointment' }))

    await waitFor(async () => expect((await db.appointments.get(caseyApptId))?.status).toBe('cancelled'))
    expect((await db.appointments.get(caseyApptId))?.cancellationReason).toBe('Called to cancel')
  })

  it('confirms a pending appointment in one click', async () => {
    const user = userEvent.setup()
    renderAdmin()
    act(() => useAppointmentUi.getState().openDetails(caseyApptId))
    await user.click(await screen.findByRole('button', { name: /^Confirm$/ }))
    await waitFor(async () => expect((await db.appointments.get(caseyApptId))?.status).toBe('confirmed'))
  })

  it('handles an appointment that no longer exists', async () => {
    renderAdmin()
    act(() => useAppointmentUi.getState().openDetails('missing-id'))
    expect(await screen.findByText('Appointment not found')).toBeInTheDocument()
  })
})

describe('Appointment form', () => {
  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    renderAdmin()
    act(() => useAppointmentUi.getState().openCreate())
    await user.click(await screen.findByRole('button', { name: 'Create appointment' }))
    expect(await screen.findByText('Choose a customer.')).toBeInTheDocument()
    expect(screen.getByText('Choose a service.')).toBeInTheDocument()
    expect(screen.getByText('Choose a date.')).toBeInTheDocument()
    expect(screen.getByText('Choose an available time.')).toBeInTheDocument()
    expect(await db.appointments.count()).toBe(2)
  })

  it('offers only free slots for the prefilled staff and date', async () => {
    renderAdmin()
    act(() => useAppointmentUi.getState().openCreate({ customerId: ctx.customer.id, serviceId: ctx.consult.id, staffId: ctx.bob.id, date: TOMORROW }))
    const times = await screen.findByRole('group', { name: 'Available times' })
    // Bob already has 09:00–10:00, so 09:00 and 09:30 are taken; 10:00 is free.
    expect(within(times).queryByRole('button', { name: '9:00 AM' })).toBeNull()
    expect(within(times).queryByRole('button', { name: '9:30 AM' })).toBeNull()
    expect(within(times).getByRole('button', { name: '10:00 AM' })).toBeInTheDocument()
  })
})
