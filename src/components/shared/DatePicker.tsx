import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatISODate } from '@/lib/format'
import { isoDateToLocalDate, localDateToISODate } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { ISODate } from '@/types/models'

export interface DatePickerProps {
  value: ISODate | null
  onChange: (date: ISODate) => void
  /** Days that can't be picked (closed, past, outside the window...). */
  isDisabled?: (date: ISODate) => boolean
  fromDate?: ISODate
  toDate?: ISODate
  placeholder?: string
  id?: string
  className?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/** Button + popover calendar working in ISO date strings (no timezone conversion). */
export function DatePicker({ value, onChange, isDisabled, fromDate, toDate, placeholder = 'Pick a date', id, className, ...aria }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={aria['aria-invalid']}
          aria-label={aria['aria-label']}
          className={cn('w-full justify-start font-normal', !value && 'text-muted-foreground', className)}
        >
          <CalendarDays className="text-muted-foreground" aria-hidden />
          {value ? formatISODate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <InlineCalendar
          value={value}
          onChange={(d) => {
            onChange(d)
            setOpen(false)
          }}
          isDisabled={isDisabled}
          fromDate={fromDate}
          toDate={toDate}
        />
      </PopoverContent>
    </Popover>
  )
}

export function InlineCalendar({
  value,
  onChange,
  isDisabled,
  fromDate,
  toDate,
  month,
  onMonthChange,
  className,
}: {
  value: ISODate | null
  onChange: (date: ISODate) => void
  isDisabled?: (date: ISODate) => boolean
  fromDate?: ISODate
  toDate?: ISODate
  month?: ISODate
  onMonthChange?: (month: ISODate) => void
  className?: string
}) {
  return (
    <Calendar
      mode="single"
      selected={value ? isoDateToLocalDate(value) : undefined}
      onSelect={(d) => d && onChange(localDateToISODate(d))}
      defaultMonth={value ? isoDateToLocalDate(value) : fromDate ? isoDateToLocalDate(fromDate) : undefined}
      month={month ? isoDateToLocalDate(month) : undefined}
      onMonthChange={onMonthChange ? (m) => onMonthChange(localDateToISODate(m)) : undefined}
      startMonth={fromDate ? isoDateToLocalDate(fromDate) : undefined}
      endMonth={toDate ? isoDateToLocalDate(toDate) : undefined}
      weekStartsOn={1}
      disabled={(d) => {
        const iso = localDateToISODate(d)
        if (fromDate && iso < fromDate) return true
        if (toDate && iso > toDate) return true
        return isDisabled?.(iso) ?? false
      }}
      className={className}
    />
  )
}
