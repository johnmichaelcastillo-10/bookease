/** RFC 4180 CSV. Cells that a spreadsheet would run as a formula are prefixed with a quote. */

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

function escapeCell(raw: string | number | boolean | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  let text = String(raw)
  // CSV injection guard: =, +, -, @ at the start make Excel/Sheets evaluate the cell.
  if (typeof raw === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')]
  for (const row of rows) lines.push(columns.map((c) => escapeCell(c.value(row))).join(','))
  // BOM so Excel opens UTF-8 names correctly.
  return '﻿' + lines.join('\r\n')
}
