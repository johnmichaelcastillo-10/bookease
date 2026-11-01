import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Service, Staff } from '@/types/models'
import { CALENDAR_VIEWS, type CalendarView } from '../calendarUtils'

const VIEW_LABELS: Record<CalendarView, string> = { day: 'Day', week: 'Week', month: 'Month', agenda: 'Agenda' }

export interface CalendarFilters {
  staffId: string
  serviceId: string
  showCancelled: boolean
}

export function CalendarToolbar({
  view,
  title,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  filters,
  onFiltersChange,
  staff,
  services,
}: {
  view: CalendarView
  title: string
  onViewChange: (view: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  filters: CalendarFilters
  onFiltersChange: (filters: CalendarFilters) => void
  staff: Staff[]
  services: Service[]
}) {
  const period = view === 'agenda' ? '2 weeks' : view
  return (
    <div className="flex flex-col gap-3 border-b px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon-sm" onClick={onPrev} aria-label={`Previous ${period}`}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onNext} aria-label={`Next ${period}`}>
            <ChevronRight />
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold" aria-live="polite" data-testid="calendar-title">
          {title}
        </h2>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={view}
          onValueChange={(v) => v && onViewChange(v as CalendarView)}
          aria-label="Calendar view"
        >
          {CALENDAR_VIEWS.map((v) => (
            <ToggleGroupItem key={v} value={v} className="px-2.5 text-xs">
              {VIEW_LABELS[v]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.staffId} onValueChange={(staffId) => onFiltersChange({ ...filters, staffId })}>
          <SelectTrigger size="sm" className="w-[11rem]" aria-label="Filter by staff member">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fullName}
                {!s.isActive && ' (inactive)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.serviceId} onValueChange={(serviceId) => onFiltersChange({ ...filters, serviceId })}>
          <SelectTrigger size="sm" className="w-[13rem]" aria-label="Filter by service">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {!s.isActive && ' (inactive)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 pl-1">
          <Switch
            id="calendar-show-cancelled"
            size="sm"
            checked={filters.showCancelled}
            onCheckedChange={(showCancelled) => onFiltersChange({ ...filters, showCancelled })}
          />
          <Label htmlFor="calendar-show-cancelled" className="text-xs font-normal text-muted-foreground">
            Show cancelled
          </Label>
        </div>
      </div>
    </div>
  )
}
