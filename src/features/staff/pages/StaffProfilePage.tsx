import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, CalendarPlus, CalendarRange, Mail, Pencil, Phone, Power, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState, LoadingState } from '@/components/feedback/states'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Avatar } from '@/components/shared/StaffBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { SpecialDatesList } from '@/features/availability/components/SpecialDatesList'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatPhone } from '@/lib/contact'
import { formatDuration, formatISODate, formatMoney, formatTime, formatTimestamp, pluralize } from '@/lib/format'
import { compareWallClock, toMinutes } from '@/lib/time'
import { errorMessage } from '@/services/errors'
import { getUpcomingAppointmentsForStaff, setStaffActive } from '@/services/staff/staffService'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { Appointment, Staff } from '@/types/models'
import { ActiveBadge } from '../components/ActiveBadge'
import { StaffFormDialog } from '../components/StaffFormDialog'
import { StaffScheduleCard } from '../components/StaffScheduleCard'

export default function StaffProfilePage() {
  const { staffId = '' } = useParams()
  const staff = useLiveQuery(() => staffRepository.get(staffId).then((s) => s ?? null), [staffId])

  if (staff === undefined) return <LoadingState />
  if (staff === null) {
    return (
      <EmptyState
        icon={UserX}
        title="Staff member not found"
        description="This staff member doesn’t exist in this browser’s data. It may have been removed with the sample data."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/staff">Back to staff</Link>
          </Button>
        }
      />
    )
  }
  return <StaffProfile staff={staff} />
}

function StaffProfile({ staff }: { staff: Staff }) {
  const ctx = useBusinessContext()
  const openCreate = useAppointmentUi((s) => s.openCreate)
  const [editing, setEditing] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [upcomingKept, setUpcomingKept] = useState<number | null>(null)

  async function askToggle() {
    if (staff.isActive) {
      const upcoming = await getUpcomingAppointmentsForStaff(staff.id)
      setUpcomingKept(upcoming.length)
    }
    setConfirmToggle(true)
  }

  return (
    <>
      <Link to="/admin/staff" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Staff
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={staff.fullName} color={staff.color} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">{staff.fullName}</h1>
              <ActiveBadge active={staff.isActive} />
            </div>
            <p className="text-sm text-muted-foreground">{staff.position || 'No position set'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCreate({ staffId: staff.id })} disabled={!staff.isActive}>
            <CalendarPlus /> New appointment
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <Button variant="outline" onClick={askToggle}>
            <Power /> {staff.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <DetailsPanel staff={staff} />
          <ServicesPanel staff={staff} />
        </div>
        <div className="min-w-0 space-y-6">
          <StaffScheduleCard staff={staff} />
          {ctx ? (
            <SpecialDatesList
              today={ctx.now.date}
              staffId={staff.id}
              title="Leave and unavailable time"
              description="Days or hours this staff member can’t be booked."
            />
          ) : (
            <LoadingState />
          )}
          <AppointmentsPanel staff={staff} />
        </div>
      </div>

      <StaffFormDialog open={editing} onOpenChange={setEditing} staff={staff} />
      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={staff.isActive ? `Deactivate ${staff.fullName}?` : `Activate ${staff.fullName}?`}
        description={
          staff.isActive
            ? `${staff.fullName} won’t be offered for new bookings. Past appointments stay in the history${
                upcomingKept ? `, and ${pluralize(upcomingKept, 'upcoming appointment')} stay assigned. Reschedule or reassign them if needed` : ''
              }.`
            : `${staff.fullName} will be available for new bookings again, within their working hours.`
        }
        confirmLabel={staff.isActive ? 'Deactivate' : 'Activate'}
        destructive={staff.isActive}
        onConfirm={async () => {
          try {
            await setStaffActive(staff.id, !staff.isActive)
            toast.success(staff.isActive ? `${staff.fullName} was deactivated.` : `${staff.fullName} is active again.`)
          } catch (error) {
            toast.error(errorMessage(error))
            throw error
          }
        }}
      />
    </>
  )
}

function DetailsPanel({ staff }: { staff: Staff }) {
  return (
    <Panel>
      <PanelHeader title="Details" />
      <dl className="space-y-3 px-4 py-4 text-sm">
        <div className="flex items-start gap-2.5">
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <dt className="sr-only">Email</dt>
            <dd className="truncate">{staff.email ? <a href={`mailto:${staff.email}`} className="hover:underline">{staff.email}</a> : <span className="text-muted-foreground">No email</span>}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <dt className="sr-only">Phone</dt>
            <dd className="tabular">{staff.phone ? formatPhone(staff.phone) : <span className="text-muted-foreground">No phone</span>}</dd>
          </div>
        </div>
        {staff.description && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">About</dt>
            <dd className="mt-0.5">{staff.description}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Added</dt>
          <dd className="mt-0.5">{formatTimestamp(staff.createdAt, 'MMM d, yyyy')}</dd>
        </div>
      </dl>
    </Panel>
  )
}

function ServicesPanel({ staff }: { staff: Staff }) {
  const services = useLiveQuery(() => servicesRepository.list(), [])
  const assigned = (services ?? []).filter((s) => staff.serviceIds.includes(s.id))
  const openToAll = (services ?? []).filter((s) => s.staffMode === 'any' && !staff.serviceIds.includes(s.id) && s.isActive)
  return (
    <Panel>
      <PanelHeader title="Services" description={`${pluralize(assigned.length, 'assigned service')}`} />
      {!services ? (
        <LoadingState />
      ) : (
        <div className="px-4 py-3">
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No services assigned.</p>
          ) : (
            <ul className="space-y-2">
              {assigned.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {s.name}
                    {!s.isActive && <span className="text-muted-foreground"> (inactive)</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">{formatDuration(s.durationMinutes)}</span>
                </li>
              ))}
            </ul>
          )}
          {openToAll.length > 0 && (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              Also bookable for {openToAll.map((s) => s.name).join(', ')}: {openToAll.length === 1 ? 'it is' : 'they are'} set to “any staff”, so every
              active staff member can take {openToAll.length === 1 ? 'it' : 'them'}.
            </p>
          )}
        </div>
      )}
    </Panel>
  )
}

