import { Info } from 'lucide-react'
import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { LoadingState } from '@/components/feedback/states'
import { BrandMark } from '@/components/shared/BrandMark'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { useBusinessSettings } from '@/hooks/useBusiness'
import { formatPhone } from '@/lib/contact'
import { cn } from '@/lib/utils'

/** Customer-facing layout: business header, centred content, honest local-data footer. */
export function PortalLayout() {
  const settings = useBusinessSettings()
  const location = useLocation()
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="no-print border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link to="/book" className="flex min-w-0 items-center gap-2.5">
            <BrandMark logo={settings?.logoDataUrl} name={settings?.name} />
            <span className="truncate text-sm font-semibold sm:text-base">{settings?.name ?? 'Book an appointment'}</span>
          </Link>
          <div className="flex-1" />
          <nav aria-label="Booking" className="flex items-center gap-1 text-sm">
            <NavLink
              to="/book"
              end
              className={({ isActive }) => cn('rounded-md px-2.5 py-1.5 font-medium text-muted-foreground hover:text-foreground', isActive && 'text-foreground')}
            >
              Book
            </NavLink>
            <NavLink
              to="/booking-lookup"
              className={({ isActive }) => cn('rounded-md px-2.5 py-1.5 font-medium text-muted-foreground hover:text-foreground', isActive && 'text-foreground')}
            >
              My booking
            </NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="no-print border-t bg-canvas">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <p className="flex max-w-xl gap-2">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              Bookings are saved in this browser only. They are not sent to the business, and no email or text message is sent. This
              is a BookEase demo running entirely on your device.
            </span>
          </p>
          <div className="shrink-0 sm:text-right">
            {settings?.phone && <p>{formatPhone(settings.phone)}</p>}
            {settings?.email && <p>{settings.email}</p>}
            <Link to="/admin" className="mt-1 inline-block font-medium text-foreground hover:underline">
              Admin dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
