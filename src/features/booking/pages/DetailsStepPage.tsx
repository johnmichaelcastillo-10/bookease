import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router'
import { LoadingState } from '@/components/feedback/states'
import { describedBy, FormItem } from '@/components/shared/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { bookingDetailsSchema, type BookingDetails } from '@/validation/schemas'
import { BookingSummary } from '../components/BookingSummary'
import { StepHeading, StepIndicator } from '../components/BookingStep'
import { useBookingFlow } from '../hooks/useBookingFlow'

const EMPTY: BookingDetails = { fullName: '', email: '', phone: '', notes: '' }

export function BookingDetailsForm({ defaultValues, onSubmit }: { defaultValues: BookingDetails; onSubmit: (values: BookingDetails) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(bookingDetailsSchema), defaultValues, mode: 'onTouched' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormItem label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={!!errors.fullName}
          aria-describedby={describedBy('fullName', errors.fullName?.message)}
          {...register('fullName')}
        />
      </FormItem>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormItem label="Email" htmlFor="email" error={errors.email?.message} required description="Used to look up your booking later.">
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={describedBy('email', errors.email?.message, true)}
            {...register('email')}
          />
        </FormItem>
        <FormItem label="Phone" htmlFor="phone" error={errors.phone?.message} required>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            aria-describedby={describedBy('phone', errors.phone?.message)}
            {...register('phone')}
          />
        </FormItem>
      </div>
      <FormItem label="Notes for the business" htmlFor="notes" error={errors.notes?.message} description="Optional. Anything they should know before your visit.">
        <Textarea
          id="notes"
          rows={3}
          aria-invalid={!!errors.notes}
          aria-describedby={describedBy('notes', errors.notes?.message, true)}
          {...register('notes')}
        />
      </FormItem>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" asChild className="sm:-ml-2">
          <Link to="/book/date-time">
            <ArrowLeft /> Back
          </Link>
        </Button>
        <Button type="submit" size="lg" className="h-10 px-4">
          Review booking <ArrowRight />
        </Button>
      </div>
    </form>
  )
}

export default function DetailsStepPage() {
  const navigate = useNavigate()
  const flow = useBookingFlow('details')
  const { business, draft, service } = flow

  if (flow.loading || !business) return <LoadingState />
  if (flow.redirect) return <Navigate to={flow.redirect} replace />
  if (!service) return <Navigate to="/book/service" replace />

  return (
    <div>
      <StepIndicator current="details" allowStaffSelection={flow.allowStaffSelection} />
      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="max-w-xl">
          <StepHeading title="Your details" description="We only use these to identify your booking in this browser." />
          <BookingDetailsForm
            defaultValues={draft.details ?? EMPTY}
            onSubmit={(values) => {
              draft.setDetails(values)
              navigate('/book/review')
            }}
          />
        </div>
        <BookingSummary
          service={service}
          staff={flow.staff}
          anyStaff={!flow.staffId}
          date={draft.date}
          startTime={draft.startTime}
          currency={business.settings.currency}
          className="self-start max-lg:order-first"
        />
      </div>
    </div>
  )
}
