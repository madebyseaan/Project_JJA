# Sales Log Core Implementation Plan

> **Status (22 Nov 2026):** Implemented on `feat/sales-log-core`. The database schema is split across four migrations, the sales UI and catalog import are live, unit/database/E2E suites cover the new flow, and the old inventory/bay/owner routes are retired from navigation. QuickBooks export, month lock, and reconciliation remain excluded until the morning answers.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inventory/repair-ticket app with a daily sales log: orders, items, labor splits, extras, cash/GCash payments, GCash held, reports, and optional digital receipts.

**Architecture:** Add a new `sales` feature module and database tables alongside the existing app. Reuse Supabase Auth, `StaffLayout`, the design system, PWA, and deployment. Both staff accounts have identical access. Remove the old inventory/bay/owner routes from navigation. QuickBooks export/reconciliation/month-lock are a separate follow-up after the morning account/tax/IIF decisions.

**Tech Stack:** React 19, Vite, TypeScript strict, Tailwind CSS v4, shadcn/ui, TanStack Query, React Hook Form + zod, Supabase Postgres/Auth, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-sales-log-design.md`

## Global Constraints

- No stock tracking, reservations, or inventory ledger in the new module.
- Both staff have the same access. No owner/mechanic UI split in the new module.
- Money is integer centavos; the database computes every total.
- Writes go through RPCs. No direct `insert/update/delete` from the client.
- Item name and price are snapshotted on the order.
- Orders are editable; month locking/export is **out of scope** in this plan.
- Labor: main user gets `total − helper share`; helper share cannot exceed total.
- Extras default to the main user; both users can be chosen.
- Payments support multiple rows, Cash or GCash; GCash records the recipient.
- Change supports Cash or GCash and its own recipient.
- 360px first; 48px targets; loading, empty, and error states.
- No file over 1,000 lines.
- `npm run check` and E2E must pass before deploy.
- Do not commit the private QuickBooks CSV or staff passwords.

## Review Focus

- Mixed cash/GCash payment with change: every cent assigned, no negative balance.
- Labor split with no helper, with a helper, or with helper share equal to total.
- Editing an order replaces child rows and recalculates totals without duplicates.
- Catalog import with inactive items, blank MPN, blank price, and duplicate names.
- Orders dated in the past appear in the correct daily/monthly report.

---

### Task 1: Database core, RPCs, views, RLS

**Files:**
- Create: `supabase/migrations/20261122120000_sales_log.sql`
- Create: `tests/db/sales-orders.test.ts`
- Modify: `tests/setup/db.ts` only if a helper is missing.

**Interfaces:**
- Produces tables: `catalog_items`, `sales_orders`, `sales_order_items`, `sales_labor`, `sales_extras`, `sales_payments`, `sales_changes`, `sales_gcash_allocations`, `gcash_transfers`.
- Produces functions:
  - `private.next_sales_order_no() returns text`
  - `public.save_sales_order(p_order_id uuid, p_business_date date, p_customer_name text, p_bike_model text, p_main_user_id uuid, p_helper_user_id uuid, p_items jsonb, p_labor_total_centavos integer, p_helper_labor_centavos integer, p_extras jsonb, p_payments jsonb, p_changes jsonb) returns public.sales_orders`
  - `public.get_gcash_balances() returns jsonb`
  - `public.get_sales_receipt(p_token text) returns jsonb`
- Produces views: `v_sales_daily`, `v_sales_labor_daily`, `v_sales_payments_daily`.
- Item import RPC is Task 2.

- [ ] **Step 1: Write failing database tests**

Tests:
- create an order with two items and labor; totals and snapshots are correct.
- helper split: main = total − helper; helper share > total fails.
- extra defaults only when explicitly passed; extra recipient must be main or helper.
- mixed payments + change balance exactly; change > payments fails.
- editing an order replaces items and recalculates totals.
- GCash recipient required for GCash; cash cannot have a recipient.
- staff can read; anon denied; direct writes denied.
- past-dated order appears in `v_sales_daily`.

Run: `npm run test:db -- tests/db/sales-orders.test.ts` in CI/local Docker.
Expected: FAIL because the migration/tables do not exist.

- [ ] **Step 2: Implement the migration**

Rules:
- `parts_total` = sum of item line totals.
- `total` generated = parts + labor.
- `sales_labor` sum = labor total; main row always exists.
- `extras_total` computed from extras.
- `payments_total = customer_total + extras_total + change_total` exactly.
- `sales_gcash_allocations` stores per recipient: `net_gcash`, `shop_share`, `labor_share`.
- `get_gcash_balances` returns per user: `shop_share`, `shop_transfers`, `shop_held`, `labor_share`, `labor_transfers_out`, `labor_held`, `labor_earned`.
- `get_sales_receipt` returns shop, order no/date, optional customer/bike, items, labor total, total, payment methods/amounts, no internal split.
- Views are `security_invoker = true`.
- RLS default deny; staff select only; no direct writes.
- Grants: staff execute on order/read functions; anon execute only on `get_sales_receipt`.

- [ ] **Step 3: Run database tests**

Run: `npm run test:db -- tests/db/sales-orders.test.ts` (CI if Docker unavailable).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261122120000_sales_log.sql tests/db/sales-orders.test.ts
git commit -m "feat: add sales log schema and order RPCs"
```

