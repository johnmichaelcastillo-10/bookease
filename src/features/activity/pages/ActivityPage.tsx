import { useLiveQuery } from 'dexie-react-hooks'
import { Briefcase, CalendarRange, Clock, Database, History, Settings, UserRound, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, TableSkeleton } from '@/components/feedback/states'
import { PageHeader, Panel } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { activityRepository } from '@/database/repositories/eventsRepository'
import { formatRelative, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import { useUiStore } from '@/store/uiStore'
import type { ActivityEntity, ActivityLog, Actor } from '@/types/models'

const ENTITY_META: Record<ActivityEntity, { label: string; icon: LucideIcon }> = {
  appointment: { label: 'Appointments', icon: CalendarRange },
  service: { label: 'Services', icon: Briefcase },
  staff: { label: 'Staff', icon: Users },
  customer: { label: 'Customers', icon: UserRound },
  availability: { label: 'Availability', icon: Clock },
  settings: { label: 'Settings', icon: Settings },
  data: { label: 'Data', icon: Database },
}

const ACTOR_STYLES: Record<Actor, string> = {
  admin: 'bg-secondary text-secondary-foreground',
  customer: 'bg-brand-soft text-primary',
  system: 'bg-muted text-muted-foreground',
}
const ACTOR_LABELS: Record<Actor, string> = { admin: 'Admin', customer: 'Customer', system: 'System' }

function ActivityRow({ entry, onOpen }: { entry: ActivityLog; onOpen?: () => void }) {
  const meta = ENTITY_META[entry.entityType]
  const Icon = meta.icon
  const body = (
    <>
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm break-words">{entry.description}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className={cn('rounded px-1.5 py-0.5 font-medium', ACTOR_STYLES[entry.actor])}>{ACTOR_LABELS[entry.actor]}</span>
          <span>{meta.label}</span>
          <span aria-hidden>·</span>
          <time dateTime={entry.createdAt} title={formatTimestamp(entry.createdAt)}>
            {formatTimestamp(entry.createdAt)} ({formatRelative(entry.createdAt)})
          </time>
        </span>
      </span>
    </>
  )
  return (
    <li>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50" aria-label={`${entry.description} Open appointment.`}>
          {body}
        </button>
      ) : (
        <div className="flex gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  )
}

/** Audit trail of every change, newest first, read from the local activityLogs store. */
export default function ActivityPage() {
  const [entityType, setEntityType] = useState<ActivityEntity | 'all'>('all')
  const [page, setPage] = useState(1)
  const pageSize = useUiStore((s) => s.pageSize)
  const setPageSize = useUiStore((s) => s.setPageSize)
  const openDetails = useAppointmentUi((s) => s.openDetails)

  const result = useLiveQuery(
    () =>
      activityRepository.page({
        entityType: entityType === 'all' ? undefined : entityType,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }),
    [entityType, page, pageSize],
  )

  return (
    <div>
      <PageHeader
        title="Activity log"
        description="Every change made in this workspace, newest first."
        actions={
          <Select
            value={entityType}
            onValueChange={(v) => {
              setEntityType(v as ActivityEntity | 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by area">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {(Object.keys(ENTITY_META) as ActivityEntity[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {ENTITY_META[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <Panel>
        {!result ? (
          <TableSkeleton />
        ) : result.total === 0 ? (
          <EmptyState
            icon={History}
            title={entityType === 'all' ? 'No activity yet' : `No ${ENTITY_META[entityType].label.toLowerCase()} activity`}
            description="Changes to appointments, services, staff, customers, availability and settings appear here."
          />
        ) : (
          <>
            <ul className="divide-y" aria-label="Activity entries">
              {result.rows.map((entry) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  onOpen={entry.entityType === 'appointment' && entry.entityId ? () => openDetails(entry.entityId!) : undefined}
                />
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={result.total}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s)
                setPage(1)
              }}
            />
          </>
        )}
      </Panel>
    </div>
  )
}
