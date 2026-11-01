import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, CalendarPlus, CalendarRange, History, Mail, MapPin, Pencil, Phone, StickyNote, Trash2, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState, LoadingState } from '@/components/feedback/states'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Avatar } from '@/components/shared/StaffBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { customersRepository } from '@/database/repositories/customersRepository'
import { activityRepository } from '@/database/repositories/eventsRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatPhone } from '@/lib/contact'
import { formatISODate, formatMoney, formatRelative, formatTime, formatTimestamp } from '@/lib/format'
import { deleteCustomer, summarizeCustomerAppointments } from '@/services/customers/customerService'
import { errorMessage } from '@/services/errors'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { ActivityLog, Appointment } from '@/types/models'
import { CustomerFormDialog } from '../components/CustomerFormDialog'

const ACTIVITY_LIMIT = 12

export default function CustomerProfilePage() {
  const { customerId = '' } = useParams()
  const navigate = useNavigate()
  const ctx = useBusinessContext()
  const openDetails = useAppointmentUi((s) => s.openDetails)
  const openCreate = useAppointmentUi((s) => s.openCreate)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // `null` = loaded but missing, `undefined` = still loading.
  const customer = useLiveQuery(async () => (await customersRepository.get(customerId)) ?? null, [customerId])
  const appointments = useLiveQuery(() => appointmentsRepository.listByCustomer(customerId), [customerId])

  const history = useMemo(
    () => (appointments && ctx ? summarizeCustomerAppointments(appointments, ctx.now.date) : undefined),
    [appointments, ctx],
  )

  // Activity about the customer record and their most recent appointments.
  const recentIds = history?.appointments.slice(0, 15).map((a) => a.id).join(',') ?? ''
  const activity = useLiveQuery(async () => {
    const ids = [customerId, ...recentIds.split(',').filter(Boolean)]
    const lists = await Promise.all(ids.map((id) => activityRepository.listForEntity(id, ACTIVITY_LIMIT)))
    return lists
      .flat()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, ACTIVITY_LIMIT)
  }, [customerId, recentIds])

  if (customer === undefined || !ctx) return <LoadingState />
  if (customer === null) {
    return (
      <EmptyState
        icon={UserX}
        title="Customer not found"
        description="This customer may have been deleted, or the link is wrong."
        action={
          <Button variant="outline" asChild>
            <Link to="/admin/customers">
              <ArrowLeft /> All customers
            </Link>
          </Button>
        }
      />
    )
  }

  const currency = ctx.settings.currency
  const canDelete = (appointments?.length ?? 0) === 0

  const columns: Column<Appointment>[] = [
    {
      id: 'when',
      header: 'Date',
      sortValue: (a) => a.date + a.startTime,
      cell: (a) => (
        <div>
          <p className="font-medium">{formatISODate(a.date, 'EEE, MMM d, yyyy')}</p>
          <p className="text-xs text-muted-foreground tabular">{formatTime(a.startTime)}</p>
        </div>
      ),
    },
    { id: 'service', header: 'Service', sortValue: (a) => a.serviceName, cell: (a) => a.serviceName },
    { id: 'staff', header: 'Staff', sortValue: (a) => a.staffName, headerClassName: 'hidden lg:table-cell', className: 'hidden lg:table-cell', cell: (a) => <span className="text-muted-foreground">{a.staffName}</span> },
    { id: 'ref', header: 'Reference', headerClassName: 'hidden xl:table-cell', className: 'hidden xl:table-cell', cell: (a) => <span className="font-mono text-xs">{a.reference}</span> },
    { id: 'status', header: 'Status', sortValue: (a) => a.status, cell: (a) => <StatusBadge status={a.status} /> },
    {
      id: 'price',
      header: 'Price',
      headerClassName: 'text-right',
      className: 'text-right font-mono text-[13px] tabular',
      sortValue: (a) => a.priceCents,
      cell: (a) => formatMoney(a.priceCents, currency),
    },
  ]

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to="/admin/customers">
            <ArrowLeft /> Customers
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={customer.fullName} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">{customer.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              Customer since {formatTimestamp(customer.createdAt, 'MMMM d, yyyy')}
              {customer.source === 'demo' && ' · sample data'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCreate({ customerId: customer.id })}>
            <CalendarPlus /> New appointment
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
          {canDelete ? (
            <Button variant="outline" onClick={() => setDeleteOpen(true)} aria-label="Delete customer">
              <Trash2 />
              <span className="sm:hidden">Delete</span>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Wrapper keeps the tooltip working on a disabled button. */}
                <span tabIndex={0} className="inline-flex rounded-lg" aria-label="Delete unavailable: this customer has appointments on record">
                  <Button variant="outline" disabled aria-hidden tabIndex={-1}>
                    <Trash2 />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Customers with appointments on record can’t be deleted.</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total bookings" value={history?.total ?? '…'} />
        <StatCard label="Upcoming" value={history?.upcoming ?? '…'} tone="confirmed" />
        <StatCard label="Completed" value={history?.completed ?? '…'} tone="completed" />
        <StatCard label="Cancelled" value={history?.cancelled ?? '…'} tone="cancelled" />
        <StatCard label="No-shows" value={history?.noShows ?? '…'} tone="noshow" />
        <StatCard label="Completed revenue" value={history ? formatMoney(history.completedRevenueCents, currency) : '…'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="min-w-0">
          <PanelHeader title="Appointment history" description="Select an appointment to see details and actions." />
          {history === undefined ? (
            <LoadingState />
          ) : (
            <DataTable
              caption={`Appointments for ${customer.fullName}`}
              columns={columns}
              rows={history.appointments}
              getRowId={(a) => a.id}
              onRowClick={(a) => openDetails(a.id)}
              initialSort={{ id: 'when', dir: 'desc' }}
              mobileCard={(a) => (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.serviceName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatISODate(a.date, 'MMM d, yyyy')} · {formatTime(a.startTime)} · {a.staffName}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              )}
              empty={
                <EmptyState
                  icon={CalendarRange}
                  title="No appointments yet"
                  description="Book this customer’s first appointment."
                  action={
                    <Button size="sm" onClick={() => openCreate({ customerId: customer.id })}>
                      <CalendarPlus /> New appointment
                    </Button>
                  }
                />
              }
            />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Contact details" />
            <dl className="space-y-3 p-4 text-sm">
              <ContactRow icon={Mail} label="Email">
                <a href={`mailto:${customer.email}`} className="break-all text-primary hover:underline">
                  {customer.email}
                </a>
              </ContactRow>
              <ContactRow icon={Phone} label="Phone">
                <a href={`tel:${customer.phone}`} className="tabular hover:underline">
                  {formatPhone(customer.phone)}
                </a>
              </ContactRow>
              <ContactRow icon={MapPin} label="Address">
                {customer.address || <span className="text-muted-foreground">Not provided</span>}
              </ContactRow>
              <ContactRow icon={StickyNote} label="Notes">
                {customer.notes ? <span className="whitespace-pre-line">{customer.notes}</span> : <span className="text-muted-foreground">None</span>}
              </ContactRow>
            </dl>
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              Appointments keep the name, email and phone they were booked with, even if you edit these details.
            </p>
          </Panel>

          <Panel>
            <PanelHeader title="Recent activity" />
            <ActivityList entries={activity} />
          </Panel>
        </div>
      </div>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${customer.fullName}?`}
        description="This customer has no appointments, so the record can be removed. This cannot be undone."
        confirmLabel="Delete customer"
        destructive
        onConfirm={async () => {
          try {
            await deleteCustomer(customer.id)
            toast.success(`Deleted ${customer.fullName}.`)
            navigate('/admin/customers')
          } catch (error) {
            toast.error(errorMessage(error))
            throw error
          }
        }}
      />
    </>
  )
}

function ContactRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  )
}

function ActivityList({ entries }: { entries: ActivityLog[] | undefined }) {
  if (entries === undefined) return <LoadingState className="py-8" />
  if (entries.length === 0) {
    return <EmptyState icon={History} title="No activity yet" className="py-8" />
  }
  return (
    <ol className="space-y-3 p-4">
      {entries.map((e) => (
        <li key={e.id} className="relative pl-4 text-sm">
          <span aria-hidden className="absolute top-1.5 left-0 size-1.5 rounded-full bg-muted-foreground/50" />
          <p className="leading-snug">{e.description}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <time dateTime={e.createdAt} title={formatTimestamp(e.createdAt)}>
              {formatRelative(e.createdAt)}
            </time>
            {e.actor === 'customer' && ' · by customer'}
          </p>
        </li>
      ))}
    </ol>
  )
}
