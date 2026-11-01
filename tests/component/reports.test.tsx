import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedDemoData } from '@/database/seed/demoData'
import ReportsPage from '@/features/reports/pages/ReportsPage'
import { tablesToCsv } from '@/features/reports/lib/reportData'
import { resetDb } from '../helpers/db'

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/admin/reports', element: <ReportsPage /> }], { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

let blobs: Blob[] = []
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL

beforeEach(async () => {
  await resetDb()
  await seedDemoData()
  blobs = []
  URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
    blobs.push(b as Blob)
    return 'blob:test'
  })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

describe('ReportsPage', () => {
  it('switches between the appointments, revenue and customers tabs', async () => {
    const user = userEvent.setup()
    renderAt('/admin/reports?range=last30')
    expect(await screen.findByText('By service')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Revenue' }))
    expect(await screen.findByText('How revenue is counted')).toBeInTheDocument()
    expect(screen.getByText('Completed (realized)', { selector: 'p' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Customers' }))
    expect(await screen.findByRole('heading', { name: 'Top customers' })).toBeInTheDocument()
  })

  it('exports the appointments tables as CSV with the expected headers', async () => {
    const user = userEvent.setup()
    renderAt('/admin/reports?range=last30')
    await screen.findByText('By service')
    await user.click(screen.getByRole('button', { name: /CSV/ }))

    await waitFor(() => expect(blobs).toHaveLength(1))
    const text = await blobs[0]!.text()
    const lines = text.replace(/^\uFEFF/, '').split('\r\n')
    expect(lines[0]).toBe('Appointments by status')
    expect(lines[1]).toBe('Status,Appointments,Share')
    expect(text).toContain('Service,Total,Pending,Confirmed,Completed,Cancelled,No-show')
    expect(text).toContain('Staff,Total,Pending,Confirmed,Completed,Cancelled,No-show')
  })

  it('exports JSON for the revenue tab', async () => {
    const user = userEvent.setup()
    renderAt('/admin/reports?range=last30&tab=revenue')
    await screen.findByText('How revenue is counted')
    await user.click(screen.getByRole('button', { name: /JSON/ }))
    await waitFor(() => expect(blobs).toHaveLength(1))
    const json = JSON.parse(await blobs[0]!.text())
    expect(json.tables.map((t: { name: string }) => t.name)).toEqual(['Revenue summary', 'Revenue by month', 'Revenue by service', 'Revenue by staff'])
  })
})

describe('tablesToCsv', () => {
  it('joins tables with a title row and keeps one BOM', () => {
    const csv = tablesToCsv([
      { name: 'A', headers: ['x', 'y'], rows: [[1, 'a,b']] },
      { name: 'B', headers: ['z'], rows: [] },
    ])
    expect(csv.match(/\uFEFF/g)).toHaveLength(1)
    expect(csv).toBe('\uFEFFA\r\nx,y\r\n1,"a,b"\r\n\r\nB\r\nz')
  })
})
