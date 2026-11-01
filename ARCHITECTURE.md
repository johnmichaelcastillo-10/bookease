# BookEase architecture

BookEase is a static single-page application. Everything (rendering, routing, validation,
scheduling, persistence, reporting) runs in the browser. There is no server, no API and no
network request after the static files load. This document describes how the pieces fit and
why they were built this way.

- [1. Overview](#1-overview)
- [2. Folder structure](#2-folder-structure)
- [3. Data model and IndexedDB schema](#3-data-model-and-indexeddb-schema)
- [4. Time handling](#4-time-handling)
- [5. Scheduling engine](#5-scheduling-engine)
- [6. Appointment lifecycle](#6-appointment-lifecycle)
- [7. Booking workflow](#7-booking-workflow)
- [8. Reports and revenue definitions](#8-reports-and-revenue-definitions)
- [9. Notifications and activity log](#9-notifications-and-activity-log)
- [10. Browser storage strategy](#10-browser-storage-strategy)
- [11. UI design system](#11-ui-design-system)
- [12. Testing strategy](#12-testing-strategy)
- [13. Docker](#13-docker)
- [14. Vercel](#14-vercel)
- [15. Risks and limitations](#15-risks-and-limitations)

## 1. Overview

```
 ┌──────────────────────────── Browser ─────────────────────────────┐
 │                                                                  │
 │  Pages & components (React, React Router, React Hook Form + Zod) │
 │        │ read: useLiveQuery(repo query)      │ write: service call │
 │        ▼                                     ▼                    │
 │  Repositories (src/database/repositories)   Services (src/services)│
 │        │                                     │  validate → engine │
 │        │                                     │  → transaction     │
 │        ▼                                     ▼                    │
 │              Dexie  ──►  IndexedDB  (bookease database)            │
 │                                                                  │
 │  Zustand: UI preferences (localStorage), booking draft (session) │
 └──────────────────────────────────────────────────────────────────┘
        ▲ static files only (HTML, JS, CSS, fonts)
   Vercel CDN  /  Vite dev server in Docker
```

Layers and the rule for each:

| Layer | Location | Rule |
| --- | --- | --- |
| Types | `src/types` | One source of truth for every record shape. |
| Validation | `src/validation` | Zod schemas shared by forms, services and backup import. |
| Pure domain logic | `src/services/*/engine`, `src/lib/time.ts` | No I/O. Deterministic: `now` is a parameter. Unit tested. |
| Repositories | `src/database/repositories` | The only code that touches Dexie tables. |
| Services | `src/services` | Business operations. Re-validate every input, run the engine, write in one transaction, log activity, raise notifications. |
| Feature UI | `src/features/<module>` | Reads through repository hooks, writes through services. Never calls Dexie. |

Writes never trust the form: a booking that passed form validation is validated again in
the service, and availability is recomputed inside the same IndexedDB transaction that saves
it.

## 2. Folder structure

```
bookease/
├── public/                      favicon, theme-init.js (pre-paint theme), robots.txt
├── src/
│   ├── app/
│   │   ├── router/              route table (lazy routes), route error element
│   │   ├── providers/           theme, tooltip, toaster, app bootstrap (DB open + onboarding)
│   │   └── layouts/             RootLayout, AdminLayout (sidebar/header), PortalLayout
│   ├── components/
│   │   ├── ui/                  shadcn/ui primitives (button, dialog, select, ...)
│   │   ├── shared/              DataTable, Pagination, SearchInput, StatusBadge, ConfirmDialog,
│   │   │                        DatePicker, TimeSlotPicker, PageHeader, StatCard, ...
│   │   └── feedback/            LoadingState, EmptyState, ErrorState, ErrorBoundary
│   ├── features/
│   │   ├── dashboard/  appointments/  calendar/  services/  staff/  customers/
│   │   ├── availability/  booking/  reports/  notifications/  activity/  settings/
│   │   └── onboarding/          first-launch demo/empty choice
│   ├── database/
│   │   ├── db.ts                Dexie instance and typed tables
│   │   ├── schema.ts            store definitions per version
│   │   ├── migrations/          upgrade functions (v1 → v2 ...)
│   │   ├── repositories/        one module per store
│   │   └── seed/                demo data generator (BrightSpace Services)
│   ├── services/                appointment, availability, booking, customer, catalog, staff,
│   │                            report, notification, activity, settings, backup
│   ├── validation/              Zod schemas
│   ├── store/                   Zustand stores
│   ├── hooks/                   useBusinessSettings, useNow, useMediaQuery, ...
│   ├── lib/                     time, money, csv, download, ids, format, utils
│   ├── types/                   models.ts
│   ├── index.css                Tailwind v4 theme tokens
│   ├── App.tsx  main.tsx
├── tests/
│   ├── unit/  integration/  component/  e2e/
├── Dockerfile  docker-compose.yml  .dockerignore  vercel.json
└── README.md  ARCHITECTURE.md  FEATURES.md  DEPLOYMENT.md  CHANGELOG.md  PROJECT_PROGRESS.md
```

## 3. Data model and IndexedDB schema

Conventions:

- IDs are `crypto.randomUUID()` strings. Booking references are separate, human-readable
  codes (`BE-7K4M9Q`: 6 characters from an alphabet without 0/O/1/I/L), unique-indexed.
- Money is stored in **minor units** (integer cents) so totals never accumulate float error.
- `ISODate` is a date-only string `YYYY-MM-DD` in the business's wall-clock calendar.
  `TimeHM` is `HH:mm` wall-clock time. `Timestamp` is an ISO-8601 UTC instant
  (`2026-11-01T08:30:00.000Z`) used only for "when did this happen" fields.
- Every seeded record carries `source: 'demo'`; records created by the user carry
  `source: 'user'`. "Clear sample data" deletes only `demo` records.

Stores (Dexie schema strings; first entry is the primary key):

| Store | Key and indexes | Holds |
| --- | --- | --- |
| `services` | `id, categoryId, isActive, name, source` | Offered services |
| `serviceCategories` | `id, name` | Configurable categories |
| `staff` | `id, isActive, fullName, *serviceIds, source` | Providers (multi-entry index on services) |
| `customers` | `id, normalizedEmail, fullName, phone, createdAt, source` | CRM records |
| `appointments` | `id, &reference, customerId, serviceId, staffId, date, status, customerEmail, createdAt, source, [staffId+date], [date+status]` | Bookings with snapshots |
| `businessHours` | `weekday` | Seven rows, one per weekday |
| `staffSchedules` | `staffId` | Weekly hours per staff member |
| `blockedDates` | `id, date, staffId, scope, kind` | Holidays, closures, special hours, leave |
| `notifications` | `id, createdAt, read, &dedupeKey` | Local notification center |
| `activityLogs` | `id, createdAt, entityType, entityId` | Audit trail |
| `settings` | `key` | `business` (settings) and `app` (onboarding/demo state) |

TypeScript interfaces (abridged; full definitions in `src/types/models.ts`):

```ts
type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'

interface TimeRange { start: TimeHM; end: TimeHM }            // half-open [start, end)
interface DaySchedule { isOpen: boolean; intervals: TimeRange[]; breaks: TimeRange[] }

interface Service {
  id: ID; name: string; description: string; categoryId: ID
  durationMinutes: number; bufferMinutes: number; priceCents: number
  isActive: boolean; staffMode: 'any' | 'assigned'
  source: RecordSource; createdAt: Timestamp; updatedAt: Timestamp
}

interface Staff {
  id: ID; fullName: string; email: string; phone: string; position: string
  description: string; serviceIds: ID[]; isActive: boolean; color: string
  source: RecordSource; createdAt: Timestamp; updatedAt: Timestamp
}

interface StaffSchedule { staffId: ID; mode: 'business-hours' | 'custom'; days: WeeklySchedule }

interface BlockedDate {
  id: ID; scope: 'business' | 'staff'; staffId: ID | null
  kind: 'holiday' | 'closure' | 'special-hours' | 'leave' | 'unavailable'
  date: ISODate; endDate: ISODate              // inclusive range; equal for one day
  allDay: boolean; ranges: TimeRange[]         // blocked ranges, or open ranges for special-hours
  label: string; source: RecordSource; createdAt: Timestamp
}

interface Customer {
  id: ID; fullName: string; email: string; normalizedEmail: string; phone: string
  address: string; notes: string; lastAppointmentDate: ISODate | null
  source: RecordSource; createdAt: Timestamp; updatedAt: Timestamp
}

interface Appointment {
  id: ID; reference: string
  customerId: ID; customerName: string; customerEmail: string; customerPhone: string
  serviceId: ID; serviceName: string; staffId: ID; staffName: string
  date: ISODate; startTime: TimeHM; endTime: TimeHM
  durationMinutes: number; bufferMinutes: number; priceCents: number
  status: AppointmentStatus; statusHistory: { status: AppointmentStatus; at: Timestamp }[]
  customerNotes: string; internalNotes: string; channel: 'admin' | 'portal'
  createdAt: Timestamp; updatedAt: Timestamp; cancelledAt: Timestamp | null
  cancelledBy: 'admin' | 'customer' | null; cancellationReason: string
  source: RecordSource
}
```

**Snapshots.** An appointment copies the customer's name/email/phone, the service's name,
duration, buffer and price, and the staff member's name at booking time. Editing or
deactivating a service, staff member or customer later never rewrites history. Changing the
service *on* an appointment (an explicit edit) takes a fresh snapshot.

**Versioning and migrations.** `schema.ts` declares each Dexie version. Version 1 is the
original layout; version 2 adds the `[staffId+date]` and `[date+status]` compound indexes
and back-fills `customers.normalizedEmail` in an `upgrade()` callback. Dexie runs upgrades
inside a versionchange transaction, so a failed upgrade leaves the old database untouched.
Tests open a real v1 database (fake-indexeddb), then the app database, and assert the data
was migrated.

## 4. Time handling

BookEase schedules in **wall-clock time of the business timezone** (Settings → General →
Timezone, default: the browser's zone).

- Appointment dates and times are stored as plain strings (`date`, `startTime`, `endTime`),
  never as instants. 10:00 stays 10:00 whatever timezone the browser is in.
- Calendar arithmetic on dates uses UTC-based helpers (`Date.UTC`), which have no DST, so
  "add one day" always moves exactly one calendar day; no day is assumed to be 24 hours.
- Times are compared as minutes since midnight within one date. Appointments cannot span
  midnight.
- "Now" in the business timezone comes from `Intl.DateTimeFormat(...).formatToParts()`,
  giving a `{ date, minutes }` pair. Past-slot and booking-window checks compare against it.
- Audit timestamps (`createdAt`, `cancelledAt`, ...) are UTC instants, shown in local time.
- **DST.** On a transition day the wall-clock hour that does not exist (spring forward) or
  repeats (fall back) is treated as an ordinary hour. Business hours rarely include 02:00, so
  this is documented rather than special-cased.

## 5. Scheduling engine

Pure functions in `src/services/availability/engine.ts`; `availabilityService` loads the
inputs from IndexedDB and calls them.

### Buffer policy

Buffer time applies **after** an appointment (clean-up / turnover). An appointment occupies
`[start, end + buffer)` for its staff member. The service itself (`[start, end)`) must fit
inside working hours; its trailing buffer may run past closing time. The buffer is
snapshotted onto the appointment, so later changes to the service don't move existing
blocks.

### Conflict rule

```ts
checkAppointmentConflict(proposed, existing[]) // → first conflicting appointment or null

blocks(a)   = a.status ∈ { pending, confirmed, completed, no-show }   // cancelled releases
conflicts   = same staffId && same date && blocks(existing) && existing.id ≠ proposed.id
           && proposed.start < existing.end + existing.buffer
           && proposed.end + proposed.buffer > existing.start
```

Intervals are half-open, so an appointment may start exactly when the previous one's buffer
ends. Different staff members never conflict with each other.

A second rule prevents duplicate bookings: the same customer cannot hold two blocking
appointments that overlap in time (any staff), and cannot book the same service at the same
date and time twice.

### Slot generation

```
generateAvailableSlots(input) → { slots: Slot[], reason?: UnavailableReason }

1. Window       date < today                        → reason 'past'
                date > today + maxAdvanceDays       → reason 'outside-window'
2. Business day businessHours[weekday] (or special-hours override for that date)
                minus breaks, minus business 'unavailable' ranges
                all-day business closure/holiday    → reason 'closed'
3. Per staff    staff schedule (custom or inherited business hours, or staff special-hours)
                ∩ business day, minus staff breaks, minus leave/unavailable ranges
4. Candidates   for each open interval, starts aligned to the slot interval
                (e.g. :00 :15 :30 :45) where start + duration ≤ interval end
5. Filters      start ≥ now + minNotice (today only, in business wall-clock)
                no conflict with that staff member's blocking appointments
6. Merge        group candidates by start time → Slot { start, end, staffIds[] }
```

Eligible staff: active, and either the service is `staffMode: 'any'` (any active staff
member may perform it) or the staff member has the service in `serviceIds`
(`staffMode: 'assigned'`). When the customer chooses "any available", the slot's
`staffIds` are resolved at confirmation time to the eligible member with the fewest
appointments that day (ties broken by name), recomputed inside the save transaction.

`validateAppointmentTime()` runs steps 1–5 for a single proposed start time (alignment not
required, so an administrator can book 10:05) and returns a typed reason when it fails.
Administrators bypass the minimum-notice and maximum-advance rules but never past dates or
availability.

## 6. Appointment lifecycle

```
            ┌──────────► cancelled
            │                ▲
 pending ───┴─► confirmed ───┼──► completed
                             └──► no-show
```

| From | Allowed to | Extra rule |
| --- | --- | --- |
| pending | confirmed, cancelled | |
| confirmed | completed, cancelled, no-show | completed / no-show only once the start time has passed |
| completed, cancelled, no-show | none (terminal) | |

`canTransition(from, to)` and `assertTransition()` live in `src/services/appointments/status.ts`.
Every change appends to `statusHistory`, writes an activity log entry and a notification.
Rescheduling is allowed for pending and confirmed appointments and keeps the status. Cancel,
no-show and complete ask for confirmation in the UI.

## 7. Booking workflow

```
/book                 welcome: business details, how it works, local-data notice
/book/service         1. pick an active service
/book/staff           2. pick a staff member or "Any available" (skipped if staff selection is off)
/book/date-time       3–4. date picker (closed/past/out-of-window days disabled) + slot grid
/book/details         5. name, email, phone, notes (React Hook Form + Zod)
/book/review          6. summary; 7. confirm
/book/confirmation    reference, details, print, download (.ics / .txt), book again
/booking-lookup       find by reference + email, cancel within the notice period
```

The draft lives in a Zustand store persisted to `sessionStorage`, so a refresh keeps the
progress but closing the tab discards it. Each step guards its prerequisites and redirects
back when they're missing. On confirm, `bookingService.createBooking()` re-validates the
input, finds or creates the customer by email, recomputes availability and checks conflicts
inside one `rw` transaction, then saves. If the slot was taken in the meantime (e.g. by the
admin in another tab) the customer is sent back to pick another time.

Nothing is emailed or texted; the confirmation page says so and offers download/print.

## 8. Reports and revenue definitions

| Figure | Definition |
| --- | --- |
| Completed revenue (realized) | Sum of `priceCents` of **completed** appointments |
| Projected revenue | Sum of `priceCents` of **pending + confirmed** appointments |
| Estimated revenue (dashboard) | Completed + projected, shown with the split |
| Excluded | Cancelled and no-show appointments contribute zero |
| New customers | Customers whose record was created in the period |
| Returning customers | Customers with an appointment in the period who also had an earlier non-cancelled appointment |

Reports filter by appointment date and are computed by pure functions in
`src/services/reports/` from records read out of IndexedDB. Exports: CSV, JSON, print.

## 9. Notifications and activity log

Services emit both inside the same transaction as the change they describe.

- **Notifications** (bell in the header): appointment created, confirmed, cancelled,
  rescheduled, completed, no-show; "starting within 24 hours" reminders and a "past
  appointments still open" alert generated locally when the admin is open (deduplicated with a
  unique `dedupeKey`). No email, SMS, push or network request is ever sent.
- **Activity log**: every create/update/status change for appointments, services, staff,
  customers, availability, settings and data operations (import, reset, clear demo).

## 10. Browser storage strategy

| Data | Where | Why |
| --- | --- | --- |
| Business records | IndexedDB via Dexie | Structured, indexed, transactional, large quota |
| Theme, sidebar collapsed, table page size | localStorage (Zustand `persist`) | Tiny, synchronous, needed before first paint |
| Booking draft | sessionStorage | Survives refresh, dies with the tab |

- On first admin visit BookEase asks the browser for persistent storage
  (`navigator.storage.persist()`) and shows usage from `navigator.storage.estimate()`.
- **Backups**: Settings → Data exports every store to one JSON file
  (`{ app, schemaVersion, exportedAt, data }`). Import parses it, validates **every record**
  with Zod, and only then replaces the database in a single transaction. Any failure aborts
  the transaction and leaves the existing data untouched.

## 11. UI design system

- **Look**: calm operations tool. Neutral cool-grey surfaces, one teal accent for primary
  actions and focus, status colours reserved for appointment state. No gradients, no glass,
  small radii (6–8 px), 1 px borders and very soft shadows only on overlays.
- **Type**: Geist (UI) and Geist Mono (booking references, times, money columns with tabular
  figures), bundled with the app; no font CDN.
- **Status colours** (always paired with an icon and a text label, never colour alone):
  pending amber, confirmed blue, completed green, cancelled grey, no-show red.
- **Themes**: light, dark, system. Tokens are CSS variables in `index.css`; `public/theme-init.js`
  applies the saved choice before first paint (no flash, CSP-friendly external script).
- **Layout**: admin sidebar (collapsible to icons on desktop, a sheet on mobile), sticky
  header with search-free breadcrumbs, notification bell and theme toggle. Tables become
  stacked cards under 768 px; the calendar switches to day/agenda on phones.
- **Components**: shadcn/ui primitives plus shared composites listed in §2, each with a
  consistent `className` + typed props API.

## 12. Testing strategy

| Level | Tooling | Covers |
| --- | --- | --- |
| Unit | Vitest | Time helpers, interval maths, conflict rule, slot generation (hours, breaks, closures, leave, notice, buffers, adjacency, cancelled release, staff pools), status transitions, revenue/report maths, validation schemas, CSV |
| Integration | Vitest + fake-indexeddb | DB open, CRUD, v1→v2 migration, seed idempotency, appointment lifecycle via services, duplicate/conflict prevention, booking + cancel releases slot, backup export/import, rollback on a bad record |
| Component | React Testing Library + user-event | Form validation messages, confirm dialogs, status actions, list search/filters, theme persistence, booking wizard steps |
| End to end | Playwright (Edge channel) against `vite preview` | Full booking in the portal and visible in admin, nested-route refresh, back/forward |

## 13. Docker

- `Dockerfile` (Node 24 Alpine): installs with `npm ci` from the lockfile and runs the Vite dev
  server on `0.0.0.0:5173`.
- `docker-compose.yml`: service `app` bind-mounts the source, keeps `node_modules` in a named
  volume (so Linux binaries don't clash with the host's), and turns on polling so edits on
  Windows/macOS hosts trigger hot reload. A `preview` service (profile `prod`) builds and
  serves the production bundle on port 4173.
- No database container: the database is in the browser.

## 14. Vercel

- Framework preset Vite, build `npm run build`, output `dist`, no environment variables.
- `vercel.json` rewrites every non-file path to `/index.html` so `/admin/calendar` or
  `/book/date-time` load on refresh, caches `/assets/*` (content-hashed) for a year as
  `immutable`, and sends security headers including a strict CSP
  (`default-src 'self'`, `connect-src 'self'`, no third-party origins).

## 15. Risks and limitations

What a browser-only app genuinely cannot do, and how BookEase handles it honestly:

| Requirement area | Limitation | What BookEase does instead |
| --- | --- | --- |
| Shared bookings | Customer and admin share data only inside one browser profile. Another device starts empty. | Stated on the landing page, portal and docs. JSON backup/restore moves data between devices manually. |
| Concurrency | No protection against two devices booking the same slot. | Within one browser, IndexedDB `rw` transactions serialize writes across tabs, and availability is recomputed inside the save transaction. |
| Customer notifications | No email/SMS without a third-party service. | Confirmation page with print and downloadable `.ics`/text; local admin notifications only. |
| Authentication | No accounts without a backend. | Admin is an open local workspace, labelled as such. No fake login. |
| Durability | Browsers may evict storage; users can clear it. | `navigator.storage.persist()`, storage usage display, backup reminders. |
| Booking lookup | Works only in the browser that made the booking. | Explained on the lookup page. |
| Timezones | One business timezone; DST transition hours not special-cased. | Documented in §4. |
