import { UsersRound } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/feedback/states'
import { DataTable } from '@/components/shared/DataTable'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { formatISODate, formatMoney } from '@/lib/format'
import { generateCustomerReport, type DateRange } from '@/services/reports/reportService'
import type { Appointment, Customer } from '@/types/models'
import { useChartTheme } from './chartTheme'
import { HorizontalBars } from './charts'
import { ExportBar } from './ReportControls'
import type { ExportTable } from '../lib/reportData'

export function CustomersReport({
  customers,
  allAppointments,
  range,
  currency,
  timeZone,
}: {
  customers: Customer[]
  allAppointments: Appointment[]
  range: DateRange
  currency: string
  timeZone: string
}) {
  const theme = useChartTheme()
  const report = useMemo(() => generateCustomerReport(customers, allAppointments, range, timeZone), [customers, allAppointments, range, timeZone])
  const money = (n: number) => formatMoney(n, currency)

  const tables: ExportTable[] = [
    {
      name: 'Customer summary',
      headers: ['Measure', 'Value'],
      rows: [
        ['Total customers', report.totalCustomers],
        ['New customers (registered in period)', report.newCustomers],
        ['Active customers (booked in period)', report.activeCustomers],
        ['First-time customers', report.firstTimeCustomers],
        ['Returning customers', report.returningCustomers],
        ['Average appointments per active customer', Number(report.averageAppointmentsPerActiveCustomer.toFixed(2))],
      ],
    },
    { name: 'Appointment frequency', headers: ['Visits in period', 'Customers'], rows: report.frequency.map((f) => [f.label, f.customers]) },
    {
      name: 'Top customers',
      headers: ['Customer', 'Email', 'Appointments', 'Completed', `Completed revenue (${currency})`, 'Latest appointment'],
      rows: report.topCustomers.map((c) => [c.name, c.email, c.appointments, c.completed, c.completedCents / 100, c.lastDate]),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Active means at least one non-cancelled appointment in the period.</p>
        <ExportBar kind="customers-report" range={range} tables={tables} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total customers" value={report.totalCustomers} />
        <StatCard label="New" value={report.newCustomers} hint="Registered in period" />
        <StatCard label="Active" value={report.activeCustomers} hint="Booked in period" />
        <StatCard label="First-time" value={report.firstTimeCustomers} />
        <StatCard label="Returning" value={report.returningCustomers} hint="Had an earlier visit" />
        <StatCard label="Avg. visits" value={report.averageAppointmentsPerActiveCustomer.toFixed(1)} hint="Per active customer" />
      </div>

      {report.activeCustomers === 0 ? (
        <Panel>
          <EmptyState icon={UsersRound} title="No customer activity in this period" description="No customer has a non-cancelled appointment in the selected dates." />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="print-area">
              <PanelHeader title="Appointment frequency" description="Active customers by number of visits in the period" />
              <div className="px-4 py-4">
                <HorizontalBars
                  valueLabel="Customers"
                  rows={report.frequency.map((f) => ({ id: f.label, label: f.label, text: f.label, value: f.customers, display: String(f.customers), color: theme.completed }))}
                />
              </div>
            </Panel>
            <Panel className="print-area">
              <PanelHeader title="First-time vs returning" description="Active customers in the period" />
              <div className="px-4 py-4">
                <HorizontalBars
                  valueLabel="Customers"
                  rows={[
                    { id: 'first', label: 'First-time', text: 'First-time', value: report.firstTimeCustomers, display: String(report.firstTimeCustomers), color: theme.scheduled },
                    { id: 'returning', label: 'Returning', text: 'Returning', value: report.returningCustomers, display: String(report.returningCustomers), color: theme.completed },
                  ]}
                />
              </div>
            </Panel>
          </div>
          <Panel className="print-area">
            <PanelHeader title="Top customers" description="By appointments in the period" />
            <DataTable
              columns={[
                {
                  id: 'name',
                  header: 'Customer',
                  cell: (c) => (
                    <Link to={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  ),
                  sortValue: (c) => c.name,
                },
                { id: 'email', header: 'Email', cell: (c) => <span className="text-muted-foreground">{c.email}</span>, className: 'max-w-56 truncate' },
                { id: 'appointments', header: 'Appointments', cell: (c) => c.appointments, sortValue: (c) => c.appointments, className: 'text-right tabular', headerClassName: 'text-right' },
                { id: 'completed', header: 'Completed', cell: (c) => c.completed, sortValue: (c) => c.completed, className: 'text-right tabular', headerClassName: 'text-right' },
                { id: 'revenue', header: 'Completed revenue', cell: (c) => money(c.completedCents), sortValue: (c) => c.completedCents, className: 'text-right tabular', headerClassName: 'text-right' },
                { id: 'last', header: 'Latest', cell: (c) => formatISODate(c.lastDate, 'MMM d, yyyy'), sortValue: (c) => c.lastDate, className: 'text-muted-foreground' },
              ]}
              rows={report.topCustomers}
              getRowId={(c) => c.id}
              paginate={false}
              caption="Top customers"
              mobileCard={(c) => (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm tabular">
                    {c.appointments} appts
                    <span className="block text-xs text-muted-foreground">{money(c.completedCents)}</span>
                  </p>
                </div>
              )}
            />
          </Panel>
        </>
      )}
    </div>
  )
}
