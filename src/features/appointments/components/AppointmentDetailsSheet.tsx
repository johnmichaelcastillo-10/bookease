import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarCheck2, CalendarClock, CheckCircle2, Copy, Pencil, UserX, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { LoadingState } from '@/components/feedback/states'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { StatusBadge, StatusDot } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { appointmentsRepository } from '@/database/repositories/appointmentsRepository'
import { useBusinessContext } from '@/hooks/useBusiness'
import { formatPhone } from '@/lib/contact'
import { formatDuration, formatISODate, formatMoney, formatTimeRange, formatTimestamp } from '@/lib/format'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  hasStarted,
  markNoShow,
} from '@/services/appointments/appointmentService'
import { canTransition, isReschedulable, STATUS_LABELS } from '@/services/appointments/status'
import { errorMessage } from '@/services/errors'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { Actor, Appointment, ID } from '@/types/models'

type PendingAction = 'cancel' | 'complete' | 'no-show' | null

const ACTOR_LABEL: Record<Actor, string> = { admin: 'Admin', customer: 'Customer', system: 'System' }

export function AppointmentDetailsSheet({ id, open, onOpenChange }: { id: ID; open: boolean; onOpenChange: (open: boolean) => void }) {
  const appt = useLiveQuery(async () => (await appointmentsRepository.get(id)) ?? null, [id])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {appt === undefined ? (
          <>
            <SheetHeader>
              <SheetTitle>Appointment</SheetTitle>
              <SheetDescription className="sr-only">Loading appointment details</SheetDescription>
            </SheetHeader>
            <LoadingState />
          </>
        ) : appt === null ? (
          <SheetHeader>
            <SheetTitle>Appointment not found</SheetTitle>
            <SheetDescription>It may have been removed, for example by clearing sample data or restoring a backup.</SheetDescription>
          </SheetHeader>
        ) : (
          <Details appt={appt} onClose={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Details({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const ctx = useBusinessContext()
  const { openEdit, openReschedule } = useAppointmentUi()
  const [pending, setPending] = useState<PendingAction>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const started = ctx ? hasStarted(appt, ctx.settings.timezone) : false
  const currency = ctx?.settings.currency ?? 'USD'

  async function run(action: () => Promise<Appointment>, success: string) {
    setBusy(true)
    try {
      await action()
      toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    } finally {
      setBusy(false)
    }
  }

  const notStartedHint = 'Available once the appointment has started.'
  const canComplete = canTransition(appt.status, 'completed')
  const canNoShow = canTransition(appt.status, 'no-show')

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex items-center gap-2">
          <StatusBadge status={appt.status} />
          <span className="text-xs text-muted-foreground">{appt.channel === 'portal' ? 'Booked online' : 'Booked by admin'}</span>
        </div>
        <SheetTitle className="mt-2 text-lg font-semibold">{appt.serviceName}</SheetTitle>
        <SheetDescription>
          {formatISODate(appt.date, 'EEEE, MMMM d, yyyy')} · {formatTimeRange(appt.startTime, appt.endTime)}
        </SheetDescription>
        <div className="mt-1 flex items-center gap-1.5">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{appt.reference}</code>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy booking reference"
            onClick={() => {
              void navigator.clipboard?.writeText(appt.reference).then(
                () => toast.success('Reference copied.'),
                () => toast.error('Could not copy.'),
              )
            }}
          >
            <Copy />
          </Button>
        </div>
      </SheetHeader>

      {/* Actions available in this status */}
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        {canTransition(appt.status, 'confirmed') && (
          <Button size="sm" disabled={busy} onClick={() => run(() => confirmAppointment(appt.id), `Confirmed ${appt.reference}.`).catch(() => {})}>
            <CalendarCheck2 /> Confirm
          </Button>
        )}
        {canComplete && (
          <ActionWithHint disabled={!started} hint={notStartedHint}>
            <Button size="sm" disabled={busy || !started} onClick={() => setPending('complete')}>
              <CheckCircle2 /> Mark completed
            </Button>
          </ActionWithHint>
        )}
        {canNoShow && (
          <ActionWithHint disabled={!started} hint={notStartedHint}>
            <Button size="sm" variant="outline" disabled={busy || !started} onClick={() => setPending('no-show')}>
              <UserX /> No-show
            </Button>
          </ActionWithHint>
        )}
        {isReschedulable(appt.status) && (
          <Button size="sm" variant="outline" onClick={() => openReschedule(appt.id)}>
            <CalendarClock /> Reschedule
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => openEdit(appt.id)}>
          <Pencil /> Edit
        </Button>
        {canTransition(appt.status, 'cancelled') && (
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setPending('cancel')}>
            <XCircle /> Cancel appointment
          </Button>
        )}
        {(canComplete || canNoShow) && !started && <p className="w-full text-xs text-muted-foreground">Completed and no-show become available once it starts.</p>}
      </div>

      <div className="space-y-5 px-4 py-4">
        <section aria-labelledby="appt-customer-h">
          <h3 id="appt-customer-h" className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Customer
          </h3>
          <dl>
            <Row label="Name">
              <Link to={`/admin/customers/${appt.customerId}`} onClick={onClose} className="font-medium text-primary hover:underline">
                {appt.customerName}
              </Link>
            </Row>
            <Row label="Email">
              <a href={`mailto:${appt.customerEmail}`} className="hover:underline">
                {appt.customerEmail}
              </a>
            </Row>
            <Row label="Phone">{formatPhone(appt.customerPhone)}</Row>
          </dl>
          <p className="mt-1 text-xs text-muted-foreground">Contact details as recorded when this appointment was booked.</p>
        </section>

        <Separator />

        <section aria-labelledby="appt-booking-h">
          <h3 id="appt-booking-h" className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Booking
          </h3>
          <dl>
            <Row label="Service">{appt.serviceName}</Row>
            <Row label="Staff">
              <Link to={`/admin/staff/${appt.staffId}`} onClick={onClose} className="text-primary hover:underline">
                {appt.staffName}
              </Link>
            </Row>
            <Row label="Date">{formatISODate(appt.date)}</Row>
            <Row label="Time">
              <span className="tabular">{formatTimeRange(appt.startTime, appt.endTime)}</span>
            </Row>
            <Row label="Duration">
              {formatDuration(appt.durationMinutes)}
              {appt.bufferMinutes > 0 && <span className="text-muted-foreground"> + {appt.bufferMinutes} min buffer</span>}
            </Row>
            <Row label="Price">
              <span className="tabular">{formatMoney(appt.priceCents, currency)}</span>
              {(appt.status === 'cancelled' || appt.status === 'no-show') && <span className="text-muted-foreground"> (not counted as revenue)</span>}
            </Row>
          </dl>
        </section>

        <Separator />

        <section aria-labelledby="appt-notes-h">
          <h3 id="appt-notes-h" className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Notes
          </h3>
          <p className="text-xs font-medium text-muted-foreground">From the customer</p>
          <p className="mb-3 text-sm whitespace-pre-wrap">{appt.customerNotes || <span className="text-muted-foreground">None</span>}</p>
          <p className="text-xs font-medium text-muted-foreground">Internal</p>
          <p className="text-sm whitespace-pre-wrap">{appt.internalNotes || <span className="text-muted-foreground">None</span>}</p>
        </section>

        <Separator />

        <section aria-labelledby="appt-history-h">
          <h3 id="appt-history-h" className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            History
          </h3>
          <ol className="relative space-y-3 border-l pl-4">
            {appt.statusHistory.map((h, i) => (
              <li key={i} className="relative">
                <StatusDot status={h.status} className="absolute top-1.5 -left-[21px] ring-2 ring-popover" />
                <p className="text-sm font-medium">{STATUS_LABELS[h.status]}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(h.at)} · {ACTOR_LABEL[h.by]}
                </p>
              </li>
            ))}
          </ol>
          {appt.cancelledAt && (
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Cancelled {formatTimestamp(appt.cancelledAt)}</span>
              {appt.cancelledBy && <span className="text-muted-foreground"> by {ACTOR_LABEL[appt.cancelledBy].toLowerCase()}</span>}
              {appt.cancellationReason && <span>: “{appt.cancellationReason}”</span>}
            </p>
          )}
          <dl className="mt-3 text-xs text-muted-foreground">
            <div>Created {formatTimestamp(appt.createdAt)}</div>
            <div>Last updated {formatTimestamp(appt.updatedAt)}</div>
          </dl>
        </section>
      </div>

      <ConfirmDialog
        open={pending === 'cancel'}
        onOpenChange={(o) => {
          if (!o) {
            setPending(null)
            setReason('')
          }
        }}
        title="Cancel this appointment?"
        description={`${appt.serviceName} for ${appt.customerName} on ${formatISODate(appt.date)}. The time slot is released immediately. This can't be undone.`}
        confirmLabel="Cancel appointment"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => run(() => cancelAppointment(appt.id, reason), `Cancelled ${appt.reference}.`)}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea id="cancel-reason" rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer called to cancel" />
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={pending === 'complete'}
        onOpenChange={(o) => !o && setPending(null)}
        title="Mark as completed?"
        description={`Records ${formatMoney(appt.priceCents, currency)} as completed revenue. Completed appointments can't change status again.`}
        confirmLabel="Mark completed"
        onConfirm={() => run(() => completeAppointment(appt.id), `Completed ${appt.reference}.`)}
      />
      <ConfirmDialog
        open={pending === 'no-show'}
        onOpenChange={(o) => !o && setPending(null)}
        title="Mark as no-show?"
        description={`${appt.customerName} didn't attend. The time stays blocked in the schedule and no revenue is counted. This can't be undone.`}
        confirmLabel="Mark no-show"
        destructive
        onConfirm={() => run(() => markNoShow(appt.id), `Marked ${appt.reference} as a no-show.`)}
      />
    </>
  )
}

/** Disabled buttons don't fire pointer events, so the tooltip wraps a focusable span. */
function ActionWithHint({ disabled, hint, children }: { disabled: boolean; hint: string; children: React.ReactNode }) {
  if (!disabled) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={hint}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}
