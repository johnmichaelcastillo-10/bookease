import { Check, ChevronsUpDown, Globe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { browserTimeZone, listTimeZones } from '@/lib/time'
import { cn } from '@/lib/utils'

const MAX_VISIBLE = 80

/** Searchable IANA timezone picker. The full list has 400+ zones, so it filters as you type. */
export function TimezonePicker({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string
  value: string
  onChange: (zone: string) => void
  invalid?: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const zones = useMemo(() => {
    const all = listTimeZones()
    return all.includes(value) || !value ? all : [value, ...all]
  }, [value])
  const local = browserTimeZone()

  const q = query.trim().toLowerCase().replace(/\s+/g, '_')
  const matches = q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones
  const visible = matches.slice(0, MAX_VISIBLE)

  function pick(zone: string) {
    onChange(zone)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Globe className="text-muted-foreground" aria-hidden />
            <span className="truncate">{value || 'Choose a timezone'}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, e.g. Manila or New York"
            aria-label="Search timezones"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && visible[0]) {
                e.preventDefault()
                pick(visible[0])
              }
            }}
          />
        </div>
        {!q && local !== value && (
          <button
            type="button"
            onClick={() => pick(local)}
            className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted"
          >
            <span className="text-muted-foreground">Use this device’s zone:</span>
            <span className="font-medium">{local}</span>
          </button>
        )}
        <ul role="listbox" aria-label="Timezones" className="max-h-64 overflow-y-auto py-1 scrollbar-thin">
          {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No timezone matches “{query}”.</li>}
          {visible.map((zone) => (
            <li key={zone} role="option" aria-selected={zone === value}>
              <button
                type="button"
                onClick={() => pick(zone)}
                className={cn('flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted', zone === value && 'font-medium')}
              >
                <span className="truncate">{zone.replace(/_/g, ' ')}</span>
                {zone === value && <Check className="size-4 text-primary" aria-hidden />}
              </button>
            </li>
          ))}
          {matches.length > MAX_VISIBLE && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {matches.length - MAX_VISIBLE} more, keep typing to narrow the list.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
