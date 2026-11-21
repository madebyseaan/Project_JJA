# Step 05 — Bay Tickets Implementation Plan

> Execute inline. The architect delegated approval on 21 Nov 2026.

**Goal:** The daily workflow: a walk-in ticket, parts and labor, stock reservation, verification, statuses, live updates.

**Spec:** `docs/spec.md` §6.1, §6.2, §10.4–§10.6, §11, §12.1, §12.3; `docs/design.md` §4; `docs/roadmap.md` Step 05.

## Global Constraints

- Staff write; anon has no access; no direct table writes.
- The database reserves stock on add and releases it on remove/cancel.
- Every change recalculates totals and writes an audit row.
- No optimistic updates for stock.
- Works at 360px; sticky summary; 48px targets.
- `npm run check` green; DB tests run in CI.

## Tasks

### Task 1 — Database schema and RPCs

- [ ] `supabase/migrations/20261121130000_bay_tickets.sql`: tickets, ticket_items, ticket_labor, counters, views, RLS, realtime.
- [ ] RPCs: create_ticket, add/set/remove item, add/remove labor, verify item/all, update status.
- [ ] `tests/db/tickets.test.ts`: reservation, merge, insufficient stock, verification, status transitions, permissions, direct-write denial.
- [ ] CI database job validates the SQL.

### Task 2 — Bay API and realtime

- [ ] `src/features/bay/types.ts`, `api.ts`, `schemas.ts`, hooks.
- [ ] `useTickets`, `useTicket`, mutations with cache invalidation.
- [ ] Realtime subscription on `tickets`, `ticket_items`, `ticket_labor`; 60s poll fallback.
- [ ] Unit tests for schemas, status transitions, money formatting in the queue.

### Task 3 — Bay queue

- [ ] `BayPage` queue with search, status, totals, age, empty/loading/error.
- [ ] New ticket sheet: customer, bike, type, notes, parts with quantities, labor lines.
- [ ] Owner and mechanic both work the bay.
- [ ] Offline disables writes.

### Task 4 — Ticket detail

- [ ] Route `/bay/ticket/:id`.
- [ ] Header with ticket no, status, customer/bike, created time.
- [ ] Parts table with add, quantity, remove, verify, verified-at.
- [ ] Labor list with add/remove.
- [ ] Status actions with allowed transitions.
- [ ] Sticky total/balance bar on mobile.
- [ ] Cancel stays in Step 06 with payments.
- [ ] Loading, empty, error, offline states.

### Task 5 — Docs and verification

- [ ] Update roadmap Step 05.
- [ ] `npm run check`; CI database job.
- [ ] Commit and PR.

## Gate

`npm run check` green, CI database job green, ticket flow works for both roles.
