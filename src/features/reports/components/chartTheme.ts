import { useResolvedTheme } from '@/app/providers/ThemeProvider'

/**
 * Categorical series colours, validated with the dataviz palette checker against BookEase's
 * card surfaces (light #ffffff, dark #161a1f): lightness band, chroma floor, CVD and
 * normal-vision separation all pass. Slot 3's light contrast is 2.8:1, so every chart also
 * has a table view and direct legends.
 *
 * Colour follows the entity, never the rank:
 *   completed → slot 1, scheduled / projected → slot 2, cancelled & no-show / lost → slot 3.
 */
const PALETTE = {
  light: { series: ['#2a78d6', '#eb6834', '#1baf7a'], surface: '#ffffff' },
  dark: { series: ['#3987e5', '#d95926', '#199e70'], surface: '#161a1f' },
} as const

export interface ChartTheme {
  completed: string
  scheduled: string
  lost: string
  /** Surface colour used for the 2px gap between touching marks. */
  surface: string
}

export function useChartTheme(): ChartTheme {
  const mode = useResolvedTheme()
  const p = PALETTE[mode]
  return { completed: p.series[0], scheduled: p.series[1], lost: p.series[2], surface: p.surface }
}

/** Status colours come from the theme's reserved status tokens (always shown with a label). */
export const STATUS_VAR: Record<string, string> = {
  pending: 'var(--pending)',
  confirmed: 'var(--confirmed)',
  completed: 'var(--completed)',
  cancelled: 'var(--cancelled)',
  'no-show': 'var(--noshow)',
}
