import { useLiveQuery } from 'dexie-react-hooks'
import { Briefcase, Plus, Tags } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, TableSkeleton } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader, Panel } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { categoriesRepository, servicesRepository } from '@/database/repositories/catalogRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { useBusinessSettings } from '@/hooks/useBusiness'
import { formatDuration, formatMoney } from '@/lib/format'
import { getEligibleStaff } from '@/services/availability/engine'
import type { Service } from '@/types/models'
import { ActiveBadge } from '@/components/shared/ActiveBadge'
import { CategoriesDialog } from '../components/CategoriesDialog'
import { ServiceDetailsSheet } from '../components/ServiceDetailsSheet'
import { ServiceFormDialog } from '../components/ServiceFormDialog'

type StatusFilter = 'all' | 'active' | 'inactive'

const NONE: never[] = []

export default function ServicesPage() {
  const settings = useBusinessSettings()
  const currency = settings?.currency ?? 'USD'
  const services = useLiveQuery(() => servicesRepository.list(), [])
  const categories = useLiveQuery(() => categoriesRepository.list(), []) ?? NONE
  const staff = useLiveQuery(() => staffRepository.list(), []) ?? NONE
  // One read of all appointments, counted per service (avoids a query per row).
  const bookingCounts = useLiveQuery(async () => {
    const counts = new Map<string, number>()
    for (const a of await appointmentsRepository.listAll()) counts.set(a.serviceId, (counts.get(a.serviceId) ?? 0) + 1)
    return counts
  }, [])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [formState, setFormState] = useState<{ open: boolean; service: Service | null }>({ open: false, service: null })
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const servicesPerCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of services ?? []) counts.set(s.categoryId, (counts.get(s.categoryId) ?? 0) + 1)
    return counts
  }, [services])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (services ?? []).filter((s) => {
      if (statusFilter === 'active' && !s.isActive) return false
      if (statusFilter === 'inactive' && s.isActive) return false
      if (categoryFilter !== 'all' && s.categoryId !== categoryFilter) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || (categoryName.get(s.categoryId) ?? '').toLowerCase().includes(q)
    })
  }, [services, search, categoryFilter, statusFilter, categoryName])

  const staffModeLabel = (s: Service) => {
    const count = getEligibleStaff(s, staff).length
    return `${s.staffMode === 'any' ? 'Any staff' : 'Assigned staff'} · ${count}`
  }

  const columns: Column<Service>[] = [
    {
      id: 'name',
      header: 'Service',
      sortValue: (s) => s.name.toLowerCase(),
      cell: (s) => (
        <div className="min-w-0">
          <p className="font-medium">{s.name}</p>
          <p className="max-w-48 truncate text-xs text-muted-foreground 2xl:max-w-xs">{s.description || '—'}</p>
        </div>
      ),
    },
    { id: 'category', header: 'Category', sortValue: (s) => categoryName.get(s.categoryId) ?? '', cell: (s) => categoryName.get(s.categoryId) ?? 'Uncategorised' },
    { id: 'duration', header: 'Duration', sortValue: (s) => s.durationMinutes, cell: (s) => <span className="tabular">{formatDuration(s.durationMinutes)}</span> },
    {
      id: 'buffer',
      header: 'Buffer',
      sortValue: (s) => s.bufferMinutes,
      headerClassName: 'hidden 2xl:table-cell',
      className: 'hidden 2xl:table-cell',
      cell: (s) => <span className="text-muted-foreground tabular">{s.bufferMinutes ? `${s.bufferMinutes} min` : '—'}</span>,
    },
    {
      id: 'price',
      header: 'Price',
      sortValue: (s) => s.priceCents,
      headerClassName: 'text-right',
      className: 'text-right font-mono text-[13px] tabular',
      cell: (s) => formatMoney(s.priceCents, currency),
    },
    { id: 'staff', header: 'Staff', cell: (s) => <span className="text-muted-foreground">{staffModeLabel(s)}</span> },
    {
      id: 'bookings',
      header: 'Bookings',
      sortValue: (s) => bookingCounts?.get(s.id) ?? 0,
      headerClassName: 'hidden text-right xl:table-cell',
      className: 'hidden text-right tabular xl:table-cell',
      cell: (s) => bookingCounts?.get(s.id) ?? 0,
    },
    { id: 'status', header: 'Status', sortValue: (s) => (s.isActive ? 0 : 1), cell: (s) => <ActiveBadge active={s.isActive} /> },
  ]

  const details = services?.find((s) => s.id === detailsId) ?? null
  const filtersActive = search !== '' || categoryFilter !== 'all' || statusFilter !== 'all'

  return (
    <>
      <PageHeader
        title="Services"
        description="What customers can book, how long it takes and what it costs."
        actions={
          <>
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
              <Tags /> Manage categories
            </Button>
            <Button onClick={() => setFormState({ open: true, service: null })}>
              <Plus /> New service
            </Button>
          </>
        }
      />

      <Panel>
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search services…" label="Search services" className="sm:w-72" />
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
            {services ? `${filtered.length} of ${services.length}` : ''}
          </p>
        </div>

        {services === undefined ? (
          <TableSkeleton />
        ) : (
          <DataTable
            caption="Services"
            columns={columns}
            rows={filtered}
            getRowId={(s) => s.id}
            onRowClick={(s) => setDetailsId(s.id)}
            initialSort={{ id: 'name', dir: 'asc' }}
            resetKey={`${search}|${categoryFilter}|${statusFilter}`}
            rowClassName={(s) => (s.isActive ? undefined : 'text-muted-foreground')}
            mobileCard={(s) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryName.get(s.categoryId) ?? 'Uncategorised'} · {formatDuration(s.durationMinutes)} · {staffModeLabel(s)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm tabular">{formatMoney(s.priceCents, currency)}</span>
                  <ActiveBadge active={s.isActive} />
                </div>
              </div>
            )}
            empty={
              filtersActive ? (
                <EmptyState
                  icon={Briefcase}
                  title="No services match"
                  description="Try a different search or clear the filters."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setCategoryFilter('all')
                        setStatusFilter('all')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Briefcase}
                  title="No services yet"
                  description={
                    categories.length === 0
                      ? 'Create a category first, then add the services customers can book.'
                      : 'Add the services customers can book, with their duration and price.'
                  }
                  action={
                    categories.length === 0 ? (
                      <Button size="sm" onClick={() => setCategoriesOpen(true)}>
                        <Tags /> Create a category
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setFormState({ open: true, service: null })}>
                        <Plus /> New service
                      </Button>
                    )
                  }
                />
              )
            }
          />
        )}
      </Panel>

      <ServiceFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
        service={formState.service}
        categories={categories}
        currency={currency}
      />
      <ServiceDetailsSheet
        service={details}
        onOpenChange={(open) => !open && setDetailsId(null)}
        categories={categories}
        staff={staff}
        currency={currency}
        onEdit={(s) => setFormState({ open: true, service: s })}
      />
      <CategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} categories={categories} serviceCounts={servicesPerCategory} />
    </>
  )
}
