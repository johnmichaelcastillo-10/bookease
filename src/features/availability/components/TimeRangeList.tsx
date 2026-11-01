import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TimeRange } from '@/types/models'

/**
 * Editable list of time ranges (start – end), each with a remove button. Used for working
 * intervals, breaks and special-date ranges.
 */
export function TimeRangeList({
  ranges,
  onChange,
  onAdd,
  addLabel,
  label,
  idPrefix,
  disabled,
  minItems = 0,
  errors,
  className,
}: {
  ranges: TimeRange[]
  onChange: (ranges: TimeRange[]) => void
  onAdd: () => void
  addLabel: string
  /** Accessible name for each range, e.g. "Working interval". */
  label: string
  idPrefix: string
  disabled?: boolean
  minItems?: number
  /** Per-index error messages. */
  errors?: (string | undefined)[]
  className?: string
}) {
  const update = (index: number, patch: Partial<TimeRange>) =>
    onChange(ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  return (
    <div className={cn('space-y-1.5', className)}>
      {ranges.map((range, index) => {
        const error = errors?.[index]
        const n = ranges.length > 1 ? ` ${index + 1}` : ''
        return (
          <div key={index}>
            <div className="flex min-w-0 items-center gap-1.5">
              <Input
                id={`${idPrefix}-${index}-start`}
                type="time"
                step={300}
                value={range.start}
                disabled={disabled}
                aria-label={`${label}${n} start`}
                aria-invalid={!!error}
                onChange={(e) => update(index, { start: e.target.value })}
                className="h-8 max-w-[8.75rem] min-w-0 flex-1 basis-0 px-2 tabular"
              />
              <span className="text-muted-foreground" aria-hidden>
                –
              </span>
              <Input
                id={`${idPrefix}-${index}-end`}
                type="time"
                step={300}
                value={range.end}
                disabled={disabled}
                aria-label={`${label}${n} end`}
                aria-invalid={!!error}
                onChange={(e) => update(index, { end: e.target.value })}
                className="h-8 max-w-[8.75rem] min-w-0 flex-1 basis-0 px-2 tabular"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled || ranges.length <= minItems}
                onClick={() => onChange(ranges.filter((_, i) => i !== index))}
                aria-label={`Remove ${label.toLowerCase()}${n}`}
              >
                <X />
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
        )
      })}
      <Button type="button" variant="ghost" size="xs" onClick={onAdd} disabled={disabled} className="-ml-1.5 text-muted-foreground">
        <Plus /> {addLabel}
      </Button>
    </div>
  )
}
