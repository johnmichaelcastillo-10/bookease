import { Download, FileJson, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { DateRange, Granularity } from '@/services/reports/reportService'
import { exportTablesCsv, exportTablesJson, reportFileName, type ExportTable } from '../lib/reportData'

export function ExportBar({ kind, range, tables }: { kind: string; range: DateRange; tables: ExportTable[] }) {
  const empty = tables.every((t) => t.rows.length === 0)
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={empty}
        onClick={() => {
          exportTablesCsv(reportFileName(kind, range, 'csv'), tables)
          toast.success('CSV downloaded.')
        }}
      >
        <Download /> CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={empty}
        onClick={() => {
          exportTablesJson(reportFileName(kind, range, 'json'), range, tables)
          toast.success('JSON downloaded.')
        }}
      >
        <FileJson /> JSON
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer /> Print
      </Button>
    </div>
  )
}

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

export function GranularityToggle({ value, onChange }: { value: Granularity; onChange: (g: Granularity) => void }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={value}
      onValueChange={(v) => v && onChange(v as Granularity)}
      aria-label="Group by"
      className="no-print"
    >
      {GRANULARITIES.map((g) => (
        <ToggleGroupItem key={g.value} value={g.value} className="px-2.5 text-xs">
          {g.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
