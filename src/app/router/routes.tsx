import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { AdminLayout } from '@/app/layouts/AdminLayout'
import { PortalLayout } from '@/app/layouts/PortalLayout'
import { RootLayout } from '@/app/layouts/RootLayout'
import NotFoundPage, { AdminNotFound } from '@/app/pages/NotFoundPage'
import { RouteError } from './RouteError'

/** Route-level code splitting: each page is its own chunk, loaded on first visit. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', lazy: page(() => import('@/app/pages/LandingPage')) },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, lazy: page(() => import('@/features/dashboard/pages/DashboardPage')) },
          { path: 'appointments', lazy: page(() => import('@/features/appointments/pages/AppointmentsPage')) },
          { path: 'calendar', lazy: page(() => import('@/features/calendar/pages/CalendarPage')) },
          { path: 'availability', lazy: page(() => import('@/features/availability/pages/AvailabilityPage')) },
          { path: 'services', lazy: page(() => import('@/features/services/pages/ServicesPage')) },
          { path: 'staff', lazy: page(() => import('@/features/staff/pages/StaffPage')) },
          { path: 'staff/:staffId', lazy: page(() => import('@/features/staff/pages/StaffProfilePage')) },
          { path: 'customers', lazy: page(() => import('@/features/customers/pages/CustomersPage')) },
          { path: 'customers/:customerId', lazy: page(() => import('@/features/customers/pages/CustomerProfilePage')) },
          { path: 'reports', lazy: page(() => import('@/features/reports/pages/ReportsPage')) },
          { path: 'activity', lazy: page(() => import('@/features/activity/pages/ActivityPage')) },
          { path: 'notifications', lazy: page(() => import('@/features/notifications/pages/NotificationsPage')) },
          { path: 'settings', lazy: page(() => import('@/features/settings/pages/SettingsPage')) },
          { path: '*', element: <AdminNotFound /> },
        ],
      },
      {
        element: <PortalLayout />,
        children: [
          { path: '/book', lazy: page(() => import('@/features/booking/pages/BookingHomePage')) },
          { path: '/book/service', lazy: page(() => import('@/features/booking/pages/ServiceStepPage')) },
          { path: '/book/staff', lazy: page(() => import('@/features/booking/pages/StaffStepPage')) },
          { path: '/book/date-time', lazy: page(() => import('@/features/booking/pages/DateTimeStepPage')) },
          { path: '/book/details', lazy: page(() => import('@/features/booking/pages/DetailsStepPage')) },
          { path: '/book/review', lazy: page(() => import('@/features/booking/pages/ReviewStepPage')) },
          { path: '/book/confirmation', lazy: page(() => import('@/features/booking/pages/ConfirmationPage')) },
          { path: '/booking-lookup', lazy: page(() => import('@/features/booking/pages/LookupPage')) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(routes)
}
