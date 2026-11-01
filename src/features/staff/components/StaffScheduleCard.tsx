import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { LoadingState } from '@/components/feedback/states'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { businessHoursRepository } from '@/database/repositories/availabilityRepository'
import { staffSchedulesRepository } from '@/database/repositories/staffRepository'
import { formatTimeRange } from '@/lib/format'
import { errorMessage } from '@/services/errors'
import { defaultWeeklySchedule, WEEKDAY_LABELS, WEEKDAY_ORDER } from '@/services/settings/defaults'
import { updateStaffSchedule } from '@/services/staff/staffService'
import type { DaySchedule, Staff, StaffSchedule, WeeklySchedule } from '@/types/models'
import { validateWeek } from '@/features/availability/components/scheduleValidation'
import { WeeklyScheduleEditor } from '@/features/availability/components/WeeklyScheduleEditor'
import { sameSchedule, toWeeklySchedule } from '@/features/availability/lib'

type Mode = StaffSchedule['mode']

/** Working hours for one staff member: follow business hours, or a custom weekly schedule. */
export function StaffScheduleCard({ staff }: { staff: Staff }) {
  const schedule = useLiveQuery(() => staffSchedulesRepository.get(staff.id).then((s) => s ?? null), [staff.id])
  const businessHours = useLiveQuery(() => businessHoursRepository.list(), [])
  if (schedule === undefined || !businessHours) {
    return (
      <Panel>
        <PanelHeader title="Working hours" />
        <LoadingState />
      </Panel>
    )
  }
  const businessWeek = toWeeklySchedule(businessHours, defaultWeeklySchedule())
  const saved: StaffSchedule = schedule ?? { staffId: staff.id, mode: 'business-hours', days: businessWeek }
  return <ScheduleForm key={JSON.stringify(saved)} staff={staff} saved={saved} businessWeek={businessWeek} />
}

function ScheduleForm({ staff, saved, businessWeek }: { staff: Staff; saved: StaffSchedule; businessWeek: WeeklySchedule }) {
  const [mode, setMode] = useState<Mode>(saved.mode)
  // A schedule that was never customised starts from the business hours.
  const [days, setDays] = useState<WeeklySchedule>(saved.mode === 'custom' ? saved.days : structuredClone(businessWeek))
  const [saving, setSaving] = useState(false)

  const dirty = mode !== saved.mode || (mode === 'custom' && !sameSchedule(days, saved.days))
  const invalid = mode === 'custom' && Object.keys(validateWeek(days)).length > 0

  async function save() {
    setSaving(true)
    try {
      await updateStaffSchedule({ staffId: staff.id, mode, days: mode === 'custom' ? days : saved.days })
      toast.success('Working hours saved.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Working hours"
        description="Bookable time is always limited to business hours, minus leave and existing appointments."
        actions={
          <Button size="sm" disabled={!dirty || saving || invalid} onClick={save}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Save hours
          </Button>
        }
      />
      <div className="border-b px-4 py-2.5">
        <ToggleGroup type="single" size="sm" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as Mode)} aria-label="Schedule type">
          <ToggleGroupItem value="business-hours" className="data-[state=on]:border-primary/40 data-[state=on]:bg-brand-soft data-[state=on]:text-primary">Follow business hours</ToggleGroupItem>
          <ToggleGroupItem value="custom" className="data-[state=on]:border-primary/40 data-[state=on]:bg-brand-soft data-[state=on]:text-primary">Custom hours</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {mode === 'custom' ? (
        <>
          <WeeklyScheduleEditor value={days} onChange={setDays} idPrefix={`staff-${staff.id}`} />
          {invalid && (
            <p role="alert" className="border-t px-4 py-2.5 text-sm text-destructive">
              Fix the highlighted times before saving.
            </p>
          )}
        </>
      ) : (
        <WeekSummary week={businessWeek} />
      )}
    </Panel>
  )
}

function describeDay(day: DaySchedule): string {
  if (!day.isOpen || day.intervals.length === 0) return 'Closed'
  const hours = day.intervals.map((r) => formatTimeRange(r.start, r.end)).join(', ')
  const breaks = day.breaks.length ? ` · break ${day.breaks.map((r) => formatTimeRange(r.start, r.end)).join(', ')}` : ''
  return hours + breaks
}

function WeekSummary({ week }: { week: WeeklySchedule }) {
  return (
    <dl className="divide-y">
      {WEEKDAY_ORDER.map((wd) => (
        <div key={wd} className="grid grid-cols-[6.5rem_1fr] gap-2 px-4 py-2 text-sm">
          <dt className="font-medium">{WEEKDAY_LABELS[wd]}</dt>
          <dd className={week[wd].isOpen ? 'tabular' : 'text-muted-foreground'}>{describeDay(week[wd])}</dd>
        </div>
      ))}
    </dl>
  )
}
