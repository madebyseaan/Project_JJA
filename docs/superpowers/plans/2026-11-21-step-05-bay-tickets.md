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

- [x] `supabase/migrations/20261121130000_bay_tickets.sql`: tickets, ticket_items, ticket_labor, counters, views, RLS, realtime.
- [x] RPCs: create_ticket, add/set/remove item, add/remove labor, verify item/all, update status.
- [x] `tests/db/tickets.test.ts`: reservation, merge, insufficient stock, verification, status transitions, permissions, direct-write denial.
- [x] CI database job validates the SQL.

### Task 2 — Bay API and realtime

- [x] `src/features/bay/types.ts`, `api.ts`, `schemas.ts`, hooks.
- [x] `useTickets`, `useTicket`, mutations with cache invalidation.
- [x] Realtime subscription on `tickets`, `ticket_items`, `ticket_labor`; 60s poll fallback.
- [x] Unit tests for schemas, status transitions, money formatting in the queue.

### Task 3 — Bay queue

- [x] `BayPage` queue with search, status, totals, age, empty/loading/error.
- [x] New ticket sheet: customer, bike, type, notes, parts with quantities, labor lines.
- [x] Owner and mechanic both work the bay.
- [x] Offline disables writes.

### Task 4 — Ticket detail

- [x] Route `/bay/ticket/:id`.
- [x] Header with ticket no, status, customer/bike, created time.
- [x] Parts table with add, quantity, remove, verify, verified-at.
- [x] Labor list with add/remove.
- [x] Status actions with allowed transitions.
- [x] Sticky total/balance bar on mobile.
- [x] Cancel stays in Step 06 with payments.
- [x] Loading, empty, error, offline states.

### Task 5 — Docs and verification

- [x] Update roadmap Step 05.
- [x] `npm run check`; CI database job.
- [x] Commit and PR.

## Gate

`npm run check` green, CI database job green, ticket flow works for both roles.
