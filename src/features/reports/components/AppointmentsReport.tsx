import { CalendarRange } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { STATUS_LABELS } from '@/services/appointments/status'
import {
  calculateAppointmentStatistics,
  generateServiceReport,
  generateStaffReport,
  pickGranularity,
  volumeSeries,
  type BreakdownRow,
  type DateRange,
  type Granularity,
} from '@/services/reports/reportService'
import type { Appointment, ISODate } from '@/types/models'
import { APPOINTMENT_STATUSES } from '@/types/models'
import { STATUS_VAR } from './chartTheme'
import { HorizontalBars, VolumeChart } from './charts'
import { ExportBar, GranularityToggle } from './ReportControls'
import { percent, type ExportTable } from '../lib/reportData'

const breakdownColumns = (label: string): Column<BreakdownRow>[] => [
  { id: 'name', header: label, cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
  { id: 'total', header: 'Total', cell: (r) => r.total, sortValue: (r) => r.total, className: 'text-right tabular', headerClassName: 'text-right' },
  ...APPOINTMENT_STATUSES.map<Column<BreakdownRow>>((s) => ({
    id: s,
    header: STATUS_LABELS[s],
    cell: (r) => r.byStatus[s],
    sortValue: (r) => r.byStatus[s],
    className: 'text-right tabular text-muted-foreground',
    headerClassName: 'text-right',
  })),
]

function breakdownTable(name: string, label: string, rows: BreakdownRow[]): ExportTable {
  return {
    name,
    headers: [label, 'Total', ...APPOINTMENT_STATUSES.map((s) => STATUS_LABELS[s])],
    rows: rows.map((r) => [r.name, r.total, ...APPOINTMENT_STATUSES.map((s) => r.byStatus[s])]),
  }
}

export function AppointmentsReport({ appointments, range, today }: { appointments: Appointment[]; range: DateRange; today: ISODate }) {
  const [granularity, setGranularity] = useState<Granularity>(() => pickGranularity(range))
  const stats = useMemo(() => calculateAppointmentStatistics(appointments, today), [appointments, today])
  const byService = useMemo(() => generateServiceReport(appointments), [appointments])
  const byStaff = useMemo(() => generateStaffReport(appointments), [appointments])
  const series = useMemo(() => volumeSeries(appointments, range, granularity), [appointments, range, granularity])

  const tables: ExportTable[] = [
    {
      name: 'Appointments by status',
      headers: ['Status', 'Appointments', 'Share'],
      rows: APPOINTMENT_STATUSES.map((s) => [STATUS_LABELS[s], stats.byStatus[s], stats.total ? percent(stats.byStatus[s] / stats.total) : '0%']),
    },
    breakdownTable('Appointments by service', 'Service', byService),
    breakdownTable('Appointments by staff', 'Staff', byStaff),
    {
      name: `Appointment volume by ${granularity}`,
      headers: ['Period start', 'Period', 'Total', ...APPOINTMENT_STATUSES.map((s) => STATUS_LABELS[s])],
      rows: series.map((p) => [p.key, p.label, p.total, ...APPOINTMENT_STATUSES.map((s) => p.byStatus[s])]),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Counted by appointment date. Every status is included, cancellations too.</p>
        <ExportBar kind="appointments-report" range={range} tables={tables} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pending" value={stats.byStatus.pending} tone="pending" />
        <StatCard label="Confirmed" value={stats.byStatus.confirmed} tone="confirmed" />
        <StatCard label="Completed" value={stats.byStatus.completed} tone="completed" hint={`${percent(stats.completionRate)} of decided`} />
        <StatCard label="Cancelled" value={stats.byStatus.cancelled} tone="cancelled" hint={`${percent(stats.cancellationRate)} of all`} />
        <StatCard label="No-show" value={stats.byStatus['no-show']} tone="noshow" hint={`${percent(stats.noShowRate)} of decided`} />
      </div>

      {stats.total === 0 ? (
        <Panel>
          <EmptyState icon={CalendarRange} title="No appointments in this period" description="Pick a wider date range to see the report." />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <VolumeChart
              points={series}
              title="Volume"
              description={`Appointments per ${granularity}`}
              toolbar={<GranularityToggle value={granularity} onChange={setGranularity} />}
            />
            <Panel className="print-area">
              <PanelHeader title="By status" description="Share of all appointments in the period" />
              <div className="px-4 py-4">
                <HorizontalBars
                  valueLabel="Appointments"
                  rows={APPOINTMENT_STATUSES.map((s) => ({
                    id: s,
                    label: <StatusBadge status={s} />,
                    text: STATUS_LABELS[s],
                    value: stats.byStatus[s],
                    display: `${stats.byStatus[s]} · ${stats.total ? percent(stats.byStatus[s] / stats.total) : '0%'}`,
                    color: STATUS_VAR[s]!,
                  }))}
                />
              </div>
            </Panel>
          </div>

          <Panel className="print-area">
            <PanelHeader title="By service" description="Grouped by the service name saved on each appointment" />
            <DataTable columns={breakdownColumns('Service')} rows={byService} getRowId={(r) => r.id} paginate={false} caption="Appointments by service" initialSort={{ id: 'total', dir: 'desc' }} />
          </Panel>
          <Panel className="print-area">
            <PanelHeader title="By staff" />
            <DataTable columns={breakdownColumns('Staff')} rows={byStaff} getRowId={(r) => r.id} paginate={false} caption="Appointments by staff" initialSort={{ id: 'total', dir: 'desc' }} />
          </Panel>
        </>
      )}
    </div>
  )
}
