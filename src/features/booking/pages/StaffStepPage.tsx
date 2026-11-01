import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, Users } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router'
import { EmptyState, LoadingState } from '@/components/feedback/states'
import { Avatar } from '@/components/shared/StaffBadge'
import { Button } from '@/components/ui/button'
import { staffRepository } from '@/database/repositories/staffRepository'
import { cn } from '@/lib/utils'
import { getEligibleStaff } from '@/services/availability/engine'
import { BookingSummary } from '../components/BookingSummary'
import { StepHeading, StepIndicator } from '../components/BookingStep'
import { useBookingFlow } from '../hooks/useBookingFlow'

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex h-full w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors',
        'hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        selected && 'border-primary ring-1 ring-primary',
      )}
    >
      {children}
      {selected && <Check className="ml-auto size-4 shrink-0 text-primary" aria-hidden />}
    </button>
  )
}

export default function StaffStepPage() {
  const navigate = useNavigate()
  const flow = useBookingFlow('staff')
  const allStaff = useLiveQuery(() => staffRepository.list(), [])

  if (flow.loading || !allStaff || !flow.business) return <LoadingState />
  if (flow.redirect) return <Navigate to={flow.redirect} replace />
  const { draft, service } = flow
  if (!service) return <Navigate to="/book/service" replace />

  const eligible = getEligibleStaff(service, allStaff)

  function choose(staffId: string | null) {
    draft.selectStaff(staffId)
    navigate('/book/date-time')
  }

  return (
    <div>
      <StepIndicator current="staff" allowStaffSelection={flow.allowStaffSelection} />
      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <StepHeading title="Who would you like to see?" description={`Staff who offer ${service.name}.`} />
          {eligible.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nobody is taking this service right now"
              description="Please choose another service, or check back later."
              action={
                <Button variant="outline" asChild>
                  <Link to="/book/service">Choose another service</Link>
                </Button>
              }
              className="rounded-lg border bg-card"
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Staff">
              <li className="sm:col-span-2">
                <OptionButton selected={draft.staffChosen && draft.staffId === null} onClick={() => choose(null)}>
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
                    <Users className="size-4" />
                  </span>
                  <span>
                    <span className="block font-medium">Any available</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      See every open time. We’ll assign whoever is free when you confirm.
                    </span>
                  </span>
                </OptionButton>
              </li>
              {eligible.map((s) => (
                <li key={s.id}>
                  <OptionButton selected={draft.staffChosen && draft.staffId === s.id} onClick={() => choose(s.id)}>
                    <Avatar name={s.fullName} color={s.color} />
                    <span className="min-w-0">
                      <span className="block font-medium">{s.fullName}</span>
                      {s.position && <span className="block text-xs text-muted-foreground">{s.position}</span>}
                      {s.description && <span className="mt-1.5 block text-sm text-muted-foreground">{s.description}</span>}
                    </span>
                  </OptionButton>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" asChild className="mt-6 -ml-2">
            <Link to="/book/service">
              <ArrowLeft /> Back to services
            </Link>
          </Button>
        </div>
        <BookingSummary
          service={service}
          staff={flow.staff}
          anyStaff={draft.staffChosen && !draft.staffId}
          date={draft.date}
          startTime={draft.startTime}
          currency={flow.business.settings.currency}
          className="hidden self-start lg:block"
        />
      </div>
    </div>
  )
}
