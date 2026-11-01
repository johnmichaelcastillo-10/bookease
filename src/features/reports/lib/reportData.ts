import { useLiveQuery } from 'dexie-react-hooks'
import { toCsv } from '@/lib/csv'
import { downloadFile, downloadJson } from '@/lib/download'
import { loadReportData, type DateRange } from '@/services/reports/reportService'

/** Live report inputs for a period; re-runs when records change in any tab. */
export function useReportData(range: DateRange) {
  return useLiveQuery(() => loadReportData(range), [range.from, range.to])
}

export interface ExportTable {
  name: string
  headers: string[]
  rows: (string | number)[][]
}

/** Several tables in one CSV, separated by a blank line and a title row. */
export function tablesToCsv(tables: ExportTable[]): string {
  return tables
    .map((t) =>
      toCsv(t.rows, t.headers.map((header, i) => ({ header, value: (row: (string | number)[]) => row[i] })))
        // Only the first table keeps the BOM.
        .replace(/^\uFEFF/, ''),
    )
    .map((csv, i) => `${tables[i]!.name}\r\n${csv}`)
    .reduce((all, part, i) => (i === 0 ? '\uFEFF' + part : `${all}\r\n\r\n${part}`), '')
}

export function exportTablesCsv(filename: string, tables: ExportTable[]): void {
  downloadFile(filename, tablesToCsv(tables), 'text/csv;charset=utf-8')
}

export function exportTablesJson(filename: string, range: DateRange, tables: ExportTable[]): void {
  downloadJson(filename, {
    generatedAt: new Date().toISOString(),
    period: range,
    tables: tables.map((t) => ({
      name: t.name,
      rows: t.rows.map((row) => Object.fromEntries(t.headers.map((h, i) => [h, row[i]]))),
    })),
  })
}

export function reportFileName(kind: string, range: DateRange, ext: 'csv' | 'json'): string {
  return `bookease-${kind}-${range.from}_to_${range.to}.${ext}`
}

export const percent = (n: number) => `${Math.round(n * 100)}%`
