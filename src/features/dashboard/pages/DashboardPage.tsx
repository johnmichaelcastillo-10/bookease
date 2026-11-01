import { useLiveQuery } from 'dexie-react-hooks'
import { Ban, CalendarCheck2, CalendarDays, CheckCircle2, CircleDashed, CircleDollarSign, Plus, Sparkles, UsersRound } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { EmptyState, LoadingState } from '@/components/feedback/states'
import { PageHeader, Panel, PanelHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatISODate, formatMoney } from '@/lib/format'
import { addDays, type WallClock } from '@/lib/time'
import { STATUS_LABELS } from '@/services/appointments/status'
import { calculateAppointmentStatistics, calculateRevenue, generateServiceReport, volumeSeries } from '@/services/reports/reportService'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { BusinessSettings } from '@/types/models'
import { APPOINTMENT_STATUSES } from '@/types/models'
import { STATUS_VAR, useChartTheme } from '@/features/reports/components/chartTheme'
import { HorizontalBars, RevenueChart, VolumeChart } from '@/features/reports/components/charts'
import { RangeFilter } from '@/features/reports/components/RangeFilter'
import { describeRange, useRangeFilter } from '@/features/reports/lib/rangeState'
import { useReportData } from '@/features/reports/lib/reportData'
import { NeedsAttention, UpcomingAppointments } from '../components/AppointmentLists'
import { pastStillOpen, pendingSoon, upcomingAppointments } from '../lib/dashboardData'

export default function DashboardPage() {
  const ctx = useBusinessContext()
  if (!ctx) return <LoadingState />
  return <Dashboard settings={ctx.settings} now={ctx.now} />
}

function greeting(minutes: number) {
  if (minutes < 12 * 60) return 'Good morning'
  if (minutes < 18 * 60) return 'Good afternoon'
  return 'Good evening'
}

function Dashboard({ settings, now }: { settings: BusinessSettings; now: WallClock }) {
  const rangeState = useRangeFilter(now.date, 'month')
  const { range } = rangeState
  const data = useReportData(range)
  const activeServices = useLiveQuery(() => servicesRepository.listActive(), [])
  const openCreate = useAppointmentUi((s) => s.openCreate)
  const theme = useChartTheme()
  const money = (n: number) => formatMoney(n, settings.currency)

  const derived = useMemo(() => {
    if (!data) return null
    const stats = calculateAppointmentStatistics(data.inPeriod, now.date)
    return {
      stats,
      today: calculateAppointmentStatistics(data.all, now.date).today,
      revenue: calculateRevenue(data.inPeriod),
      series: volumeSeries(data.inPeriod, range),
      services: generateServiceReport(data.inPeriod).slice(0, 5),
      upcoming: upcomingAppointments(data.all, now),
      pendingSoon: pendingSoon(data.all, now),
      pastOpen: pastStillOpen(data.all, now),
    }
  }, [data, now, range])

  const header = (
    <PageHeader
      title={`${greeting(now.minutes)}`}
      description={
        <>
          {settings.name} · {formatISODate(now.date, 'EEEE, MMMM d, yyyy')}
        </>
      }
      actions={
        <>
          <RangeFilter state={rangeState} />
          <Button onClick={() => openCreate()}>
            <Plus /> New appointment
          </Button>
        </>
      }
    />
  )

  if (!data || !derived) return <>{header}<LoadingState label="Loading dashboard…" /></>

  if (data.all.length === 0) {
    const hasServices = (activeServices?.length ?? 0) > 0
    return (
      <>
        {header}
        <Panel>
          <EmptyState
            icon={Sparkles}
            title="No appointments yet"
            description={
              hasServices
                ? 'Create the first appointment, or share the booking page with a customer. Figures here are calculated from your saved appointments.'
                : 'Start by adding the services you offer and your staff. Then appointments and figures will show up here.'
            }
            action={
              hasServices ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => openCreate()}>
                    <Plus /> New appointment
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/book">Open booking page</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link to="/admin/services">Set up services</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/admin/settings?tab=data">Load sample data</Link>
                  </Button>
                </div>
              )
            }
          />
        </Panel>
      </>
    )
  }

  const { stats, revenue } = derived
  const tomorrow = addDays(now.date, 1)
  const maxService = derived.services[0]?.total ?? 0

  return (
    <>
      {header}
      <p className="-mt-3 mb-4 text-xs text-muted-foreground">Figures below cover {describeRange(range)}.</p>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Appointments" value={stats.total} icon={CalendarDays} hint="In selected period" />
        <StatCard label="Today" value={derived.today} icon={CalendarCheck2} hint={formatISODate(now.date, 'EEE, MMM d')} />
        <StatCard label="Pending" value={stats.byStatus.pending} icon={CircleDashed} tone="pending" />
        <StatCard label="Confirmed" value={stats.byStatus.confirmed} icon={CalendarCheck2} tone="confirmed" />
        <StatCard label="Completed" value={stats.byStatus.completed} icon={CheckCircle2} tone="completed" />
        <StatCard label="Cancelled" value={stats.byStatus.cancelled} icon={Ban} tone="cancelled" hint={`${stats.byStatus['no-show']} no-show`} />
        <StatCard label="Customers" value={data.customers.length} icon={UsersRound} hint="All time" />
        <StatCard
          label="Estimated revenue"
          value={money(revenue.estimatedCents)}
          icon={CircleDollarSign}
          hint={`Completed ${money(revenue.completedCents)} · projected ${money(revenue.projectedCents)}`}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <VolumeChart points={derived.series} title="Appointment trend" description="Appointments by date, split by outcome" />
        <Panel className="min-w-0">
          <PanelHeader title="Status distribution" description="All appointments in the period" />
          <div className="px-4 py-4">
            <HorizontalBars
              valueLabel="Appointments"
              rows={APPOINTMENT_STATUSES.map((s) => ({
                id: s,
                label: <StatusBadge status={s} />,
                text: STATUS_LABELS[s],
                value: stats.byStatus[s],
                display: String(stats.byStatus[s]),
                color: STATUS_VAR[s]!,
              }))}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RevenueChart points={derived.series} currency={settings.currency} title="Revenue trend" />
        <Panel className="min-w-0">
          <PanelHeader
            title="Popular services"
            description="Top 5 by appointments in the period"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/reports">Reports</Link>
              </Button>
            }
          />
          <div className="px-4 py-4">
            {derived.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments in this period.</p>
            ) : (
              <HorizontalBars
                valueLabel="Appointments"
                rows={derived.services.map((s) => ({
                  id: s.id,
                  label: s.name,
                  text: s.name,
                  value: s.total,
                  display: `${s.total}`,
                  color: theme.completed,
                }))}
              />
            )}
            {maxService > 0 && <p className="mt-3 text-xs text-muted-foreground">Counts include every status.</p>}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <UpcomingAppointments rows={derived.upcoming} today={now.date} tomorrow={tomorrow} />
        <NeedsAttention pendingSoon={derived.pendingSoon} pastOpen={derived.pastOpen} />
      </div>
    </>
  )
}
