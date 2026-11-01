/**
 * Chart colours reuse the appointment status tokens from index.css, so a chart reads the same
 * way as the status badges everywhere else: completed = green, scheduled (pending + confirmed)
 * = blue, cancelled & no-show = grey. The tokens are tuned per theme, so charts follow light and
 * dark mode automatically. Every chart also has a table view and a direct legend, so colour is
 * never the only way to read a value.
 */
export interface ChartTheme {
  completed: string
  scheduled: string
  lost: string
  /** Surface colour used for the 2px gap between touching marks. */
  surface: string
}

const THEME: ChartTheme = {
  completed: 'var(--completed)',
  scheduled: 'var(--confirmed)',
  lost: 'var(--cancelled)',
  surface: 'var(--card)',
}

export function useChartTheme(): ChartTheme {
  return THEME
}

/** Status colours come from the theme's reserved status tokens (always shown with a label). */
export const STATUS_VAR: Record<string, string> = {
  pending: 'var(--pending)',
  confirmed: 'var(--confirmed)',
  completed: 'var(--completed)',
  cancelled: 'var(--cancelled)',
  'no-show': 'var(--noshow)',
}
