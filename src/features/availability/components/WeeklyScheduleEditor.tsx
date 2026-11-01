import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '@/services/settings/defaults'
import type { DaySchedule, Weekday, WeeklySchedule } from '@/types/models'
import { nextRange, suggestBreak } from '../lib'
import { TimeRangeList } from './TimeRangeList'
import { validateWeek } from './scheduleValidation'

/**
 * Monday-first weekly hours: each day can be closed or open with one or more working
 * intervals and optional breaks (which are subtracted from the intervals).
 */
export function WeeklyScheduleEditor({
  value,
  onChange,
  disabled,
  idPrefix = 'week',
}: {
  value: WeeklySchedule
  onChange: (next: WeeklySchedule) => void
  disabled?: boolean
  idPrefix?: string
}) {
  const errors = validateWeek(value)
  const setDay = (wd: Weekday, day: DaySchedule) => onChange({ ...value, [wd]: day })

  const copyMondayToWeekdays = () => {
    const monday = value[1]
    const next = { ...value }
    for (const wd of [2, 3, 4, 5] as Weekday[]) next[wd] = structuredClone(monday)
    onChange(next)
  }

  return (
    <div>
      <div className="flex justify-end border-b px-4 py-2">
        <Button type="button" variant="ghost" size="xs" onClick={copyMondayToWeekdays} disabled={disabled}>
          <Copy /> Copy Monday to weekdays
        </Button>
      </div>
      <ul className="divide-y">
        {WEEKDAY_ORDER.map((wd) => {
          const day = value[wd]
          const dayErrors = errors[wd]
          const label = WEEKDAY_LABELS[wd]
          const switchId = `${idPrefix}-${wd}-open`
          return (
            <li key={wd} className="grid gap-3 px-4 py-3 md:grid-cols-[9rem_minmax(0,1fr)]">
              <div className="flex items-center gap-2.5 md:items-start md:pt-1.5">
                <Switch
                  id={switchId}
                  checked={day.isOpen}
                  disabled={disabled}
                  onCheckedChange={(isOpen) =>
                    setDay(wd, isOpen && day.intervals.length === 0 ? { ...day, isOpen, intervals: [nextRange([])] } : { ...day, isOpen })
                  }
                  aria-label={`${label} open`}
                />
                <label htmlFor={switchId} className={cn('text-sm font-medium', !day.isOpen && 'text-muted-foreground')}>
                  {label}
                </label>
              </div>

              {day.isOpen ? (
                <div className="@container min-w-0">
                <div className="grid gap-4 @[40rem]:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Working hours</p>
                    <TimeRangeList
                      ranges={day.intervals}
                      onChange={(intervals) => setDay(wd, { ...day, intervals })}
                      onAdd={() => setDay(wd, { ...day, intervals: [...day.intervals, nextRange(day.intervals)] })}
                      addLabel="Add interval"
                      label={`${label} working interval`}
                      idPrefix={`${idPrefix}-${wd}-interval`}
                      disabled={disabled}
                      minItems={1}
                      errors={dayErrors?.intervals}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Breaks</p>
                    {day.breaks.length === 0 && <p className="mb-1 text-xs text-muted-foreground">No breaks</p>}
                    <TimeRangeList
                      ranges={day.breaks}
                      onChange={(breaks) => setDay(wd, { ...day, breaks })}
                      onAdd={() => setDay(wd, { ...day, breaks: [...day.breaks, suggestBreak(day)] })}
                      addLabel="Add break"
                      label={`${label} break`}
                      idPrefix={`${idPrefix}-${wd}-break`}
                      disabled={disabled}
                      errors={dayErrors?.breaks}
                    />
                  </div>
                  {dayErrors?.day && (
                    <p role="alert" className="text-xs font-medium text-destructive @[40rem]:col-span-2">
                      {dayErrors.day}
                    </p>
                  )}
                </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground md:pt-1.5">Closed</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
