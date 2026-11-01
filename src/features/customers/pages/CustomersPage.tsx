import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, TableSkeleton } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader, Panel } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Avatar } from '@/components/shared/StaffBadge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { customersRepository } from '@/database/repositories/customersRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatPhone } from '@/lib/contact'
import { formatISODate, formatTimestamp } from '@/lib/format'
import { nowInTimeZone, startOfMonth } from '@/lib/time'
import { matchesCustomer } from '@/services/customers/customerService'
import type { Customer } from '@/types/models'
import { CustomerFormDialog } from '../components/CustomerFormDialog'

type Filter = 'all' | 'upcoming' | 'new' | 'none'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Has upcoming' },
  { value: 'new', label: 'New this month' },
  { value: 'none', label: 'No appointments' },
]

interface Row extends Customer {
  total: number
  upcoming: number
}

export default function CustomersPage() {
  const ctx = useBusinessContext()
  const navigate = useNavigate()
  const customers = useLiveQuery(() => customersRepository.list(), [])
  const appointments = useLiveQuery(() => appointmentsRepository.listAll(), [])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [formOpen, setFormOpen] = useState(false)

  const today = ctx?.now.date
  const timezone = ctx?.settings.timezone ?? 'UTC'

  // Aggregate counts from a single read of all appointments.
  const rows = useMemo<Row[] | undefined>(() => {
    if (!customers || !appointments) return undefined
    const stats = new Map<string, { total: number; upcoming: number }>()
    for (const a of appointments) {
      const s = stats.get(a.customerId) ?? { total: 0, upcoming: 0 }
      s.total++
      if (today && a.date >= today && (a.status === 'pending' || a.status === 'confirmed')) s.upcoming++
      stats.set(a.customerId, s)
    }
    return customers.map((c) => ({ ...c, total: stats.get(c.id)?.total ?? 0, upcoming: stats.get(c.id)?.upcoming ?? 0 }))
  }, [customers, appointments, today])

  const filtered = useMemo(() => {
    if (!rows) return []
    const monthStart = today ? startOfMonth(today) : '0000-00-00'
    return rows.filter((c) => {
      if (filter === 'upcoming' && c.upcoming === 0) return false
      if (filter === 'none' && c.total > 0) return false
      if (filter === 'new' && nowInTimeZone(timezone, new Date(c.createdAt)).date < monthStart) return false
      return matchesCustomer(c, search)
    })
  }, [rows, filter, search, today, timezone])

  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: 'Customer',
      sortValue: (c) => c.fullName.toLowerCase(),
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={c.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{c.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{c.email}</p>
          </div>
        </div>
      ),
    },
    { id: 'phone', header: 'Phone', headerClassName: 'hidden lg:table-cell', className: 'hidden lg:table-cell', cell: (c) => <span className="tabular text-muted-foreground">{formatPhone(c.phone)}</span> },
    {
      id: 'last',
      header: 'Last appointment',
      sortValue: (c) => c.lastAppointmentDate ?? '',
      cell: (c) => (c.lastAppointmentDate ? formatISODate(c.lastAppointmentDate, 'MMM d, yyyy') : <span className="text-muted-foreground">—</span>),
    },
    {
      id: 'total',
      header: 'Appointments',
      sortValue: (c) => c.total,
      headerClassName: 'text-right',
      className: 'text-right tabular',
      cell: (c) => (
        <span>
          {c.total}
          {c.upcoming > 0 && <span className="ml-1.5 text-xs text-confirmed-fg">({c.upcoming} upcoming)</span>}
        </span>
      ),
    },
    {
      id: 'registered',
      header: 'Registered',
      sortValue: (c) => c.createdAt,
      cell: (c) => <span className="text-muted-foreground">{formatTimestamp(c.createdAt, 'MMM d, yyyy')}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who has booked or been added by your team."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> Add customer
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, email or phone…" label="Search customers" className="lg:w-72" />
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(v) => v && setFilter(v as Filter)}
            aria-label="Filter customers"
            className="flex-wrap justify-start"
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem key={f.value} value={f.value} className="px-2.5 text-xs">
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground lg:ml-auto" aria-live="polite">
            {rows ? `${filtered.length} of ${rows.length}` : ''}
          </p>
        </div>

        {rows === undefined ? (
          <TableSkeleton />
        ) : (
          <DataTable
            caption="Customers"
            columns={columns}
            rows={filtered}
            getRowId={(c) => c.id}
            onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
            initialSort={{ id: 'name', dir: 'asc' }}
            resetKey={`${search}|${filter}`}
            mobileCard={(c) => (
              <div className="flex items-center gap-3">
                <Avatar name={c.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.email} · {formatPhone(c.phone)}
                  </p>
                </div>
                <span className="shrink-0 text-right text-xs text-muted-foreground tabular">
                  {c.total} appt{c.total === 1 ? '' : 's'}
                  {c.upcoming > 0 && <span className="block text-confirmed-fg">{c.upcoming} upcoming</span>}
                </span>
              </div>
            )}
            empty={
              rows.length === 0 ? (
                <EmptyState
                  icon={UserRound}
                  title="No customers yet"
                  description="Customers appear here when they book online, or you can add them yourself."
                  action={
                    <Button size="sm" onClick={() => setFormOpen(true)}>
                      <Plus /> Add customer
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={UserRound}
                  title="No customers match"
                  description="Try another search or filter."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setFilter('all')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              )
            }
          />
        )}
      </Panel>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={null} onSaved={(c) => navigate(`/admin/customers/${c.id}`)} />
    </>
  )
}
