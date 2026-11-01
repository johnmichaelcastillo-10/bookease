import { useSearchParams } from 'react-router'
import { formatISODate } from '@/lib/format'
import { isValidISODate } from '@/lib/time'
import { presetRange, type DateRange, type RangePreset } from '@/services/reports/reportService'
import type { ISODate } from '@/types/models'

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
  last30: 'Last 30 days',
  custom: 'Custom range',
}

export const PRESETS = Object.keys(PRESET_LABELS) as RangePreset[]

export interface RangeState {
  preset: RangePreset
  range: DateRange
  setPreset: (preset: RangePreset) => void
  setCustom: (range: DateRange) => void
}

/** Date range kept in the URL (`?range=week` or `?range=custom&from=…&to=…`) so it survives refresh and sharing. */
export function useRangeFilter(today: ISODate, defaultPreset: Exclude<RangePreset, 'custom'> = 'month'): RangeState {
  const [params, setParams] = useSearchParams()
  const raw = params.get('range') as RangePreset | null
  const preset: RangePreset = raw && PRESETS.includes(raw) ? raw : defaultPreset

  let range: DateRange
  if (preset === 'custom') {
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    range = isValidISODate(from) && isValidISODate(to) && from <= to ? { from, to } : presetRange('last30', today)
  } else {
    range = presetRange(preset, today)
  }

  const update = (next: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(next)) {
          if (v === null) p.delete(k)
          else p.set(k, v)
        }
        return p
      },
      { replace: true },
    )

  return {
    preset,
    range,
    setPreset: (p) =>
      p === 'custom'
        ? update({ range: 'custom', from: range.from, to: range.to })
        : update({ range: p === defaultPreset ? null : p, from: null, to: null }),
    setCustom: (r) => update({ range: 'custom', from: r.from, to: r.to }),
  }
}

export function describeRange(range: DateRange): string {
  return range.from === range.to
    ? formatISODate(range.from)
    : `${formatISODate(range.from, 'MMM d, yyyy')} – ${formatISODate(range.to, 'MMM d, yyyy')}`
}
