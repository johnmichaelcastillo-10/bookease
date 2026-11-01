import { CircleDollarSign } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { formatMoney } from '@/lib/format'
import {
  calculateRevenue,
  generateServiceReport,
  generateStaffReport,
  pickGranularity,
  volumeSeries,
  type BreakdownRow,
  type DateRange,
  type Granularity,
} from '@/services/reports/reportService'
import type { Appointment } from '@/types/models'
import { RevenueChart } from './charts'
import { ExportBar, GranularityToggle } from './ReportControls'
import type { ExportTable } from '../lib/reportData'

function revenueColumns(label: string, currency: string): Column<BreakdownRow>[] {
  const money = (n: number) => formatMoney(n, currency)
  return [
    { id: 'name', header: label, cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { id: 'completed', header: 'Completed', cell: (r) => money(r.completedCents), sortValue: (r) => r.completedCents, className: 'text-right tabular', headerClassName: 'text-right' },
    { id: 'projected', header: 'Projected', cell: (r) => money(r.projectedCents), sortValue: (r) => r.projectedCents, className: 'text-right tabular text-muted-foreground', headerClassName: 'text-right' },
    {
      id: 'total',
      header: 'Estimated',
      cell: (r) => money(r.completedCents + r.projectedCents),
      sortValue: (r) => r.completedCents + r.projectedCents,
      className: 'text-right tabular',
      headerClassName: 'text-right',
    },
    { id: 'count', header: 'Completed appts', cell: (r) => r.byStatus.completed, sortValue: (r) => r.byStatus.completed, className: 'text-right tabular text-muted-foreground', headerClassName: 'text-right' },
  ]
}

function revenueTable(name: string, label: string, rows: BreakdownRow[], currency: string): ExportTable {
  return {
    name,
    headers: [label, `Completed (${currency})`, `Projected (${currency})`, `Estimated (${currency})`, 'Completed appointments'],
    rows: rows.map((r) => [r.name, r.completedCents / 100, r.projectedCents / 100, (r.completedCents + r.projectedCents) / 100, r.byStatus.completed]),
  }
}

const DEFINITIONS = [
  ['Completed (realized)', 'Price of appointments marked completed. This is the only figure counted as earned.'],
  ['Projected', 'Price of pending and confirmed appointments. Not earned yet; it changes as bookings are confirmed, completed or cancelled.'],
  ['Estimated', 'Completed plus projected.'],
  ['Lost value', 'Price of cancelled and no-show appointments. Shown for context, never counted as revenue.'],
]

export function RevenueReport({ appointments, range, currency }: { appointments: Appointment[]; range: DateRange; currency: string }) {
  const [granularity, setGranularity] = useState<Granularity>(() => (pickGranularity(range) === 'day' ? 'day' : 'month'))
  const money = (n: number) => formatMoney(n, currency)
  const revenue = useMemo(() => calculateRevenue(appointments), [appointments])
  const byService = useMemo(() => generateServiceReport(appointments), [appointments])
  const byStaff = useMemo(() => generateStaffReport(appointments), [appointments])
  const series = useMemo(() => volumeSeries(appointments, range, granularity), [appointments, range, granularity])
  const byMonth = useMemo(() => volumeSeries(appointments, range, 'month'), [appointments, range])

  const tables: ExportTable[] = [
    {
      name: 'Revenue summary',
      headers: ['Measure', `Amount (${currency})`],
      rows: [
        ['Completed (realized)', revenue.completedCents / 100],
        ['Projected (pending + confirmed)', revenue.projectedCents / 100],
        ['Estimated (completed + projected)', revenue.estimatedCents / 100],
        ['Lost value (cancelled + no-show)', revenue.lostCents / 100],
        ['Average completed appointment', revenue.averageCompletedCents / 100],
      ],
    },
    {
      name: 'Revenue by month',
      headers: ['Month', `Completed (${currency})`, `Projected (${currency})`],
      rows: byMonth.map((p) => [p.label, p.completedCents / 100, p.projectedCents / 100]),
    },
    revenueTable('Revenue by service', 'Service', byService, currency),
    revenueTable('Revenue by staff', 'Staff', byStaff, currency),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Uses the price saved on each appointment when it was booked.</p>
        <ExportBar kind="revenue-report" range={range} tables={tables} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Completed (realized)" value={money(revenue.completedCents)} tone="completed" />
        <StatCard label="Projected" value={money(revenue.projectedCents)} tone="confirmed" hint="Pending + confirmed" />
        <StatCard label="Estimated total" value={money(revenue.estimatedCents)} />
        <StatCard label="Lost value" value={money(revenue.lostCents)} tone="noshow" hint="Cancelled + no-show" />
        <StatCard label="Avg. completed" value={money(revenue.averageCompletedCents)} className="col-span-2 lg:col-span-1" />
      </div>

      {appointments.length === 0 ? (
        <Panel>
          <EmptyState icon={CircleDollarSign} title="No revenue in this period" description="No appointments fall in the selected dates." />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <RevenueChart
              points={series}
              currency={currency}
              title="Revenue over time"
              toolbar={<GranularityToggle value={granularity} onChange={setGranularity} />}
            />
            <Panel className="print-area">
              <PanelHeader title="How revenue is counted" />
              <dl className="space-y-3 px-4 py-4 text-sm">
                {DEFINITIONS.map(([term, text]) => (
                  <div key={term}>
                    <dt className="font-medium">{term}</dt>
                    <dd className="text-muted-foreground">{text}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>

          <Panel className="print-area">
            <PanelHeader title="Revenue by month" />
            <DataTable
              columns={[
                { id: 'label', header: 'Month', cell: (p) => <span className="font-medium">{p.label}</span> },
                { id: 'completed', header: 'Completed', cell: (p) => money(p.completedCents), className: 'text-right tabular', headerClassName: 'text-right' },
                { id: 'projected', header: 'Projected', cell: (p) => money(p.projectedCents), className: 'text-right tabular text-muted-foreground', headerClassName: 'text-right' },
                { id: 'count', header: 'Appointments', cell: (p) => p.total, className: 'text-right tabular text-muted-foreground', headerClassName: 'text-right' },
              ]}
              rows={byMonth}
              getRowId={(p) => p.key}
              paginate={false}
              caption="Revenue by month"
            />
          </Panel>
          <div className="grid gap-4">
            <Panel className="print-area min-w-0">
              <PanelHeader title="Revenue by service" />
              <DataTable columns={revenueColumns('Service', currency)} rows={byService} getRowId={(r) => r.id} paginate={false} caption="Revenue by service" initialSort={{ id: 'completed', dir: 'desc' }} />
            </Panel>
            <Panel className="print-area min-w-0">
              <PanelHeader title="Revenue by staff" />
              <DataTable columns={revenueColumns('Staff', currency)} rows={byStaff} getRowId={(r) => r.id} paginate={false} caption="Revenue by staff" initialSort={{ id: 'completed', dir: 'desc' }} />
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
