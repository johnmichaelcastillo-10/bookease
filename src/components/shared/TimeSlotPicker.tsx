import { formatTime } from '@/lib/format'
import { toMinutes } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Slot } from '@/services/availability/engine'
import type { TimeHM } from '@/types/models'

const PERIODS = [
  { label: 'Morning', test: (m: number) => m < 12 * 60 },
  { label: 'Afternoon', test: (m: number) => m >= 12 * 60 && m < 17 * 60 },
  { label: 'Evening', test: (m: number) => m >= 17 * 60 },
]

/**
 * Grid of generated slots grouped by part of day. A radio group for screen readers:
 * arrow keys aren't wired, but every slot is a focusable button with aria-pressed.
 */
export function TimeSlotPicker({
  slots,
  value,
  onChange,
  className,
  label = 'Available times',
}: {
  slots: Slot[]
  value: TimeHM | null
  onChange: (start: TimeHM) => void
  className?: string
  label?: string
}) {
  return (
    <div className={cn('space-y-4', className)} role="group" aria-label={label}>
      {PERIODS.map((period) => {
        const group = slots.filter((s) => period.test(toMinutes(s.start)))
        if (group.length === 0) return null
        return (
          <div key={period.label}>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{period.label}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {group.map((slot) => {
                const selected = slot.start === value
                return (
                  <button
                    key={slot.start}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(slot.start)}
                    className={cn(
                      'h-9 rounded-md border text-sm tabular transition-colors',
                      'hover:border-primary/60 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      selected ? 'border-primary bg-primary text-primary-foreground hover:bg-primary' : 'bg-background',
                    )}
                  >
                    {formatTime(slot.start)}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
