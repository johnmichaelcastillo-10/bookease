import { DatePicker } from '@/components/shared/DatePicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RangePreset } from '@/services/reports/reportService'
import { PRESET_LABELS, PRESETS, type RangeState } from '../lib/rangeState'

/** Preset select (today, week, month, year, last 30 days) plus two date pickers for a custom range. */
export function RangeFilter({ state }: { state: RangeState }) {
  const { preset, range, setPreset, setCustom } = state
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
        <SelectTrigger className="w-[150px]" aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            value={range.from}
            onChange={(from) => setCustom({ from, to: from > range.to ? from : range.to })}
            aria-label="From date"
            className="w-[170px]"
          />
          <span className="text-sm text-muted-foreground" aria-hidden>
            to
          </span>
          <DatePicker
            value={range.to}
            onChange={(to) => setCustom({ from: to < range.from ? to : range.from, to })}
            aria-label="To date"
            className="w-[170px]"
          />
        </div>
      )}
    </div>
  )
}
