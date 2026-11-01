import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/database/db'
import StaffPage from '@/features/staff/pages/StaffPage'
import StaffProfilePage from '@/features/staff/pages/StaffProfilePage'
import { resetDb, seedBasics } from '../helpers/db'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/admin/staff', element: <StaffPage /> },
      { path: '/admin/staff/:staffId', element: <StaffProfilePage /> },
    ],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />)
}

let ctx: Awaited<ReturnType<typeof seedBasics>>

beforeEach(async () => {
  await resetDb()
  ctx = await seedBasics()
})

describe('Staff list', () => {
  it('validates the add-staff form, then adds the staff member to the list', async () => {
    const user = userEvent.setup()
    renderAt('/admin/staff')
    expect(await screen.findAllByText('Alice Adams')).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: /add staff/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }))
    expect(await within(dialog).findByText('Full name must be at least 2 characters.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/full name/i), 'Jordan Blake')
    await user.type(within(dialog).getByLabelText(/^email/i), 'not-an-email')
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }))
    expect(await within(dialog).findByText('Enter a valid email address.')).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText(/^email/i))
    await user.type(within(dialog).getByLabelText(/^email/i), 'jordan@example.com')
    await user.click(within(dialog).getByLabelText('Repair'))
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findAllByText('Jordan Blake')).not.toHaveLength(0)
    const saved = await db.staff.where('fullName').equals('Jordan Blake').first()
    expect(saved).toMatchObject({ email: 'jordan@example.com', isActive: true, serviceIds: [ctx.repair.id] })
    expect(await db.staffSchedules.get(saved!.id)).toMatchObject({ mode: 'business-hours' })
  })

  it('filters by search text', async () => {
    const user = userEvent.setup()
    await db.staff.update(ctx.bob.id, { isActive: false })
    renderAt('/admin/staff')
    await screen.findAllByText('Bob Brown') // table row and mobile card both render in jsdom
    await user.type(screen.getByRole('searchbox', { name: 'Search staff' }), 'alice')
    await waitFor(() => expect(screen.queryByText('Bob Brown')).not.toBeInTheDocument())
    expect(screen.getAllByText('Alice Adams').length).toBeGreaterThan(0)
  })
})

describe('Staff profile', () => {
  it('deactivates after confirmation and keeps the record', async () => {
    const user = userEvent.setup()
    renderAt(`/admin/staff/${ctx.alice.id}`)
    expect(await screen.findByRole('heading', { name: 'Alice Adams' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/won’t be offered for new bookings/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(async () => expect((await db.staff.get(ctx.alice.id))?.isActive).toBe(false))
    expect(await screen.findByRole('button', { name: 'Activate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new appointment/i })).toBeDisabled()
  })

  it('shows a not-found state for an unknown id', async () => {
    renderAt('/admin/staff/does-not-exist')
    expect(await screen.findByText('Staff member not found')).toBeInTheDocument()
  })
})
