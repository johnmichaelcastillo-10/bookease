import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { visibleSteps, type StepKey } from '../lib/flow'

/** Progress for the booking wizard. Completed steps are links back. */
export function StepIndicator({ current, allowStaffSelection }: { current: StepKey; allowStaffSelection: boolean }) {
  const steps = visibleSteps(allowStaffSelection)
  const index = steps.findIndex((s) => s.key === current)
  const currentStep = steps[index]
  return (
    <nav aria-label="Booking progress" className="no-print mb-8">
      <p className="mb-2 text-xs font-medium text-muted-foreground sm:hidden">
        Step {index + 1} of {steps.length} · {currentStep?.label}
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-muted sm:hidden" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((step, i) => {
          const done = i < index
          const active = i === index
          const content = (
            <>
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'text-muted-foreground',
                )}
                aria-hidden
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn('text-sm whitespace-nowrap', active ? 'font-semibold' : 'text-muted-foreground')}>{step.label}</span>
            </>
          )
          return (
            <li key={step.key} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
              {done ? (
                <Link to={step.path} className="flex items-center gap-2 rounded-md hover:[&>span:last-child]:text-foreground">
                  {content}
                  <span className="sr-only">(completed, go back)</span>
                </Link>
              ) : (
                <span className="flex items-center gap-2">{content}</span>
              )}
              {i < steps.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-border lg:w-10" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Step title that takes focus when the step opens, so screen readers announce the new step. */
export function StepHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div className="mb-6">
      <h1 ref={ref} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
        {title}
      </h1>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
