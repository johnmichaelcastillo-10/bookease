import { useLiveQuery } from 'dexie-react-hooks'
import { Briefcase, Check } from 'lucide-react'
import { useNavigate } from 'react-router'
import { EmptyState, LoadingState } from '@/components/feedback/states'
import { categoriesRepository, servicesRepository } from '@/database/repositories/catalogRepository'
import { formatDuration, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StepHeading, StepIndicator } from '../components/BookingStep'
import { ServiceIcon } from '../components/ServiceIcon'
import { useBookingFlow } from '../hooks/useBookingFlow'

export default function ServiceStepPage() {
  const navigate = useNavigate()
  const { business, draft, allowStaffSelection } = useBookingFlow('service')
  const services = useLiveQuery(() => servicesRepository.listActive(), [])
  const categories = useLiveQuery(() => categoriesRepository.list(), [])

  if (!business || !services || !categories) return <LoadingState />
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  function choose(serviceId: string) {
    draft.selectService(serviceId)
    if (allowStaffSelection) {
      navigate('/book/staff')
    } else {
      // Staff selection is off: the booking goes to any available staff member.
      draft.selectStaff(null)
      navigate('/book/date-time')
    }
  }

  return (
    <div>
      <StepIndicator current="service" allowStaffSelection={allowStaffSelection} />
      <StepHeading title="Choose a service" description="Prices and durations are shown up front. You won't pay anything online." />
      {services.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No services available"
          description="There are no services open for online booking right now. Please check back later."
          className="rounded-lg border bg-card"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Services">
          {services.map((s) => {
            const selected = draft.serviceId === s.id
            const category = categoryName.get(s.categoryId)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => choose(s.id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex h-full w-full gap-3 rounded-lg border bg-card p-4 text-left transition-colors',
                    'hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    selected && 'border-primary ring-1 ring-primary',
                  )}
                >
                  <ServiceIcon name={s.name} category={category} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium">{s.name}</span>
                      {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                    </span>
                    {category && <span className="mt-0.5 block text-xs text-muted-foreground">{category}</span>}
                    {s.description && <span className="mt-1.5 block text-sm text-muted-foreground">{s.description}</span>}
                    <span className="mt-3 flex items-center gap-3 text-sm tabular">
                      <span className="text-muted-foreground">{formatDuration(s.durationMinutes)}</span>
                      <span className="font-semibold">{formatMoney(s.priceCents, business.settings.currency)}</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
