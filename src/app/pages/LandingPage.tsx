import { ArrowRight, CalendarCheck2, CalendarDays, HardDrive, LayoutDashboard, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router'
import { BrandMark } from '@/components/shared/BrandMark'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useBusinessSettings } from '@/hooks/useBusiness'

const POINTS = [
  { icon: CalendarDays, title: 'Scheduling engine', text: 'Slots respect business hours, staff schedules, breaks, closures, buffers and existing bookings.' },
  { icon: LayoutDashboard, title: 'Full admin workspace', text: 'Appointments, calendar, services, staff, customers, reports and an activity log.' },
  { icon: Store, title: 'Customer booking portal', text: 'A step-by-step booking flow with confirmation, lookup and self-service cancellation.' },
  { icon: HardDrive, title: 'Local-first', text: 'No server or account. Data lives in IndexedDB in this browser, with JSON backup and restore.' },
]

/** Entry page: choose the admin workspace or the customer booking portal. */
export default function LandingPage() {
  const settings = useBusinessSettings()
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <BrandMark />
        <span className="text-sm font-semibold">BookEase</span>
        <div className="flex-1" />
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden />
              Runs entirely in your browser
            </p>
            <h1 className="mt-5 text-3xl leading-tight font-semibold sm:text-5xl">
              Appointments, staff and bookings for {settings?.name ?? 'your business'}.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              BookEase is an appointment management system for service businesses: salons, consultancies, repair shops, studios. Open the
              admin to run the schedule, or try the booking portal your customers would use.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild className="h-10 px-4">
                <Link to="/admin">
                  Open admin dashboard <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-10 px-4">
                <Link to="/book">
                  <CalendarCheck2 /> Book as a customer
                </Link>
              </Button>
            </div>
            <p className="mt-6 max-w-xl text-xs text-muted-foreground">
              Demo limitation: the admin and the booking portal share this browser’s data. A booking made here is not sent to anyone and
              won’t appear on another device.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {POINTS.map((p) => (
              <li key={p.title} className="rounded-lg border bg-card p-4">
                <p.icon className="size-4.5 text-primary" aria-hidden />
                <p className="mt-3 text-sm font-semibold">{p.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
