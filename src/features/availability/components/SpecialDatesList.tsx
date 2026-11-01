import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarOff, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, LoadingState } from '@/components/feedback/states'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Panel, PanelHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { blockedDatesRepository } from '@/database/repositories/availabilityRepository'
import { staffRepository } from '@/database/repositories/staffRepository'
import { cn } from '@/lib/utils'
import { deleteBlockedDate } from '@/services/availability/availabilityService'
import { errorMessage } from '@/services/errors'
import type { BlockedDate, ID, ISODate } from '@/types/models'
import { describeDates, describeTimes, KIND_LABELS, KIND_STYLES } from '../lib'
import { SpecialDateDialog } from './SpecialDateDialog'

/**
 * Holidays, closures, special hours and staff time off. With `staffId` it shows (and creates)
 * only that staff member's records.
 */
export function SpecialDatesList({
  today,
  staffId,
  title = 'Special dates',
  description = 'Holidays, closures, special opening hours and staff time off.',
}: {
  today: ISODate
  staffId?: ID
  title?: string
  description?: string
}) {
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming')
  const [editing, setEditing] = useState<BlockedDate | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<BlockedDate | null>(null)

  const blocks = useLiveQuery(() => blockedDatesRepository.list(), [])
  const staff = useLiveQuery(() => staffRepository.list(), [])
  const staffNames = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s.fullName])), [staff])

  const visible = useMemo(() => {
    if (!blocks) return []
    const mine = staffId ? blocks.filter((b) => b.scope === 'staff' && b.staffId === staffId) : blocks
    const filtered = mine.filter((b) => (when === 'upcoming' ? (b.endDate || b.date) >= today : (b.endDate || b.date) < today))
    return when === 'upcoming' ? filtered : [...filtered].reverse()
  }, [blocks, staffId, when, today])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  return (
    <Panel>
      <PanelHeader
        title={title}
        description={description}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus /> {staffId ? 'Add time off' : 'Add date'}
          </Button>
        }
      />
      <div className="border-b px-4 py-2">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={when}
          onValueChange={(v) => v && setWhen(v as 'upcoming' | 'past')}
          aria-label="Show upcoming or past dates"
        >
          <ToggleGroupItem value="upcoming" className="data-[state=on]:border-primary/40 data-[state=on]:bg-brand-soft data-[state=on]:text-primary">Upcoming</ToggleGroupItem>
          <ToggleGroupItem value="past" className="data-[state=on]:border-primary/40 data-[state=on]:bg-brand-soft data-[state=on]:text-primary">Past</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {!blocks ? (
        <LoadingState />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title={when === 'upcoming' ? 'Nothing scheduled' : 'No past dates'}
          description={
            when === 'upcoming'
              ? staffId
                ? 'Add leave or blocked times and this staff member won’t be offered for those slots.'
                : 'Add holidays, closures or special opening hours. They override the weekly hours on those dates.'
              : 'Special dates that have ended appear here.'
          }
        />
      ) : (
        <ul className="divide-y">
          {visible.map((b) => (
            <li key={b.id} className="flex items-start gap-3 px-4 py-3">
              <span className={cn('mt-0.5 hidden h-5.5 w-24 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-medium sm:inline-flex', KIND_STYLES[b.kind])}>
                {KIND_LABELS[b.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  <span className={cn('mr-1.5 inline-flex h-5 items-center rounded px-1 align-[1px] text-[11px] font-medium sm:hidden', KIND_STYLES[b.kind])}>{KIND_LABELS[b.kind]}</span>
                  {b.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {describeDates(b)} · {describeTimes(b)}
                  {!staffId && <> · {b.scope === 'business' ? 'Whole business' : (staffNames.get(b.staffId ?? '') ?? 'Removed staff member')}</>}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${b.label}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(b)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(b)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <SpecialDateDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} fixedStaffId={staffId} defaultDate={today} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this special date?"
        description={deleting ? `“${deleting.label}” (${describeDates(deleting)}) will be removed and normal hours apply again.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return
          try {
            await deleteBlockedDate(deleting.id)
            toast.success('Special date deleted.')
          } catch (error) {
            toast.error(errorMessage(error))
            throw error
          }
        }}
      />
    </Panel>
  )
}
