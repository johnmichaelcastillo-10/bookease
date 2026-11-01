import { format } from 'date-fns'
import { Info, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { LoadingState } from '@/components/feedback/states'
import { PageHeader, Panel } from '@/components/shared/PageHeader'
import { Avatar } from '@/components/shared/StaffBadge'
import { Button } from '@/components/ui/button'
import { useBusinessContext } from '@/hooks/useBusiness'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { eachDate, isoDateToLocalDate, isValidISODate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { resolveBusinessDay, resolveStaffDay } from '@/services/availability/engine'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { Appointment, ID, ISODate, Staff } from '@/types/models'
import { gridBounds, isCalendarView, periodTitle, shiftDate, visibleRange, weekDates, type CalendarView } from '../calendarUtils'
import { AgendaView } from '../components/AgendaView'
import { CalendarToolbar, type CalendarFilters } from '../components/CalendarToolbar'
import { MonthView } from '../components/MonthView'
import { TimeGrid, type GridColumn } from '../components/TimeGrid'
import { useCalendarData, type CalendarData } from '../useCalendarData'

export default function CalendarPage() {
  const business = useBusinessContext()
  if (!business) return <LoadingState />
  return <Calendar today={business.now.date} now={business.now} currency={business.settings.currency} />
}

function Calendar({ today, now, currency }: { today: ISODate; now: { date: ISODate; minutes: number }; currency: string }) {
  const [params, setParams] = useSearchParams()
  const isMobile = useIsMobile()
  const rawView = params.get('view')
  const rawDate = params.get('date')
  const view: CalendarView = isCalendarView(rawView) ? rawView : isMobile ? 'day' : 'week'
  const date: ISODate = rawDate && isValidISODate(rawDate) ? rawDate : today
  const [filters, setFilters] = useState<CalendarFilters>({ staffId: 'all', serviceId: 'all', showCancelled: false })

  const openDetails = useAppointmentUi((s) => s.openDetails)
  const openCreate = useAppointmentUi((s) => s.openCreate)

  const navigate = (next: { view?: CalendarView; date?: ISODate }) => {
    const p = new URLSearchParams(params)
    p.set('view', next.view ?? view)
    p.set('date', next.date ?? date)
    setParams(p, { replace: true })
  }

  const range = visibleRange(view, date)
  const data = useCalendarData(range)

  const visible = useMemo(() => {
    if (!data) return []
    return data.appointments.filter(
      (a) =>
        (filters.showCancelled || a.status !== 'cancelled') &&
        (filters.staffId === 'all' || a.staffId === filters.staffId) &&
        (filters.serviceId === 'all' || a.serviceId === filters.serviceId),
    )
  }, [data, filters])

  const handleCreate = (d: ISODate, startTime: string, staffId?: ID) =>
    openCreate({
      date: d,
      startTime,
      staffId: staffId ?? (filters.staffId !== 'all' ? filters.staffId : undefined),
      serviceId: filters.serviceId !== 'all' ? filters.serviceId : undefined,
    })

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Schedule by day, week or month. Click an open time to book it."
        actions={
          <Button size="sm" onClick={() => openCreate({ date: date >= today ? date : today, staffId: filters.staffId !== 'all' ? filters.staffId : undefined })}>
            <Plus /> New appointment
          </Button>
        }
      />
      <Panel className="overflow-hidden">
        <CalendarToolbar
          view={view}
          title={periodTitle(view, date)}
          onViewChange={(v) => navigate({ view: v })}
          onPrev={() => navigate({ date: shiftDate(view, date, -1) })}
          onNext={() => navigate({ date: shiftDate(view, date, 1) })}
          onToday={() => navigate({ date: today })}
          filters={filters}
          onFiltersChange={setFilters}
          staff={data?.staff ?? []}
          services={data?.services ?? []}
        />
        {!data ? (
          <LoadingState label="Loading appointments…" />
        ) : view === 'month' ? (
          <MonthView
            range={range}
            month={date}
            today={today}
            appointments={visible}
            closedDates={closedDates(data, range.from, range.to)}
            onSelectAppointment={openDetails}
            onOpenDay={(d) => navigate({ view: 'day', date: d })}
          />
        ) : view === 'agenda' ? (
          <AgendaView appointments={visible} today={today} staffById={new Map(data.staff.map((s) => [s.id, s]))} currency={currency} onSelectAppointment={openDetails} />
        ) : (
          <TimeGrid
            columns={view === 'day' ? dayColumns(data, date, today, visible, filters) : weekColumns(data, date, today, visible, filters)}
            bounds={gridBounds(data.businessHours, visible)}
            now={now}
            staffById={new Map(data.staff.map((s) => [s.id, s]))}
            showStaffDot={view === 'week'}
            minColumnWidth={view === 'day' ? 150 : 112}
            onSelectAppointment={openDetails}
            onCreate={handleCreate}
          />
        )}
      </Panel>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden />
        To move an appointment, open it and choose Reschedule. New times are checked against hours, breaks and other bookings before saving.
      </p>
    </div>
  )
}

function closedDates(data: CalendarData, from: ISODate, to: ISODate): Map<ISODate, string | undefined> {
  const closed = new Map<ISODate, string | undefined>()
  for (const d of eachDate(from, to)) {
    const day = resolveBusinessDay(d, data.businessHours, data.blocks)
    if (day.open.length === 0) closed.set(d, day.reason === 'holiday' ? day.label : day.label ?? 'Closed')
  }
  return closed
}

function weekColumns(data: CalendarData, date: ISODate, today: ISODate, appts: Appointment[], filters: CalendarFilters): GridColumn[] {
  const staffFilter = filters.staffId !== 'all' ? data.staff.find((s) => s.id === filters.staffId) : undefined
  return weekDates(date).map((d) => {
    const businessDay = resolveBusinessDay(d, data.businessHours, data.blocks)
    const open = staffFilter ? resolveStaffDay(d, staffFilter.id, data.schedules.get(staffFilter.id), businessDay, data.blocks) : businessDay.open
    const local = isoDateToLocalDate(d)
    return {
      key: d,
      date: d,
      isToday: d === today,
      open,
      closedLabel: businessDay.open.length === 0 ? (businessDay.label ?? 'Closed') : open.length === 0 ? 'Not working' : undefined,
      appointments: appts.filter((a) => a.date === d),
      label: (
        <span className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{format(local, 'EEE')}</span>
          <span className={cn('text-sm font-semibold tabular', d === today && 'text-primary')}>{format(local, 'd')}</span>
        </span>
      ),
    }
  })
}

function dayColumns(data: CalendarData, date: ISODate, today: ISODate, appts: Appointment[], filters: CalendarFilters): GridColumn[] {
  const businessDay = resolveBusinessDay(date, data.businessHours, data.blocks)
  const todays = appts.filter((a) => a.date === date)
  // Active staff, plus anyone (e.g. deactivated) who still has appointments that day.
  let staff: Staff[] = data.staff.filter((s) => s.isActive || todays.some((a) => a.staffId === s.id))
  if (filters.staffId !== 'all') staff = staff.filter((s) => s.id === filters.staffId)
  const closedLabel = businessDay.open.length === 0 ? (businessDay.label ?? 'Closed') : undefined

  if (staff.length === 0) {
    return [{ key: date, date, isToday: date === today, open: businessDay.open, closedLabel, appointments: todays, label: <span className="text-sm font-semibold">All staff</span> }]
  }
  return staff.map((s) => {
    const open = resolveStaffDay(date, s.id, data.schedules.get(s.id), businessDay, data.blocks)
    const mine = todays.filter((a) => a.staffId === s.id)
    return {
      key: s.id,
      date,
      staffId: s.isActive ? s.id : undefined,
      isToday: date === today,
      open: s.isActive ? open : [],
      closedLabel: closedLabel ?? (open.length === 0 ? 'Not working' : !s.isActive ? 'Inactive' : undefined),
      appointments: mine,
      label: (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={s.fullName} color={s.color} size="sm" />
          <span className="truncate text-sm font-semibold">{s.fullName}</span>
        </span>
      ),
      sublabel: `${mine.filter((a) => a.status !== 'cancelled').length} booked`,
    }
  })
}
