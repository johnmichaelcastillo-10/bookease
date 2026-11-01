import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import ActivityPage from '@/features/activity/pages/ActivityPage'
import NotificationsPage from '@/features/notifications/pages/NotificationsPage'
import { db } from '@/database/db'
import { createAppointment } from '@/services/appointments/appointmentService'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import { useUiStore } from '@/store/uiStore'
import { setClock } from '@/services/clock'
import { resetDb, seedBasics, TEST_NOW, TOMORROW } from '../helpers/db'

beforeEach(async () => {
  useUiStore.setState({ pageSize: 10 })
  useAppointmentUi.setState({ dialog: { kind: 'none' } })
  await resetDb()
})

describe('Activity log', () => {
  it('lists entries newest first and filters by area', async () => {
    // Advance the clock per write so ordering by createdAt is deterministic.
    let tick = 0
    setClock(() => new Date(TEST_NOW.getTime() + tick++ * 1000))
    await seedBasics() // logs: category, 2 services, 2 staff, 1 customer
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ActivityPage />
      </MemoryRouter>,
    )
    const list = await screen.findByRole('list', { name: 'Activity entries' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Added customer Casey Customer')

    await user.click(screen.getByRole('combobox', { name: 'Filter by area' }))
    await user.click(await screen.findByRole('option', { name: 'Staff' }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Activity entries' })).getAllByRole('listitem')).toHaveLength(2))
    expect(screen.getByRole('list', { name: 'Activity entries' })).not.toHaveTextContent('Casey')
  })

  it('opens appointment details from an appointment entry', async () => {
    const ctx = await seedBasics()
    const appt = await createAppointment({ customerId: ctx.customer.id, serviceId: ctx.consult.id, staffId: ctx.bob.id, date: TOMORROW, startTime: '09:00', customerNotes: '', internalNotes: '' })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ActivityPage />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: /Created by admin.*Open appointment/ }))
    expect(useAppointmentUi.getState().dialog).toEqual({ kind: 'details', id: appt.id })
  })

  it('shows an empty state', async () => {
    render(
      <MemoryRouter>
        <ActivityPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('No activity yet')).toBeInTheDocument()
  })
})

describe('Notifications page', () => {
  it('filters unread and marks all as read', async () => {
    const ctx = await seedBasics()
    await createAppointment({ customerId: ctx.customer.id, serviceId: ctx.consult.id, staffId: ctx.bob.id, date: TOMORROW, startTime: '09:00', customerNotes: '', internalNotes: '' })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Appointment created')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(async () => expect(await db.notifications.where('read').equals(0).count()).toBe(0))
    await user.click(screen.getByRole('radio', { name: /Unread/ }))
    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument()
  })
})