function AppointmentsPanel({ staff }: { staff: Staff }) {
  const ctx = useBusinessContext()
  const openDetails = useAppointmentUi((s) => s.openDetails)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const appointments = useLiveQuery(() => appointmentsRepository.listByStaff(staff.id), [staff.id])
  const currency = ctx?.settings.currency ?? 'USD'

  const { upcoming, past } = useMemo(() => {
    const up: Appointment[] = []
    const old: Appointment[] = []
    if (appointments && ctx) {
      for (const a of appointments) {
        const future = compareWallClock({ date: a.date, minutes: toMinutes(a.startTime) }, ctx.now) >= 0
        ;(future ? up : old).push(a)
      }
    }
    const key = (a: Appointment) => a.date + a.startTime
    up.sort((a, b) => key(a).localeCompare(key(b)))
    old.sort((a, b) => key(b).localeCompare(key(a)))
    return { upcoming: up, past: old }
  }, [appointments, ctx])

  const rows = tab === 'upcoming' ? upcoming : past
  const columns: Column<Appointment>[] = [
    {
      id: 'when',
      header: 'Date',
      cell: (a) => (
        <div>
          <p className="font-medium">{formatISODate(a.date)}</p>
          <p className="text-xs text-muted-foreground tabular">{formatTime(a.startTime)}</p>
        </div>
      ),
    },
    { id: 'customer', header: 'Customer', cell: (a) => <span className="font-medium">{a.customerName}</span> },
    { id: 'service', header: 'Service', cell: (a) => a.serviceName },
    { id: 'price', header: 'Price', className: 'text-right tabular', headerClassName: 'text-right', cell: (a) => formatMoney(a.priceCents, currency) },
    { id: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
  ]

  return (
    <Panel>
      <PanelHeader title="Appointments" description="Booked with this staff member." />
      <div className="border-b px-4 py-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'upcoming' | 'past')}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {!appointments || !ctx ? (
        <LoadingState />
      ) : (
        <DataTable
          caption={`${tab === 'upcoming' ? 'Upcoming' : 'Past'} appointments for ${staff.fullName}`}
          columns={columns}
          rows={rows}
          getRowId={(a) => a.id}
          onRowClick={(a) => openDetails(a.id)}
          resetKey={tab}
          mobileCard={(a) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.customerName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatISODate(a.date, 'EEE, MMM d')} · {formatTime(a.startTime)} · {a.serviceName}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          )}
          empty={
            <EmptyState
              icon={CalendarRange}
              title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
              description={tab === 'upcoming' ? 'New bookings with this staff member will show up here.' : undefined}
            />
          }
        />
      )}
    </Panel>
  )
}