---

### Task 2: Catalog import

**Files:**
- Modify: `supabase/migrations/20261122120000_sales_log.sql` or add `20261122121000_catalog_import.sql`
- Create: `scripts/import-quickbooks-items.mjs`
- Create: `tests/db/catalog-import.test.ts`

**Interfaces:**
- `public.import_catalog_items(p_items jsonb) returns jsonb` with `{inserted, updated, skipped}`.
- Local script maps QuickBooks columns:
  - `Item` → name
  - `Description` → description
  - `MPN` → sku (nullable)
  - `Price` → base price centavos
  - `Type` → item type
  - `Account` → income account
  - `COGS Account` → COGS account
  - `Asset Account` → asset account
  - `Preferred Vendor` → preferred vendor
  - `Active Status` → active
- Only `Inventory Part` rows. No stock.

- [ ] **Step 1: Write failing import tests**
- [ ] **Step 2: Implement RPC and script**
- [ ] **Step 3: Test with a 3-row fixture, not the private file**
- [ ] **Step 4: Run database tests**
- [ ] **Step 5: Commit**

Later, run the real import as a one-time admin command after the app is deployed; do not commit the CSV.

---

### Task 3: Sales API, types, schemas, hooks

**Files:**
- Create: `src/features/sales/types.ts`
- Create: `src/features/sales/api.ts`
- Create: `src/features/sales/schemas.ts`
- Create: `src/features/sales/hooks/use-sales.ts`
- Create: `tests/unit/sales-schemas.test.ts`

**Interfaces:**
- Domain types: `CatalogItem`, `SalesOrder`, `SalesOrderItem`, `SalesLabor`, `SalesExtra`, `SalesPayment`, `SalesChange`, `OrderInput`.
- API: `listCatalog`, `listOrders(date)`, `getOrder(id)`, `saveOrder(input)`, `listDailyReport`, `listLaborReport`, `listPaymentsReport`, `getGcashBalances`, `recordGcashTransfer`, `getPublicReceipt`.
- Schemas: order form, item line, labor, extra, payment, change.
- Hooks with query keys `['sales','orders',date]`, `['sales','order',id]`, `['sales','report',from,to]`, `['sales','gcash']`.

- [ ] **Step 1: Write failing schema tests** (money parsing, helper share, payment balance, GCash recipient).
- [ ] **Step 2: Implement types/schemas.**
- [ ] **Step 3: Implement API mapping and hooks.**
- [ ] **Step 4: Run unit tests.**
- [ ] **Step 5: Commit.**

---

### Task 4: Orders list and daily totals

**Files:**
- Create: `src/features/sales/OrdersPage.tsx`
- Create: `src/features/sales/components/DailyTotals.tsx`
- Create: `src/features/sales/components/OrderRow.tsx`
- Create: `tests/unit/orders-page.test.tsx`

Behavior:
- Date picker defaults today; past allowed; future disabled.
- Daily totals: parts, labor, per-user labor, cash, GCash, order count.
- Full breakdown toggle reveals every order.
- New order button.
- Loading/empty/error.
- Both users see everything.

- [ ] **Step 1: Failing component test.**
- [ ] **Step 2: Implement page and components.**
- [ ] **Step 3: Run tests.**
- [ ] **Step 4: Commit.**

---

### Task 5: Order form (create/edit)

**Files:**
- Create: `src/features/sales/OrderFormPage.tsx`
- Create: `src/features/sales/components/ItemPicker.tsx`
- Create: `src/features/sales/components/OrderLines.tsx`
- Create: `src/features/sales/components/LaborEditor.tsx`
- Create: `src/features/sales/components/ExtrasEditor.tsx`
- Create: `src/features/sales/components/PaymentEditor.tsx`
- Create: `src/features/sales/components/OrderReviewDialog.tsx`
- Create: `tests/unit/order-form.test.tsx`

