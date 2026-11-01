import { CalendarX2, Loader2 } from 'lucide-react'
import { TimeSlotPicker } from '@/components/shared/TimeSlotPicker'
import { formatTime } from '@/lib/format'
import { REASON_MESSAGES } from '@/services/availability/engine'
import type { TimeHM } from '@/types/models'
import type { SlotState } from '../hooks/useAdminSlots'

export function SlotChooser({
  state,
  value,
  onChange,
  currentTime,
  idleHint = 'Choose a service, staff member and date to see available times.',
}: {
  state: SlotState
  value: TimeHM | null
  onChange: (time: TimeHM) => void
  /** The appointment's existing time when editing; kept even if it isn't a free slot. */
  currentTime?: TimeHM
  idleHint?: string
}) {
  if (state.status === 'idle') return <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">{idleHint}</p>
  if (state.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Checking availability…
      </p>
    )
  }
  if (state.status === 'error') return <p className="text-sm text-destructive">{state.message}</p>

  const { slots, reason, label } = state.result
  const keepsCurrent = currentTime && value === currentTime && !slots.some((s) => s.start === currentTime)
  return (
    <div className="space-y-3">
      {keepsCurrent && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Keeping the current time, {formatTime(currentTime)}. Pick another time below to move it.
        </p>
      )}
      {slots.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          <CalendarX2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            No available times on this date.{' '}
            {reason ? REASON_MESSAGES[reason] : ''}
            {label ? ` (${label})` : ''}
          </span>
        </div>
      ) : (
        <TimeSlotPicker slots={slots} value={value} onChange={onChange} />
      )}
    </div>
  )
}
