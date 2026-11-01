import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, TableSkeleton } from '@/components/feedback/states'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader, Panel } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Avatar } from '@/components/shared/StaffBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import type { Staff } from '@/types/models'
import { ActiveBadge } from '../components/ActiveBadge'
import { StaffFormDialog } from '../components/StaffFormDialog'

type StatusFilter = 'all' | 'active' | 'inactive'

export default function StaffPage() {
  const navigate = useNavigate()
  const ctx = useBusinessContext()
  const today = ctx?.now.date
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [adding, setAdding] = useState(false)

  const staff = useLiveQuery(() => staffRepository.list(), [])
  const upcoming = useLiveQuery(async () => {
    if (!today) return new Map<string, number>()
    const rows = await appointmentsRepository.listRange(today, '9999-12-31')
    const counts = new Map<string, number>()
    for (const a of rows) if (a.status === 'pending' || a.status === 'confirmed') counts.set(a.staffId, (counts.get(a.staffId) ?? 0) + 1)
    return counts
  }, [today])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (staff ?? []).filter(
      (s) =>
        (status === 'all' || (status === 'active') === s.isActive) &&
        (!q || s.fullName.toLowerCase().includes(q) || s.position.toLowerCase().includes(q) || s.email.includes(q)),
    )
  }, [staff, query, status])

  const columns: Column<Staff>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (s) => s.fullName,
      cell: (s) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={s.fullName} color={s.color} />
          <div className="min-w-0">
            <p className="truncate font-medium">{s.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{s.email || 'No email'}</p>
          </div>
        </div>
      ),
    },
    { id: 'position', header: 'Position', sortValue: (s) => s.position, cell: (s) => s.position || <span className="text-muted-foreground">—</span> },
    { id: 'services', header: 'Services', sortValue: (s) => s.serviceIds.length, cell: (s) => <span className="tabular">{s.serviceIds.length}</span> },
    {
      id: 'upcoming',
      header: 'Upcoming',
      sortValue: (s) => upcoming?.get(s.id) ?? 0,
      cell: (s) => <span className="tabular">{upcoming?.get(s.id) ?? 0}</span>,
    },
    { id: 'status', header: 'Status', sortValue: (s) => (s.isActive ? 0 : 1), cell: (s) => <ActiveBadge active={s.isActive} /> },
  ]

  return (
    <>
      <PageHeader
        title="Staff"
        description="The people customers book with, their services and working hours."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add staff
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, position or email" label="Search staff" className="sm:w-72" />
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="h-8 sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!staff ? (
          <TableSkeleton />
        ) : (
          <DataTable
            caption="Staff members"
            columns={columns}
            rows={filtered}
            getRowId={(s) => s.id}
            onRowClick={(s) => navigate(`/admin/staff/${s.id}`)}
            initialSort={{ id: 'name', dir: 'asc' }}
            resetKey={`${query}|${status}`}
            mobileCard={(s) => (
              <div className="flex items-center gap-3">
                <Avatar name={s.fullName} color={s.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.position || 'No position'} · {upcoming?.get(s.id) ?? 0} upcoming
                  </p>
                </div>
                <ActiveBadge active={s.isActive} />
              </div>
            )}
            empty={
              staff.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No staff yet"
                  description="Add the people who deliver your services. Each can follow business hours or have their own schedule."
                  action={
                    <Button size="sm" onClick={() => setAdding(true)}>
                      <Plus /> Add staff
                    </Button>
                  }
                />
              ) : (
                <EmptyState icon={Users} title="No matching staff" description="Try a different search or status filter." />
              )
            }
          />
        )}
      </Panel>

      <StaffFormDialog open={adding} onOpenChange={setAdding} />
    </>
  )
}
