/** Booking wizard steps and the rule for which step a draft may be on. */
import type { ID, ISODate, TimeHM } from '@/types/models'
import type { BookingDetails } from '@/validation/schemas'

export type StepKey = 'service' | 'staff' | 'date-time' | 'details' | 'review'

export interface StepDef {
  key: StepKey
  label: string
  path: string
}

export const ALL_STEPS: StepDef[] = [
  { key: 'service', label: 'Service', path: '/book/service' },
  { key: 'staff', label: 'Staff', path: '/book/staff' },
  { key: 'date-time', label: 'Date & time', path: '/book/date-time' },
  { key: 'details', label: 'Your details', path: '/book/details' },
  { key: 'review', label: 'Review', path: '/book/review' },
]

/** The staff step is skipped when the business doesn't let customers choose. */
export function visibleSteps(allowStaffSelection: boolean): StepDef[] {
  return allowStaffSelection ? ALL_STEPS : ALL_STEPS.filter((s) => s.key !== 'staff')
}

export function stepPath(key: StepKey): string {
  return ALL_STEPS.find((s) => s.key === key)!.path
}

export interface DraftSnapshot {
  serviceId: ID | null
  staffId: ID | null
  staffChosen: boolean
  date: ISODate | null
  startTime: TimeHM | null
  details: BookingDetails | null
}

/** First step whose input is still missing. */
export function firstIncompleteStep(draft: DraftSnapshot, allowStaffSelection: boolean): StepKey {
  if (!draft.serviceId) return 'service'
  if (allowStaffSelection && !draft.staffChosen) return 'staff'
  if (!draft.date || !draft.startTime) return 'date-time'
  if (!draft.details) return 'details'
  return 'review'
}

/** Where a visitor on `step` should be sent instead, or null when the step is reachable. */
export function guardRedirect(step: StepKey, draft: DraftSnapshot, allowStaffSelection: boolean): string | null {
  if (step === 'staff' && !allowStaffSelection) return draft.serviceId ? stepPath('date-time') : stepPath('service')
  const order = ALL_STEPS.map((s) => s.key)
  const target = firstIncompleteStep(draft, allowStaffSelection)
  return order.indexOf(step) > order.indexOf(target) ? stepPath(target) : null
}

/** Staff the booking will request: null means "any available". */
export function effectiveStaffId(draft: DraftSnapshot, allowStaffSelection: boolean): ID | null {
  return allowStaffSelection ? draft.staffId : null
}
