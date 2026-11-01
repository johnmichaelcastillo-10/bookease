import { CalendarClock, Info, Layers, UserRoundCheck } from 'lucide-react'
import { Link } from 'react-router'
import { LoadingState } from '@/components/feedback/states'
import { PageHeader, Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatDuration } from '@/lib/format'
import { BusinessHoursCard } from '../components/BusinessHoursCard'
import { SpecialDatesList } from '../components/SpecialDatesList'

const STEPS = [
  { icon: Layers, title: 'Business hours', text: 'The weekly opening hours, minus breaks. Special dates can close a day or replace its hours.' },
  { icon: UserRoundCheck, title: 'Staff schedules', text: 'Each staff member follows business hours or their own; their time is always limited to when the business is open, minus leave.' },
  { icon: CalendarClock, title: 'Bookings', text: 'Existing appointments (plus the service’s buffer after each) are removed. Cancelled ones free their time.' },
]

export default function AvailabilityPage() {
  const ctx = useBusinessContext()
  return (
    <>
      <PageHeader
        title="Availability"
        description="Opening hours, breaks, holidays and closures. These decide which times customers can book."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/staff">Staff schedules</Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <BusinessHoursCard />
          {ctx ? <SpecialDatesList today={ctx.now.date} /> : <LoadingState />}
        </div>

        <aside className="space-y-6">
          <Panel>
            <PanelHeader title="How bookable times are found" />
            <ol className="space-y-4 px-4 py-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-primary">
                    <step.icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {i + 1}. {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            {ctx && (
              <div className="border-t px-4 py-3 text-xs text-muted-foreground">
                <p className="flex gap-2">
                  <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span>
                    Slots start every {formatDuration(ctx.settings.slotIntervalMinutes)}.{' '}
                    {ctx.settings.minNoticeMinutes > 0
                      ? `Customers need ${formatDuration(ctx.settings.minNoticeMinutes)} notice`
                      : 'Customers can book without notice'}{' '}
                    and up to {ctx.settings.maxAdvanceDays} days ahead.{' '}
                    <Link to="/admin/settings?tab=booking" className="font-medium text-primary hover:underline">
                      Change booking rules
                    </Link>
                  </span>
                </p>
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </>
  )
}
