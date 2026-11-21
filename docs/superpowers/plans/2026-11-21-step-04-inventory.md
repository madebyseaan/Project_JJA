# Step 04 — Inventory and Stock Implementation Plan

> **For agentic workers:** Execute inline. Steps use checkbox syntax. The architect delegated approval on 21 Nov 2026 and asked for autonomous completion, so this plan proceeds without a review pause.

**Goal:** A real parts catalog: add, edit, restock, adjust, low-stock alerts, and a full stock ledger.

**Spec:** `docs/spec.md` §6.8, §10.3, §10.9, §10.10, §10.12, §11, §12.1, §12.6, §13.3; `docs/design.md` §4–§8; `docs/roadmap.md` Step 04.

## Global Constraints

- Owner writes, staff reads, anon denied.
- No direct table writes; RPCs own the writes.
- Every stock change writes `stock_movements` in the same transaction.
- Prices and stock are integer centavos/integers; the DB validates.
- Writes disabled while offline.
- `npm run check` green; database tests added (run in CI because Docker is unavailable locally).
- No file over 1,000 lines.

## Tasks

### Task 1 — Database schema and RPCs

- [x] Create `supabase/migrations/20261121120000_inventory.sql`:
  - `public.parts`, `public.stock_movements`, `public.audit_events`, `public.shop_settings`.
  - RLS: staff read parts/settings; owner reads ledger/audit; no write grants.
  - `private.require_staff()`, `private.require_owner()`.
  - `create_part`, `update_part`, `adjust_stock` with audit rows.
- [x] Extend `tests/setup/db.ts` with staff sign-in helpers.
- [x] Add `tests/db/inventory.test.ts`: owner CRUD, ledger rows, mechanic denied, anon denied, no direct writes, stock floor.
- [x] Verify: `npm run test:db` in CI (local Docker unavailable).

### Task 2 — Money and date libraries

- [x] `src/lib/money.ts`: parse peso strings to centavos without floats, format centavos, parse/format signed amounts.
- [x] `src/lib/dates.ts`: Manila business date, date/time display, relative age.
- [x] Unit tests for parsing, formatting, invalid input, Manila boundaries.

### Task 3 — Inventory API and queries

- [x] `src/features/inventory/types.ts`, `api.ts`, `hooks/use-parts.ts`, `schemas.ts`.
- [x] Reads use explicit columns; writes call RPCs.
- [x] Query keys and invalidation for parts, ledger, low stock.
- [x] Server-state provider: add TanStack Query to `src/app/providers.tsx`.

### Task 4 — Inventory screen

- [x] `src/features/inventory/components/PartsTable.tsx` (TanStack Table, search, category/active/low-stock filters).
- [x] `PartFormSheet.tsx` (create/edit, RHF + zod, owner only).
- [x] `StockAdjustDialog.tsx` (restock/adjust, reason, note, owner only).
- [x] `StockLedgerSheet.tsx` (owner-only movement history for a part).
- [x] Route `src/routes/StockPage.tsx` composes the screen with loading, empty, error, and offline-disabled states.
- [x] Unit tests for filters/table and form schema; component tests for read-only mechanic.

### Task 5 — Docs and verification

- [x] Update `docs/roadmap.md` Step 04 status.
- [x] `npm run check`.
- [x] Commit and open PR; CI database job is the SQL verification.

## Gate

Step 04 is complete when `npm run check` passes, the CI database job passes, and the inventory flow works for owner and mechanic.
