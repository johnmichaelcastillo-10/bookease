import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, CalendarClock, CheckCheck, Info } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { notificationsRepository } from '@/database/repositories/eventsRepository'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { markAllNotificationsRead, markNotificationRead } from '@/services/notifications/notificationService'
import { useAppointmentUi } from '@/store/appointmentUiStore'
import type { AppNotification } from '@/types/models'

export function NotificationIcon({ type, className }: { type: AppNotification['type']; className?: string }) {
  const Icon = type === 'operational' ? Info : CalendarClock
  return <Icon className={cn('size-4 text-muted-foreground', className)} aria-hidden />
}

/** Header bell with unread count. Notifications are local records; nothing is sent anywhere. */
export function NotificationBell() {
  const unread = useLiveQuery(() => notificationsRepository.countUnread(), []) ?? 0
  const recent = useLiveQuery(() => notificationsRepository.listRecent(8), []) ?? []
  const openDetails = useAppointmentUi((s) => s.openDetails)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="xs" onClick={() => markAllNotificationsRead()} disabled={unread === 0}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {recent.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn('flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60', n.read === 0 && 'bg-brand-soft/40')}
                    onClick={() => {
                      void markNotificationRead(n.id)
                      if (n.appointmentId) openDetails(n.appointmentId)
                    }}
                  >
                    <NotificationIcon type={n.type} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {n.title}
                        {n.read === 0 && <span className="size-1.5 rounded-full bg-primary" aria-label="unread" />}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{n.message}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <div className="border-t px-3 py-2 text-center">
          <Link to="/admin/notifications" className="text-xs font-medium text-primary hover:underline">
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
