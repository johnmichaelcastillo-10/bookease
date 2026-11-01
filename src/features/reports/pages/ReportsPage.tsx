import { useSearchParams } from 'react-router'
import { LoadingState } from '@/components/feedback/states'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBusinessContext } from '@/hooks/useBusiness'
import type { WallClock } from '@/lib/time'
import type { BusinessSettings } from '@/types/models'
import { AppointmentsReport } from '../components/AppointmentsReport'
import { CustomersReport } from '../components/CustomersReport'
import { RangeFilter } from '../components/RangeFilter'
import { describeRange, useRangeFilter } from '../lib/rangeState'
import { RevenueReport } from '../components/RevenueReport'
import { useReportData } from '../lib/reportData'

const TABS = ['appointments', 'revenue', 'customers'] as const
type Tab = (typeof TABS)[number]

export default function ReportsPage() {
  const ctx = useBusinessContext()
  if (!ctx) return <LoadingState />
  return <Reports settings={ctx.settings} now={ctx.now} />
}

function Reports({ settings, now }: { settings: BusinessSettings; now: WallClock }) {
  const rangeState = useRangeFilter(now.date, 'month')
  const { range } = rangeState
  const data = useReportData(range)
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'appointments'

  const setTab = (next: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'appointments') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )

  return (
    <div className="print-area">
      <PageHeader
        title="Reports"
        description={
          <>
            {describeRange(range)} · calculated from the appointments stored in this browser
          </>
        }
        actions={<RangeFilter state={rangeState} />}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-print mb-4">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>
        {!data ? (
          <LoadingState label="Calculating report…" />
        ) : (
          <>
            <TabsContent value="appointments">
              <AppointmentsReport key={`${range.from}${range.to}`} appointments={data.inPeriod} range={range} today={now.date} />
            </TabsContent>
            <TabsContent value="revenue">
              <RevenueReport key={`${range.from}${range.to}`} appointments={data.inPeriod} range={range} currency={settings.currency} />
            </TabsContent>
            <TabsContent value="customers">
              <CustomersReport customers={data.customers} allAppointments={data.all} range={range} currency={settings.currency} timeZone={settings.timezone} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
