import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { LoadingState } from '@/components/feedback/states'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { businessHoursRepository } from '@/database/repositories/availabilityRepository'
import { updateBusinessHours } from '@/services/availability/availabilityService'
import { errorMessage } from '@/services/errors'
import { defaultWeeklySchedule } from '@/services/settings/defaults'
import type { WeeklySchedule } from '@/types/models'
import { sameSchedule, toBusinessHours, toWeeklySchedule } from '../lib'
import { validateWeek } from './scheduleValidation'
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor'

/** Weekly operating hours of the business. */
export function BusinessHoursCard() {
  const stored = useLiveQuery(() => businessHoursRepository.list(), [])
  if (!stored) {
    return (
      <Panel>
        <PanelHeader title="Business hours" />
        <LoadingState />
      </Panel>
    )
  }
  const week = toWeeklySchedule(stored, stored.length === 0 ? defaultWeeklySchedule() : defaultClosedWeek())
  // Re-key on the stored value so saving (or a change in another tab) resets the draft.
  return <BusinessHoursForm key={JSON.stringify(week)} saved={week} />
}

function defaultClosedWeek(): WeeklySchedule {
  const week = defaultWeeklySchedule()
  for (const wd of [0, 1, 2, 3, 4, 5, 6] as const) week[wd] = { isOpen: false, intervals: [], breaks: [] }
  return week
}

function BusinessHoursForm({ saved }: { saved: WeeklySchedule }) {
  const [draft, setDraft] = useState<WeeklySchedule>(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = !sameSchedule(draft, saved)
  const invalid = Object.keys(validateWeek(draft)).length > 0

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await updateBusinessHours(toBusinessHours(draft))
      toast.success('Business hours saved.')
    } catch (e) {
      const message = errorMessage(e)
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Business hours"
        description="When the business is open each week. Breaks are removed from the working intervals."
        actions={
          <>
            <Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={() => { setDraft(saved); setError(null) }}>
              Discard
            </Button>
            <Button size="sm" disabled={!dirty || saving} onClick={save}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              Save hours
            </Button>
          </>
        }
      />
      <WeeklyScheduleEditor value={draft} onChange={setDraft} idPrefix="business" />
      {(error || (dirty && invalid)) && (
        <p role="alert" className="border-t px-4 py-2.5 text-sm text-destructive">
          {error ?? 'Fix the highlighted times before saving.'}
        </p>
      )}
    </Panel>
  )
}
