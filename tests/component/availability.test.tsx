import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/database/db'
import { BusinessHoursCard } from '@/features/availability/components/BusinessHoursCard'
import { WeeklyScheduleEditor } from '@/features/availability/components/WeeklyScheduleEditor'
import { defaultWeeklySchedule } from '@/services/settings/defaults'
import type { WeeklySchedule } from '@/types/models'
import { resetDb } from '../helpers/db'

function EditorHarness() {
  const [week, setWeek] = useState<WeeklySchedule>(defaultWeeklySchedule())
  return <WeeklyScheduleEditor value={week} onChange={setWeek} idPrefix="t" />
}

describe('WeeklyScheduleEditor', () => {
  it('adds and removes working intervals and breaks for a day', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)
    // Default Monday has two intervals (09–12, 13–17).
    expect(screen.getAllByLabelText(/^Monday working interval \d start$/)).toHaveLength(2)

    const addButtons = screen.getAllByRole('button', { name: /add interval/i })
    await user.click(addButtons[0]!) // Monday is first (Monday-first order)
    expect(screen.getAllByLabelText(/^Monday working interval \d start$/)).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Remove monday working interval 3' }))
    expect(screen.getAllByLabelText(/^Monday working interval \d start$/)).toHaveLength(2)

    await user.click(screen.getAllByRole('button', { name: /add break/i })[0]!)
    expect(screen.getByLabelText('Monday break start')).toBeInTheDocument()
  })

  it('shows an inline error for an interval that ends before it starts', () => {
    render(<EditorHarness />)
    fireEvent.change(screen.getByLabelText('Monday working interval 1 end'), { target: { value: '08:00' } })
    expect(screen.getByText('End time must be after start time.')).toBeInTheDocument()
  })

  it('closes a day with the switch', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)
    await user.click(screen.getByRole('switch', { name: 'Monday open' }))
    expect(screen.queryByLabelText(/^Monday working interval/)).not.toBeInTheDocument()
  })
})

describe('BusinessHoursCard', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('refuses to save an invalid interval and shows the reason', async () => {
    const user = userEvent.setup()
    render(<BusinessHoursCard />)
    const end = await screen.findByLabelText('Monday working interval 1 end')
    fireEvent.change(end, { target: { value: '08:00' } })
    await user.click(screen.getByRole('button', { name: 'Save hours' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((a) => /Monday: End time must be after start time/.test(a.textContent ?? ''))).toBe(true)
    // Nothing was written.
    expect((await db.businessHours.get(1))?.intervals[0]?.end).toBe('12:00')
  })

  it('saves valid changes to IndexedDB', async () => {
    const user = userEvent.setup()
    render(<BusinessHoursCard />)
    fireEvent.change(await screen.findByLabelText('Monday working interval 1 start'), { target: { value: '08:00' } })
    await user.click(screen.getByRole('button', { name: 'Save hours' }))
    await waitFor(async () => expect((await db.businessHours.get(1))?.intervals[0]?.start).toBe('08:00'))
    const saveButton = screen.getByRole('button', { name: 'Save hours' })
    await waitFor(() => expect(saveButton).toBeDisabled())
    expect(within(document.body).queryByText(/Fix the highlighted/)).not.toBeInTheDocument()
  })
})
