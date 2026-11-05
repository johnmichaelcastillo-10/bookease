import type { AppointmentStatus } from '@/types/models'

/** Allowed transitions. Completed, cancelled and no-show are terminal. See docs/ARCHITECTURE.md §6. */
export const STATUS_TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no-show'],
  completed: [],
  cancelled: [],
  'no-show': [],
}

/** Transitions that only make sense once the appointment has started. */
export const REQUIRES_STARTED: readonly AppointmentStatus[] = ['completed', 'no-show']

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

export function isTerminal(status: AppointmentStatus): boolean {
  return STATUS_TRANSITIONS[status].length === 0
}

export function isReschedulable(status: AppointmentStatus): boolean {
  return status === 'pending' || status === 'confirmed'
}

export class InvalidTransitionError extends Error {
  readonly from: AppointmentStatus
  readonly to: AppointmentStatus

  constructor(from: AppointmentStatus, to: AppointmentStatus) {
    super(`An appointment that is ${STATUS_LABELS[from].toLowerCase()} can't be marked ${STATUS_LABELS[to].toLowerCase()}.`)
    this.name = 'InvalidTransitionError'
    this.from = from
    this.to = to
  }
}

export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}
