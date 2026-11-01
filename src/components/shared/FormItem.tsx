import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Label + control + description + error, wired for screen readers. Pass the control's id as
 * `htmlFor`; give the control `aria-invalid` and `aria-describedby={describedBy(htmlFor, ...)}`.
 */
export function FormItem({
  label,
  htmlFor,
  error,
  description,
  required,
  children,
  className,
}: {
  label: React.ReactNode
  htmlFor: string
  error?: string
  description?: React.ReactNode
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {description && !error && (
        <p id={`${htmlFor}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** aria-describedby value matching FormItem's ids. */
export function describedBy(id: string, error?: string, hasDescription = false): string | undefined {
  if (error) return `${id}-error`
  return hasDescription ? `${id}-description` : undefined
}
