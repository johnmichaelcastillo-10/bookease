import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { db } from '@/database/db'
import { CustomerFormDialog } from '@/features/customers/components/CustomerFormDialog'
import CustomerProfilePage from '@/features/customers/pages/CustomerProfilePage'
import { cancelAppointment, createAppointment } from '@/services/appointments/appointmentService'
import { resetDb, seedBasics, TOMORROW } from '../helpers/db'

let ctx: Awaited<ReturnType<typeof seedBasics>>

beforeEach(async () => {
  await resetDb()
  ctx = await seedBasics()
})

describe('CustomerFormDialog', () => {
  it('flags a duplicate email and only creates a second record when confirmed', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CustomerFormDialog open onOpenChange={() => {}} customer={null} />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText(/full name/i), 'Casey Partner')
    await user.type(screen.getByLabelText(/email/i), 'CASEY@example.com')
    await user.type(screen.getByLabelText(/phone/i), '555 010 9999')
    await user.click(screen.getByRole('button', { name: /add customer/i }))

    const alert = await screen.findByText(/this email already belongs/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('Casey Customer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open existing/i })).toHaveAttribute('href', `/admin/customers/${ctx.customer.id}`)
    expect(await db.customers.count()).toBe(1)

    await user.click(screen.getByRole('button', { name: /create a separate customer anyway/i }))
    await waitFor(async () => expect(await db.customers.count()).toBe(2))
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CustomerFormDialog open onOpenChange={() => {}} customer={null} />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText(/email/i), 'nope')
    await user.click(screen.getByRole('button', { name: /add customer/i }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Full name must be at least 2 characters.')).toBeInTheDocument()
  })
})

describe('CustomerProfilePage', () => {
  it('shows booking statistics from the customer’s appointments', async () => {
    const base = { customerId: ctx.customer.id, serviceId: ctx.consult.id, staffId: ctx.bob.id, date: TOMORROW, customerNotes: '', internalNotes: '' }
    await createAppointment({ ...base, startTime: '09:00' })
    const second = await createAppointment({ ...base, startTime: '13:00' })
    await cancelAppointment(second.id, 'Changed plans')

    render(
      <MemoryRouter initialEntries={[`/admin/customers/${ctx.customer.id}`]}>
        <TooltipProvider>
          <Routes>
            <Route path="/admin/customers/:customerId" element={<CustomerProfilePage />} />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Casey Customer' })).toBeInTheDocument()
    const tile = (label: string) => screen.getByText(label, { selector: 'p' }).closest('div')!.parentElement!
    await waitFor(() => expect(within(tile('Total bookings')).getByText('2')).toBeInTheDocument())
    expect(within(tile('Upcoming')).getByText('1')).toBeInTheDocument()
    expect(within(tile('Cancelled')).getByText('1')).toBeInTheDocument()
    expect(within(tile('Completed')).getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /appointments for casey customer/i })).toBeInTheDocument()
  })

  it('shows a not-found state for an unknown id', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/customers/missing']}>
        <Routes>
          <Route path="/admin/customers/:customerId" element={<CustomerProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Customer not found')).toBeInTheDocument()
  })
})