Behavior:
- Date, optional customer/bike.
- Item search, add, quantity, editable price, remove.
- Custom line dialog.
- Labor total, helper select, helper share, main remainder.
- Multiple extras with recipient default main.
- Multiple payments (Cash/GCash, GCash recipient).
- Multiple changes (Cash/GCash, GCash recipient).
- Live totals and balance; submit disabled until balanced.
- Review dialog (“Verify order”) before save.
- Edit mode loads order and preserves order number.
- Offline disables writes; pending disables submit.

- [ ] **Test-first steps for formulas and validation.**
- [ ] **Implement components.**
- [ ] **Run unit tests.**
- [ ] **Commit.**

---

### Task 6: Items page and import

**Files:**
- Create: `src/features/sales/ItemsPage.tsx`
- Create: `src/features/sales/components/CatalogImportDialog.tsx`
- Create: `tests/unit/items-page.test.tsx`

Behavior:
- Search by name/description/SKU.
- Show item name, description, price; no stock.
- “Import updated item list” file picker; parse CSV with papaparse; preview counts/errors; call RPC in batches.
- No permanent inline editing; per-order override only.
- Loading/empty/error.

- [ ] **Test-first search/empty state.**
- [ ] **Implement page and import.**
- [ ] **Run tests.**
- [ ] **Commit.**

---

### Task 7: Reports and GCash

**Files:**
- Create: `src/features/sales/ReportsPage.tsx`
- Create: `src/features/sales/GcashPage.tsx`
- Create: `src/features/sales/components/MonthTable.tsx`
- Create: `tests/unit/reports-page.test.tsx`

Behavior:
- Daily report: totals, labor per user, cash/GCash, full breakdown.
- Monthly report: each day with sales, Dad labor, Uncle labor, cash, GCash; click day to open daily.
- GCash page: per-user shop share, transfers, held; labor share/earned; record transfer to shop bank or other user.
- Month close/export is not in this plan.

- [ ] **Test-first monthly table and GCash balance display.**
- [ ] **Implement.**
- [ ] **Run tests.**
- [ ] **Commit.**

---

### Task 8: Digital receipt

**Files:**
- Create: `src/features/sales/SalesReceiptPage.tsx`
- Create: `tests/unit/sales-receipt.test.tsx`

Behavior:
- Public `/r/:token`.
- Shop details, order no/date, optional customer/bike, items, labor total, total, payment methods/amounts.
- No internal labor split, costs, or customer contact.
- Share button copies link; optional QR.
- Loading/not found/error.

- [ ] **Test-first receipt render and missing token.**
- [ ] **Implement.**
- [ ] **Run tests.**
- [ ] **Commit.**

---

### Task 9: Navigation and old-route retirement

**Files:**
- Modify: `src/app/AppNav.tsx`
- Modify: `src/app/router.tsx`
- Create: `src/routes/OrdersPage.tsx`, `OrderFormPage.tsx`, `ItemsPage.tsx`, `ReportsPage.tsx`, `GcashPage.tsx`, `SalesReceiptPage.tsx`
- Modify: `src/app/layouts/StaffLayout.tsx` only if nav labels change.

Behavior:
- Nav: Orders, Items, Reports, Settings. Both users see all.
- `/` → `/orders`.
- Remove old `/bay`, `/inventory`, `/sales`, `/owner` routes from the router.
- Keep login/lock and public receipt route.
- Settings read-only for now; QuickBooks mapping later.
- Update `docs/roadmap.md` and `docs/spec.md` to point to the new design.

- [ ] **Test-first route/nav.**
- [ ] **Implement.**
- [ ] **Run full check.**
- [ ] **Commit.**

---

### Task 10: E2E, polish, deploy

**Files:**
- Create: `tests/e2e/sales-log.spec.ts`
- Modify: `playwright.config.ts` only if routes need it.
- Modify: `docs/roadmap.md`, `docs/spec.md`.

Behavior:
- Login as Dad, create an order with two items, helper split, mixed payment, change, extra; verify daily total.
- Edit the order.
- Open monthly report.
- Record a GCash transfer.
- Open digital receipt.
- Mechanic/either user sees same access.

- [ ] **Run `npm run check`; fix all failures.**
- [ ] **Run E2E; fix all failures.**
- [ ] **Commit, PR, merge on green CI.**
- [ ] **Deploy from main; smoke-test production.**
- [ ] **Report evidence.**

## Out of scope (follow-up after morning answers)

- QuickBooks IIF export.
- Month lock.
- Reconciliation screen.
- GCash month-close blocking/carry-forward.
- QuickBooks account/tax mapping settings.
- Importing inactive items.
- Historical sales import.

## Acceptance

The daily sales log works end-to-end without stock tracking. Both users can create/edit mixed-payment orders with labor splits and extras, see daily/monthly reports, track GCash held, and open an optional digital receipt. `npm run check` and E2E pass. QuickBooks export remains disabled until the open decisions are answered.
