import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CalendarRange,
  Clock,
  ExternalLink,
  History,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { LoadingState } from '@/components/feedback/states'
import { BrandMark } from '@/components/shared/BrandMark'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AppointmentDialogs } from '@/features/appointments/components/AppointmentDialogs'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { useBusinessSettings } from '@/hooks/useBusiness'
import { cn } from '@/lib/utils'
import { requestPersistentStorage } from '@/services/data/backupService'
import { syncReminders } from '@/services/notifications/notificationService'
import { useUiStore } from '@/store/uiStore'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/appointments', label: 'Appointments', icon: CalendarRange },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/availability', label: 'Availability', icon: Clock },
  { to: '/admin/services', label: 'Services', icon: Briefcase },
  { to: '/admin/staff', label: 'Staff', icon: Users },
  { to: '/admin/customers', label: 'Customers', icon: UserRound },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/activity', label: 'Activity Log', icon: History },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 py-3">
      <ul className="space-y-0.5">
        {ADMIN_NAV.map((item) => {
          const link = (
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />}
                  <item.icon className={cn('size-4 shrink-0', isActive ? 'text-sidebar-primary' : 'text-muted-foreground')} aria-hidden />
                  <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                </>
              )}
            </NavLink>
          )
          return (
            <li key={item.to}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const settings = useBusinessSettings()
  return (
    <Link to="/admin" className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b px-3', collapsed && 'justify-center px-0')}>
      <BrandMark logo={settings?.logoDataUrl} name={settings?.name} />
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{settings?.name ?? 'BookEase'}</span>
          <span className="block text-[11px] text-muted-foreground">BookEase admin</span>
        </span>
      )}
    </Link>
  )
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn('border-t p-3', collapsed && 'px-2')}>
      <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          <UserRound className="size-4" />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-sm font-medium">Local administrator</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">No login · data stays in this browser</span>
          </span>
        )}
      </div>
    </div>
  )
}

export function AdminLayout() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Local reminders while the admin is open, and a one-time request to keep data from eviction.
  useEffect(() => {
    const run = () => void syncReminders().catch((e) => console.error(e))
    run()
    void requestPersistentStorage()
    const id = window.setInterval(run, 5 * 60_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-svh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>

      <aside
        className={cn(
          'no-print sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 md:flex',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
        <SidebarFooter collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Admin sections</SheetDescription>
          <SidebarBrand collapsed={false} />
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          <SidebarFooter collapsed={false} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link to="/book">
              <ExternalLink /> Booking page
            </Link>
          </Button>
          <NotificationBell />
          <ThemeToggle />
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <AppointmentDialogs />
    </div>
  )
}
