import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CalendarCheck2, Clock, Info, Mail, MapPin, Phone, Search } from 'lucide-react'
import { Link } from 'react-router'
import { LoadingState } from '@/components/feedback/states'
import { Button } from '@/components/ui/button'
import { businessHoursRepository } from '@/database/repositories/availabilityRepository'
import { servicesRepository } from '@/database/repositories/catalogRepository'
import { useBusinessSettings } from '@/hooks/useBusiness'
import { formatPhone } from '@/lib/contact'
import { formatDuration, formatMoney, formatTimeRange } from '@/lib/format'
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '@/services/settings/defaults'
import type { BusinessHoursDay } from '@/types/models'
import { ServiceIcon } from '../components/ServiceIcon'

function hoursText(day: BusinessHoursDay | undefined): string {
  if (!day || !day.isOpen || day.intervals.length === 0) return 'Closed'
  return day.intervals.map((r) => formatTimeRange(r.start, r.end)).join(', ')
}

export default function BookingHomePage() {
  const settings = useBusinessSettings()
  const hours = useLiveQuery(() => businessHoursRepository.list(), [])
  const services = useLiveQuery(() => servicesRepository.listActive(), [])

  if (!settings || !hours || !services) return <LoadingState />

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-medium text-primary">Online booking</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{settings.name}</h1>
          {settings.description && <p className="mt-3 max-w-xl text-base text-muted-foreground">{settings.description}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild className="h-10 px-4">
              <Link to="/book/service">
                <CalendarCheck2 /> Book an appointment
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-10 px-4">
              <Link to="/booking-lookup">
                <Search /> Find my booking
              </Link>
            </Button>
          </div>
          <ul className="mt-6 space-y-1.5 text-sm text-muted-foreground">
            {settings.address && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden /> {settings.address}
              </li>
            )}
            {settings.phone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0" aria-hidden /> {formatPhone(settings.phone)}
              </li>
            )}
            {settings.email && (
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" aria-hidden /> {settings.email}
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4 text-muted-foreground" aria-hidden /> Opening hours
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {WEEKDAY_ORDER.map((wd) => {
              const text = hoursText(hours.find((h) => h.weekday === wd))
              return (
                <div key={wd} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{WEEKDAY_LABELS[wd]}</dt>
                  <dd className={text === 'Closed' ? 'text-muted-foreground' : 'text-right tabular'}>{text}</dd>
                </div>
              )
            })}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Times are in {settings.timezone.replace(/_/g, ' ')}. Holidays may differ.</p>
        </div>
      </section>

      <section aria-labelledby="services-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="services-heading" className="text-lg font-semibold">
            Services
          </h2>
          {services.length > 4 && (
            <Link to="/book/service" className="text-sm font-medium text-primary hover:underline">
              See all {services.length}
            </Link>
          )}
        </div>
        {services.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No services are open for online booking right now.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {services.slice(0, 4).map((s) => (
              <li key={s.id} className="flex gap-3 rounded-lg border bg-card p-4">
                <ServiceIcon name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                  <p className="mt-2 text-sm tabular">
                    {formatDuration(s.durationMinutes)} · <span className="font-medium">{formatMoney(s.priceCents, settings.currency)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button variant="link" asChild className="mt-3 h-auto px-0">
          <Link to="/book/service">
            Start booking <ArrowRight />
          </Link>
        </Button>
      </section>

      <p className="flex gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          This booking page is part of a local demo. Your booking is saved in this browser only and is not sent to {settings.name}. You can
          look it up or cancel it here, on this device.
        </span>
      </p>
    </div>
  )
}
