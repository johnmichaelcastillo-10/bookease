# Changelog

All notable changes to BookEase. Dates are in YYYY-MM-DD.

## [Unreleased]

### Added
- GitHub Actions CI: typecheck, lint, Vitest and build on every push and pull request, then the
  Playwright end-to-end suite in Chromium.

## [1.0.0] - 2026-11-01

First release.

### Added
- Scheduling engine: slot generation and single-time validation from business hours, staff
  schedules, breaks, holidays, closures, special hours, leave, duration, buffer, booking notice
  and advance window; half-open conflict rule; customer double-booking guard.
- IndexedDB database (Dexie) with 11 stores, repositories, version 2 migration and a demo seed
  generated through the scheduling engine.
- Services for appointments (create, edit, reschedule, status transitions), booking, customers,
  services and categories, staff and schedules, availability, reports, notifications, activity
  log, settings, and backup/restore with record-level validation and transactional import.
- Admin workspace: dashboard, appointments, calendar (day/week/month/agenda), availability,
  services, staff, customers, reports, activity log, notifications, settings.
- Customer portal: six-step booking flow, confirmation with print/.ics/.txt, booking lookup and
  cancellation.
- Light, dark and system themes applied before first paint.
- Docker development environment and production preview target.
- Vercel configuration with SPA fallback, asset caching and a strict Content-Security-Policy.
- Tests: Vitest unit, integration and component suites; Playwright end-to-end tests.

### Fixed during development
- Activity log test relied on timestamp order with a frozen clock; it now advances the clock.
- Component tests timed out on slower machines (Docker on Windows); timeouts raised.
- Chart colours now reuse the appointment status tokens so charts read like the badges.
- Customer cancellation message shows the business phone formatted.
