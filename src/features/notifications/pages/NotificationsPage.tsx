import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Check, CheckCheck, Info, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/feedback/states'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageHeader, Panel } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { notificationsRepository } from '@/database/repositories/eventsRepository'
import { formatRelative, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/services/errors'
import { clearNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notifications/notificationService'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import { useUiStore } from '@/store/uiStore'
import type { AppNotification } from '@/types/models'
import { NotificationIcon } from '../NotificationBell'

/** How many recent notifications the page loads; older ones remain in the store. */
const LOAD_LIMIT = 500

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const [confirmClear, setConfirmClear] = useState(false)
  const pageSize = useUiStore((s) => s.pageSize)
  const setPageSize = useUiStore((s) => s.setPageSize)
  const openDetails = useAppointmentUi((s) => s.openDetails)

  const all = useLiveQuery(() => notificationsRepository.listRecent(LOAD_LIMIT), [])
  const unreadCount = all?.filter((n) => n.read === 0).length ?? 0
  const rows = (all ?? []).filter((n) => filter === 'all' || n.read === 0)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * pageSize, current * pageSize)

  function open(n: AppNotification) {
    if (n.read === 0) void markNotificationRead(n.id)
    if (n.appointmentId) openDetails(n.appointmentId)
  }

  async function markAll() {
    try {
      await markAllNotificationsRead()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function clearAll() {
    try {
      await clearNotifications()
      toast.success('Notifications cleared.')
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Generated in this browser when bookings change or need attention. Nothing is emailed, texted or pushed."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={markAll} disabled={unreadCount === 0}>
              <CheckCheck /> Mark all read
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} disabled={!all?.length}>
              <Trash2 /> Clear all
            </Button>
          </>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(v) => {
            if (v) {
              setFilter(v as 'all' | 'unread')
              setPage(1)
            }
          }}
          aria-label="Show"
        >
          <ToggleGroupItem value="all" className="px-3">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="unread" className="px-3">
            Unread{unreadCount > 0 && <span className="ml-1 tabular text-muted-foreground">{unreadCount}</span>}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Panel>
        {!all ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={filter === 'unread' ? Check : Bell}
            title={filter === 'unread' ? 'You’re all caught up' : 'No notifications'}
            description="New bookings, confirmations, cancellations, reschedules and reminders for appointments starting within 24 hours appear here."
          />
        ) : (
          <>
            <ul className="divide-y" aria-label="Notifications">
              {visible.map((n) => (
                <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3', n.read === 0 && 'bg-brand-soft/30')}>
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
                    <NotificationIcon type={n.type} className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className="block w-full text-left"
                      aria-label={`${n.title}. ${n.message}${n.appointmentId ? ' Open appointment.' : ''}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {n.title}
                        {n.read === 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                            Unread
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm break-words text-muted-foreground">{n.message}</span>
                    </button>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {n.type === 'operational' && <Info className="size-3" aria-hidden />}
                      <time dateTime={n.createdAt} title={formatTimestamp(n.createdAt)}>
                        {formatRelative(n.createdAt)}
                      </time>
                    </span>
                  </div>
                  {n.read === 0 && (
                    <Button variant="ghost" size="icon-sm" onClick={() => markNotificationRead(n.id)} aria-label={`Mark “${n.title}” as read`}>
                      <Check />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              page={current}
              pageSize={pageSize}
              total={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s)
                setPage(1)
              }}
            />
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all notifications?"
        description="This deletes every notification in this browser. Appointments and the activity log are not affected."
        confirmLabel="Clear all"
        destructive
        onConfirm={clearAll}
      />
    </div>
  )
}
