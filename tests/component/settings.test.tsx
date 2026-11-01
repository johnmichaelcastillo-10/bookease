import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { db } from '@/database/db'
import { getBusinessSettings } from '@/database/repositories/settingsRepository'
import SettingsPage from '@/features/settings/pages/SettingsPage'
import { useUiStore } from '@/store/uiStore'
import { resetDb, seedBasics } from '../helpers/db'

function renderSettings(tab: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/settings?tab=${tab}`]}>
      <TooltipProvider>
        <SettingsPage />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  localStorage.clear()
  useUiStore.setState({ theme: 'system', sidebarCollapsed: false, pageSize: 10 })
  await resetDb()
})

describe('Settings › appearance', () => {
  it('persists the theme preference to localStorage', async () => {
    const user = userEvent.setup()
    renderSettings('appearance')
    await user.click(await screen.findByRole('radio', { name: 'Dark' }))
    expect(useUiStore.getState().theme).toBe('dark')
    const stored = JSON.parse(localStorage.getItem('bookease-ui') ?? '{}')
    expect(stored.state.theme).toBe('dark')
  })
})

describe('Settings › booking rules', () => {
  it('shows a validation error and saves valid values', async () => {
    const user = userEvent.setup()
    renderSettings('booking')
    const advance = await screen.findByLabelText('Maximum advance booking (days)')

    await user.clear(advance)
    await user.type(advance, '0')
    await user.click(screen.getByRole('button', { name: 'Save rules' }))
    expect(await screen.findByText('At least 1 day.')).toBeInTheDocument()
    expect((await getBusinessSettings()).maxAdvanceDays).toBe(60)

    await user.clear(advance)
    await user.type(advance, '90')
    await user.click(screen.getByRole('switch', { name: 'Let customers choose staff' }))
    await user.click(screen.getByRole('button', { name: 'Save rules' }))
    await waitFor(async () => expect((await getBusinessSettings()).maxAdvanceDays).toBe(90))
    expect((await getBusinessSettings()).allowStaffSelection).toBe(false)
  })
})

describe('Settings › data', () => {
  it('rejects an invalid backup file and changes nothing', async () => {
    await seedBasics()
    const before = await db.services.count()
    const user = userEvent.setup()
    renderSettings('data')

    const input = await screen.findByLabelText('Backup file')
    await user.upload(input, new File(['{ not json'], 'backup.json', { type: 'application/json' }))
    expect(await screen.findByText('This backup can’t be imported')).toBeInTheDocument()
    expect(screen.getByText('This file is not valid JSON.')).toBeInTheDocument()

    const wrongRecord = { app: 'bookease', schemaVersion: 2, exportedAt: '2026-01-01T00:00:00.000Z', data: { services: [{ id: 'x', priceCents: -1 }] } }
    await user.upload(input, new File([JSON.stringify(wrongRecord)], 'backup.json', { type: 'application/json' }))
    expect(await screen.findByText(/invalid record/)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await db.services.count()).toBe(before)
  })

  it('asks for confirmation before replacing data with a valid backup', async () => {
    const { exportBackup } = await import('@/services/data/backupService')
    await seedBasics()
    const backup = JSON.stringify(await exportBackup())
    await db.services.clear()
    const user = userEvent.setup()
    renderSettings('data')

    await user.upload(await screen.findByLabelText('Backup file'), new File([backup], 'b.json', { type: 'application/json' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Replace all data with this backup?')
    expect(await db.services.count()).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Replace all data' }))
    await waitFor(async () => expect(await db.services.count()).toBe(2))
  })
})
