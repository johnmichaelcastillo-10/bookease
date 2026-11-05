# BookEase features

Everything listed here is implemented and covered by tests unless noted. All data is stored
in the browser (IndexedDB); see [Known limitations](#known-limitations).

## First launch

- Choose **sample data** (BrightSpace Services: 6 services, one inactive; 4 staff with
  different schedules; 28 customers; a few hundred appointments from 45 days ago to 3 weeks
  ahead, in every status; a holiday, an early-close day, staff leave and a training block) or
  an **empty business**.
- Sample records are tagged and can be removed later without touching your own records.
- Seeding never runs twice and never overwrites existing settings or hours.

## Admin workspace (`/admin`)

### Dashboard
- Range filter: today, this week, this month, this year, last 30 days, custom.
- KPIs: appointments in range, today's appointments, pending, confirmed, completed, cancelled
  (with no-shows), total customers, estimated revenue (completed + projected, shown split).
- Charts: appointment trend by outcome, status distribution, popular services, revenue trend
  (completed vs projected). Each chart has a table view.
- Upcoming appointments (next 8) and a "Needs attention" panel (pending appointments starting
  within 48 hours, past appointments still open).

### Appointments
- List with search (reference, customer name/email/phone, service, staff), filters (date range,
  status, service, staff), sorting, pagination, phone card layout; filters kept in the URL.
- Export the filtered rows as CSV or JSON.
- Details panel: snapshot of contact, service, staff, time, price, notes, status history,
  cancellation reason; actions available for the current status only.
- Create / edit: customer search with inline "new customer", active services, eligible staff,
  date picker, live free-slot picker, customer and internal notes.
- Reschedule: new date, staff and time using the appointment's own duration and buffer.

### Calendar
- Day (one column per staff member), week, month and agenda views; today, previous, next.
- Staff and service filters, show/hide cancelled; view and date kept in the URL.
- Closed days, holidays (labelled), breaks and staff off-hours shaded; "now" line.
- Click an appointment to open it; click an open future time to book it there.
- Rescheduling is done from the details panel (no drag and drop).

### Availability
- Weekly business hours: open/closed per day, multiple working intervals, breaks, "copy Monday
  to weekdays".
- Special dates: holidays, closures, special opening hours, staff leave and unavailable periods;
  single days or ranges; all-day or time ranges.

### Services
- Create, edit, view, activate/deactivate, delete (only when no appointment uses the service).
- Fields: name, description, category, duration, buffer, price, staff mode, active.
- Staff mode: **any staff** (every active staff member can perform it) or **assigned staff**
  (only staff who list the service).
- Configurable categories (create, rename, delete when unused).

### Staff
- Create, edit, activate/deactivate, assign services, calendar colour.
- Working hours: follow business hours or a custom weekly schedule with breaks.
- Leave and unavailable dates per staff member; profile with upcoming and past appointments.

### Customers
- Create, edit, delete (only without appointments), search and filters (has upcoming, new this
  month, no appointments).
- Duplicate-email protection with an explicit "create a separate record anyway" option.
- Profile: contact details, totals (bookings, completed, cancelled, no-shows, upcoming,
  completed revenue), appointment history, recent activity.

### Reports
- Appointments: by status, service, staff; daily/weekly/monthly volume.
- Revenue: completed (realized), projected, lost (cancelled + no-show value, not revenue); by
  service, staff and month.
- Customers: total, new, first-time vs returning, active, visits per customer, frequency
  buckets, top customers.
- CSV and JSON export per tab, and a print layout.

### Notifications and activity log
- Notification bell and page: new bookings, confirmations, cancellations, reschedules,
  completions, no-shows, "starting within 24 hours" reminders and a "past appointments need an
  outcome" alert. Generated locally, deduplicated.
- Activity log of every change to appointments, services, staff, customers, availability,
  settings and data, filterable by area.

### Settings
- General: business name, description, contact details, address, currency, timezone, logo.
- Booking rules: minimum notice, maximum advance days, slot interval, cancellation notice,
  customer cancellation on/off, staff selection on/off, default status for new bookings.
- Appearance: light, dark or system theme; sidebar collapsed; rows per page.
- Data: storage usage and persistence, JSON backup, validated import, load/clear sample data,
  reset (type RESET to confirm).

## Customer booking portal

```
/book              business details, opening hours, services
/book/service      1. choose a service
/book/staff        2. choose a staff member or "any available" (skipped if turned off)
/book/date-time    3–4. pick a day (days without times are disabled) and a time
/book/details      5. name, email, phone, notes
/book/review       6. summary   7. confirm
/book/confirmation reference, details, print, .ics and .txt download
/booking-lookup    find a booking by reference + email, cancel it
```

- Progress survives a refresh (sessionStorage) but not closing the tab.
- On confirm, availability is recalculated and the slot re-checked in the same transaction as
  the save; if it was just taken, the customer is sent back to pick another time.
- "Any available" assigns the free eligible staff member with the fewest appointments that day.
- The confirmation states plainly that nothing was emailed and the booking lives in this
  browser.

## Business rules

| Area | Rule |
| --- | --- |
| Conflicts | Same staff, same date, blocking status, and `newStart < existingEnd + buffer && newEnd + newBuffer > existingStart` (half-open). |
| Blocking statuses | Pending, confirmed, completed, no-show. Cancelled releases the slot. |
| Buffer | Applies after an appointment. The service itself must fit inside working hours; the buffer may run past closing. |
| Duplicates | A customer can't hold two overlapping blocking appointments (any staff). |
| Transitions | Pending → confirmed / cancelled. Confirmed → completed / cancelled / no-show. Completed, cancelled and no-show are final. Completed and no-show only after the start time. |
| Editing | Notes editable in any status; customer, service, staff, date and time only while pending or confirmed. |
| Customers' window | Not in the past, at least the minimum notice ahead, at most the maximum advance days ahead, on the slot grid. |
| Admin window | Not in the past; may book off-grid times (e.g. 10:05) and inside the notice period. |
| Eligibility | Active staff only; assigned-only services need the staff member to list the service. Inactive services can't be booked. |
| Snapshots | Appointments keep customer contact, service name, duration, buffer, price and staff name as booked. |
| Revenue | Realized = completed. Projected = pending + confirmed. Cancelled and no-show are excluded. |
| Customer cancellation | Only when enabled, the booking is pending/confirmed, and the start is at least the notice period away. |
| Deletion | Services and customers can be deleted only when no appointment references them; deactivate instead. |

## Known limitations

- Data is local to one browser profile; nothing syncs between devices or users.
- No protection against simultaneous bookings from different devices.
- No accounts or authentication.
- No email, SMS or push notifications; customers get a printable confirmation and calendar file.
- Booking lookup only works in the browser where the booking was made.
- One business timezone; DST transition hours are not special-cased.
- Calendar rescheduling uses a dialog, not drag and drop.
