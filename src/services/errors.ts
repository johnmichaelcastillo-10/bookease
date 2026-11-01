import type { ZodError } from 'zod'
import { REASON_MESSAGES, type ScheduledInterval, type TimeValidationReason } from '@/services/availability/engine'

/** Base class for errors a user can act on. `message` is safe to show in the UI. */
export class DomainError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export class ValidationError extends DomainError {
  readonly issues: { path: string; message: string }[]

  constructor(message: string, issues: { path: string; message: string }[] = []) {
    super(message, 'validation')
    this.name = 'ValidationError'
    this.issues = issues
  }

  static fromZod(error: ZodError): ValidationError {
    const issues = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    return new ValidationError(issues[0]?.message ?? 'Some fields are not valid.', issues)
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} was not found. It may have been deleted.`, 'not-found')
    this.name = 'NotFoundError'
  }
}

export class SchedulingError extends DomainError {
  readonly reason: TimeValidationReason
  readonly conflict?: ScheduledInterval

  constructor(reason: TimeValidationReason, conflict?: ScheduledInterval, label?: string) {
    super(label && (reason === 'holiday' || reason === 'closed') ? `${REASON_MESSAGES[reason]} (${label})` : REASON_MESSAGES[reason], 'scheduling')
    this.name = 'SchedulingError'
    this.reason = reason
    this.conflict = conflict
  }
}

export class DuplicateBookingError extends DomainError {
  constructor(message: string) {
    super(message, 'duplicate-booking')
    this.name = 'DuplicateBookingError'
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, code = 'business-rule') {
    super(message, code)
    this.name = 'BusinessRuleError'
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof DomainError) return error.message
  if (error instanceof Error && error.name === 'InvalidTransitionError') return error.message
  console.error(error)
  return 'Something went wrong while saving. Your data was not changed.'
}
