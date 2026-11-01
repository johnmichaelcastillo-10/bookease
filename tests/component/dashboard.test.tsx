import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { customersRepository } from '@/database/repositories/customersRepository'
import { seedDemoData } from '@/database/seed/demoData'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import { formatMoney } from '@/lib/format'
import { calculateAppointmentStatistics, calculateRevenue, presetRange } from '@/services/reports/reportService'
import { resetDb, TODAY } from '../helpers/db'

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/admin', element: <DashboardPage /> }], { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

/** The big number inside the StatCard with this label. */
function statValue(label: string): string {
  const labelEl = screen.getByText(label, { selector: 'p' })
  const card = labelEl.closest('div.rounded-lg')
  return card?.querySelector('p.text-2xl')?.textContent ?? ''
}

beforeEach(async () => {
  await resetDb()
  await seedDemoData()
})

describe('DashboardPage', () => {
  it('shows KPIs calculated from the stored appointments for the selected range', async () => {
    renderAt('/admin')
    await screen.findByText('Estimated revenue', { selector: 'p' })

    const month = presetRange('month', TODAY)
    const inMonth = await appointmentsRepository.listRange(month.from, month.to)
    const all = await appointmentsRepository.listAll()
    const stats = calculateAppointmentStatistics(inMonth, TODAY)
    const revenue = calculateRevenue(inMonth)

    expect(stats.total).toBeGreaterThan(0)
    expect(statValue('Appointments')).toBe(String(stats.total))
    expect(statValue('Pending')).toBe(String(stats.byStatus.pending))
    expect(statValue('Confirmed')).toBe(String(stats.byStatus.confirmed))
    expect(statValue('Completed')).toBe(String(stats.byStatus.completed))
    expect(statValue('Cancelled')).toBe(String(stats.byStatus.cancelled))
    expect(statValue('Today')).toBe(String(calculateAppointmentStatistics(all, TODAY).today))
    expect(statValue('Customers')).toBe(String(await customersRepository.count()))
    expect(statValue('Estimated revenue')).toBe(formatMoney(revenue.estimatedCents, 'USD'))
  })

  it('reads the range from the URL', async () => {
    renderAt('/admin?range=today')
    await screen.findByText('Estimated revenue', { selector: 'p' })
    const today = await appointmentsRepository.listRange(TODAY, TODAY)
    await waitFor(() => expect(statValue('Appointments')).toBe(String(today.length)))
  })

  it('lists upcoming pending and confirmed appointments', async () => {
    renderAt('/admin')
    const panel = await screen.findByText('Upcoming appointments')
    const list = panel.closest('section')!
    await waitFor(() => expect(list.querySelectorAll('li').length).toBeGreaterThan(0))
    expect(list.querySelectorAll('li').length).toBeLessThanOrEqual(8)
  })

  it('shows an empty state when there are no appointments', async () => {
    await resetDb()
    renderAt('/admin')
    expect(await screen.findByText('No appointments yet')).toBeInTheDocument()
  })
})
