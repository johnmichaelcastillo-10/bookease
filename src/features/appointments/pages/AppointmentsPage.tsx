import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, CalendarRange, Download, FileJson, FileSpreadsheet, FilterX, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { DatePicker } from '@/components/shared/DatePicker'
import { PageHeader, Panel } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { toCsv } from '@/lib/csv'
import { downloadFile, downloadJson } from '@/lib/download'
import { formatISODate, formatMoney, formatTimeRange, pluralize } from '@/lib/format'
import { STATUS_LABELS } from '@/services/appointments/status'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { Appointment, AppointmentStatus } from '@/types/models'
import { APPOINTMENT_STATUSES } from '@/types/models'
import {
  applyFilters,
  DEFAULT_FILTERS,
  defaultOrder,
  exportColumns,
  filtersFromParams,
  filtersToParams,
  isFiltered,
  rangeBounds,
  RANGE_LABELS,
  type AppointmentFilters,
  type RangePreset,
} from '../lib/appointmentFilters'

export default function AppointmentsPage() {
  const ctx = useBusinessContext()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromParams(params), [params])
  const { openCreate, openDetails } = useAppointmentUi()

  const today = ctx?.now.date
  const bounds = today ? rangeBounds(filters, today) : null
  // Loads only the date range in view through the `date` index.
  const loaded = useLiveQuery(
    async () => {
      if (!today) return undefined
      return bounds ? appointmentsRepository.listRange(bounds.from, bounds.to) : appointmentsRepository.listAll()
    },
    [today, bounds?.from, bounds?.to],
  )
  const total = useLiveQuery(() => appointmentsRepository.count(), [])
  const services = useLiveQuery(() => servicesRepository.list(), []) ?? []
  const staff = useLiveQuery(() => staffRepository.list(), []) ?? []

  const rows = useMemo(() => (loaded ? defaultOrder(applyFilters(loaded, filters), filters.range) : []), [loaded, filters])

  const update = (patch: Partial<AppointmentFilters>) => setParams(filtersToParams({ ...filters, ...patch }), { replace: true })
  const currency = ctx?.settings.currency ?? 'USD'

  function exportRows(kind: 'csv' | 'json') {
    if (rows.length === 0) {
      toast.info('There are no appointments in the current view to export.')
      return
    }
    const stamp = today ?? 'export'
    if (kind === 'csv') downloadFile(`bookease-appointments-${stamp}.csv`, toCsv(rows, exportColumns(currency)), 'text/csv;charset=utf-8')
    else downloadJson(`bookease-appointments-${stamp}.json`, { exportedAt: new Date().toISOString(), count: rows.length, appointments: rows })
    toast.success(`Exported ${pluralize(rows.length, 'appointment')}.`)
  }

  const columns: Column<Appointment>[] = [
    {
      id: 'when',
      header: 'Date & time',
      sortValue: (a) => a.date + a.startTime,
      cell: (a) => (
        <div className="whitespace-nowrap">
          <div className="font-medium">{formatISODate(a.date, 'EEE, MMM d')}</div>
          <div className="text-xs text-muted-foreground tabular">{formatTimeRange(a.startTime, a.endTime)}</div>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      sortValue: (a) => a.customerName.toLowerCase(),
      cell: (a) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{a.customerName}</div>
          <div className="font-mono text-xs text-muted-foreground">{a.reference}</div>
        </div>
      ),
    },
    { id: 'service', header: 'Service', sortValue: (a) => a.serviceName.toLowerCase(), cell: (a) => a.serviceName },
    { id: 'staff', header: 'Staff', sortValue: (a) => a.staffName.toLowerCase(), cell: (a) => a.staffName, className: 'whitespace-nowrap' },
    { id: 'status', header: 'Status', sortValue: (a) => a.status, cell: (a) => <StatusBadge status={a.status} /> },
    {
      id: 'price',
      header: 'Price',
      sortValue: (a) => a.priceCents,
      cell: (a) => formatMoney(a.priceCents, currency),
      className: 'text-right tabular whitespace-nowrap',
      headerClassName: 'text-right',
    },
  ]

  const loading = loaded === undefined || total === undefined
  const resetKey = params.toString()

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Search, filter and manage every booking in this browser."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export {pluralize(rows.length, 'row')} in view</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => exportRows('csv')}>
                  <FileSpreadsheet /> CSV (spreadsheet)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportRows('json')}>
                  <FileJson /> JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => openCreate()}>
              <CalendarPlus /> New appointment
            </Button>
          </>
        }
      />

      <Panel>
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput
            value={filters.q}
            onChange={(q) => update({ q })}
            placeholder="Search reference, customer, phone…"
            label="Search appointments"
            className="lg:w-72"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select value={filters.range} onValueChange={(v) => update({ range: v as RangePreset })}>
              <SelectTrigger size="sm" aria-label="Date range" className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABELS) as RangePreset[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => update({ status: v as AppointmentStatus | 'all' })}>
              <SelectTrigger size="sm" aria-label="Status" className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {APPOINTMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.serviceId} onValueChange={(v) => update({ serviceId: v })}>
              <SelectTrigger size="sm" aria-label="Service" className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.staffId} onValueChange={(v) => update({ staffId: v })}>
              <SelectTrigger size="sm" aria-label="Staff member" className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filters.range === 'custom' && (
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <DatePicker
                value={filters.from}
                onChange={(from) => update({ from, to: filters.to && filters.to < from ? from : filters.to })}
                placeholder="From"
                aria-label="From date"
                className="h-7 sm:w-44"
              />
              <DatePicker
                value={filters.to}
                onChange={(to) => update({ to })}
                fromDate={filters.from ?? undefined}
                placeholder="To"
                aria-label="To date"
                className="h-7 sm:w-44"
              />
            </div>
          )}
          {isFiltered(filters) && (
            <Button variant="ghost" size="sm" onClick={() => setParams(filtersToParams(DEFAULT_FILTERS), { replace: true })} className="self-start lg:ml-auto">
              <FilterX /> Clear filters
            </Button>
          )}
        </div>

        {loading ? (
          <TableSkeleton />
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {pluralize(rows.length, 'appointment')} shown
            </p>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(a) => a.id}
              onRowClick={(a) => openDetails(a.id)}
              caption="Appointments"
              resetKey={resetKey}
              rowClassName={(a) => (a.status === 'cancelled' ? 'text-muted-foreground' : undefined)}
              mobileCard={(a) => (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.customerName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {a.serviceName} · {a.staffName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular">
                      {formatISODate(a.date, 'EEE, MMM d')} · {formatTimeRange(a.startTime, a.endTime)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={a.status} />
                    <span className="text-xs tabular text-muted-foreground">{formatMoney(a.priceCents, currency)}</span>
                  </div>
                </div>
              )}
              empty={
                total === 0 ? (
                  <EmptyState
                    icon={CalendarRange}
                    title="No appointments yet"
                    description="Create one here, or share the booking page with customers. Bookings made there appear in this list."
                    action={
                      <Button onClick={() => openCreate()}>
                        <CalendarPlus /> New appointment
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={SearchX}
                    title="No appointments match"
                    description={`Nothing in “${RANGE_LABELS[filters.range]}” matches the current search and filters.`}
                    action={
                      <Button variant="outline" onClick={() => setParams(filtersToParams({ ...DEFAULT_FILTERS, range: 'all' }), { replace: true })}>
                        <FilterX /> Show all appointments
                      </Button>
                    }
                  />
                )
              }
            />
          </>
        )}
      </Panel>
    </>
  )
}
