import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { db } from '@/database/db'
import { ServiceFormDialog } from '@/features/services/components/ServiceFormDialog'
import ServicesPage from '@/features/services/pages/ServicesPage'
import type { ServiceCategory } from '@/types/models'
import { resetDb, seedBasics } from '../helpers/db'

let ctx: Awaited<ReturnType<typeof seedBasics>>

beforeEach(async () => {
  await resetDb()
  ctx = await seedBasics()
})

function renderForm(categories: ServiceCategory[]) {
  return render(<ServiceFormDialog open onOpenChange={() => {}} service={null} categories={categories} currency="USD" />)
}

describe('ServiceFormDialog', () => {
  it('shows validation errors for a negative price and zero duration, and saves nothing', async () => {
    const user = userEvent.setup()
    renderForm([ctx.category])
    await user.type(screen.getByLabelText(/service name/i), 'Deep Clean')
    const duration = screen.getByLabelText(/duration/i)
    await user.clear(duration)
    await user.type(duration, '0')
    const price = screen.getByLabelText(/price/i)
    await user.clear(price)
    await user.type(price, '-5')
    await user.click(screen.getByRole('button', { name: /create service/i }))

    expect(await screen.findByText('Price cannot be negative.')).toBeInTheDocument()
    expect(screen.getByText('Duration must be at least 5 minutes.')).toBeInTheDocument()
    expect(screen.getByLabelText(/price/i)).toHaveAttribute('aria-invalid', 'true')
    expect(await db.services.count()).toBe(2)
  })

  it('creates a service with the price stored in cents', async () => {
    const user = userEvent.setup()
    renderForm([ctx.category])
    await user.type(screen.getByLabelText(/service name/i), 'Deep Clean')
    const duration = screen.getByLabelText(/duration/i)
    await user.clear(duration)
    await user.type(duration, '45')
    const price = screen.getByLabelText(/price/i)
    await user.clear(price)
    await user.type(price, '62.5')
    await user.click(screen.getByRole('button', { name: /create service/i }))

    await waitFor(async () => expect(await db.services.count()).toBe(3))
    const created = (await db.services.toArray()).find((s) => s.name === 'Deep Clean')
    expect(created).toMatchObject({ durationMinutes: 45, priceCents: 6250, isActive: true, staffMode: 'any' })
  })
})

describe('ServicesPage', () => {
  it('deactivates a service after confirmation', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TooltipProvider>
          <ServicesPage />
        </TooltipProvider>
      </MemoryRouter>,
    )
    const table = await screen.findByRole('table', { name: 'Services' })
    await user.click(within(table).getByText('Repair'))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: /deactivate/i }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /^deactivate$/i }))

    await waitFor(async () => expect((await db.services.get(ctx.repair.id))?.isActive).toBe(false))
  })
})
