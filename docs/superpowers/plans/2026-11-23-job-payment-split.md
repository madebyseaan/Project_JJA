# Job / Payment Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the order flow into an unpaid job step and a later payment step, show the buyer the job total, rename the staff to Aldwin and Magma, and show the signed-in person as “You”.

**Architecture:** Keep one order record and one atomic `save_sales_order` RPC. Add `paid_on` and a `PAID` status. Step 1 saves an `OPEN` order with items and labor. Step 2 saves extras/payments/change, requires a zero balance, and sets `PAID` plus the Manila payment date. Reports and receipts use `paid_on`; open jobs stay out of sales totals. The UI splits into a new-job form, an order detail page with Order/Payment tabs, and an Orders page with Open jobs + Paid sales.

**Tech Stack:** React 19, Vite, TypeScript strict, Tailwind CSS v4, shadcn/ui, TanStack Query, Supabase Postgres/Auth, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-job-payment-split-design.md`

## Global Constraints

- No file over 1,000 lines.
- Money is integer centavos; the database computes totals.
- Writes go through RPCs. No direct insert/update/delete from the client.
- Both staff have identical access.
- “Today” and report dates use `Asia/Manila`.
- Sales, labor, GCash, and receipts use the payment date.
- “You” is a UI label only; the database stores real names and user IDs.
- QuickBooks export, month lock, and reconciliation remain out of scope.
- 360px first; 48px targets; loading, empty, and error states.
- `npm run check`, database tests, and E2E must pass before deploy.

## Review Focus

- A new unpaid job must save with zero payments and no extras, rather than being rejected as a payment mismatch.
- A paid order whose items/labor change must not save until payment is rebalanced; it must never silently become unpaid.
- Payment dates before the job date, in the future, or before 2000 must fail.
- Open jobs must not appear in sales, labor, GCash, or receipts; a backdated payment must appear on its paid date.
- “You” must appear in every staff choice and never in stored or exported data.
- Existing paid orders must be backfilled to `PAID` with `paid_on = business_date`.
- GCash allocations must only exist for paid orders.

---

### Task 1: Staff names and “You” helper

**Files:**
- Create: `supabase/migrations/20261123100000_staff_names.sql`
- Create: `src/features/sales/staff-label.ts`
- Test: `tests/unit/staff-label.test.ts`
- Modify: `scripts/setup-supabase.mjs`
- Modify: `tests/e2e/fixtures.ts`

**Interfaces:**
- Produces: `staffLabel(person: { id: string; displayName: string }, currentUserId: string | null | undefined): string`

- [ ] **Step 1: Write the failing label test**

```ts
expect(staffLabel({ id: 'a', displayName: 'Aldwin' }, 'a')).toBe('You');
expect(staffLabel({ id: 'm', displayName: 'Magma' }, 'a')).toBe('Magma');
expect(staffLabel({ id: 'a', displayName: 'Aldwin' }, null)).toBe('Aldwin');
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run tests/unit/staff-label.test.ts`
Expected: FAIL because `staff-label.ts` does not exist.

- [ ] **Step 3: Add the helper and the name migration**

Migration updates `profiles.display_name` for `JJA-001` to `Aldwin` and `JJA-002` to `Magma`. The setup script and E2E fixtures use the same names.

- [ ] **Step 4: Run the test and typecheck**

Run: `npx vitest run tests/unit/staff-label.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261123100000_staff_names.sql src/features/sales/staff-label.ts tests/unit/staff-label.test.ts scripts/setup-supabase.mjs tests/e2e/fixtures.ts
git commit -m "feat: rename staff and add you labels"
```

---

### Task 2: Database lifecycle, views, receipt, and RPC

**Files:**
- Create: `supabase/migrations/20261123101000_job_payment_schema.sql`
- Create: `supabase/migrations/20261123101100_job_payment_rpc.sql`
- Create: `supabase/migrations/20261123101200_job_payment_receipt.sql`
- Modify: `tests/db/sales-orders.test.ts`
- Create: `tests/db/job-payment.test.ts`

**Interfaces:**
- Produces: `public.save_sales_order(... p_paid_on date)` with the same leading arguments plus `p_paid_on`.
- Produces: `sales_orders.paid_on date nullable`; statuses `OPEN`, `PAID`, `EXPORTED`.
- Produces views `v_sales_daily`, `v_sales_labor_daily`, `v_sales_payments_daily` with a `paid_on` column.
- Produces: `get_sales_receipt` returns null for unpaid orders and includes `paid_on` and `business_date`.

- [ ] **Step 1: Write failing lifecycle tests**

Tests:

- Save a job with items and labor, no payments → `status = OPEN`, `paid_on = null`.
- The same job does not appear in any sales view.
- Pay it with `p_paid_on = '2026-11-20'` → `status = PAID`, `paid_on = '2026-11-20'`; sale appears on that date, not `business_date`.
- A job cannot be paid with a date before `business_date` or after Manila today.
- A paid order cannot save with zero payments.
- A paid order with changed items and old payment fails `PAYMENT_MISMATCH`; rebalanced payment succeeds.
- Extras without payment fails `PAYMENT_REQUIRED`.
- Receipt returns null for an open order and includes `paid_on` for a paid order.
- Backfill behavior is covered by the migration and a test that an existing paid order reports on `business_date`.

Run: `npm run test:db -- tests/db/job-payment.test.ts` in CI or local Docker.
Expected: FAIL because `paid_on`, `PAID`, and `p_paid_on` do not exist.

- [ ] **Step 2: Implement the schema migration**

Add `paid_on`, the new status check, consistency checks, indexes, and backfill. Drop and recreate the three report views using `paid_on`. Re-grant select to `authenticated`.

- [ ] **Step 3: Replace the save RPC**

Drop the old 12-argument function and create the 13-argument function. Rules:

- No payments and no changes:
  - extras must be zero;
  - an already-paid order is rejected;
  - result is `OPEN`, `paid_on = null`.
- Payments present:
  - extras/payments/change must balance;
  - `p_paid_on` defaults to today and must be between the job date and today;
  - result is `PAID`, `paid_on = p_paid_on`.
- GCash allocations are written only for paid orders.
- Exported orders are locked.

- [ ] **Step 4: Update the receipt function**

Filter `status in ('PAID','EXPORTED')` and add `paid_on` to the payload.

- [ ] **Step 5: Update the existing sales-order tests**

Every test order with payments sets `p_paid_on`. The past-date test uses a paid date. Assertions for daily/labor/payment views use `paid_on`.

- [ ] **Step 6: Run database tests**

Run: `npm run test:db` (CI if Docker is unavailable).
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261123101000_job_payment_schema.sql supabase/migrations/20261123101100_job_payment_rpc.sql supabase/migrations/20261123101200_job_payment_receipt.sql tests/db/sales-orders.test.ts tests/db/job-payment.test.ts
git commit -m "feat: add unpaid jobs and payment dates"
```

---

### Task 3: Domain types, API, hooks, and report math

**Files:**
- Modify: `src/features/sales/types.ts`
- Modify: `src/features/sales/api.ts`
- Modify: `src/features/sales/hooks/use-sales.ts`
- Modify: `src/features/sales/report-math.ts`
- Modify: `tests/unit/sales-report-math.test.ts`

**Interfaces:**
- `SalesOrder.paidOn: string | null`; `status: 'OPEN' | 'PAID' | 'EXPORTED'`.
- `OrderInput.paidOn: string | null`.
- `DailyReport`, `LaborReport`, `PaymentsReport`, and `MonthlyRow` use `paidOn`, not `businessDate`.
- Produces: `listOpenOrders(): Promise<SalesOrder[]>`
- Produces: `listPaidOrders(paidOn: string): Promise<SalesOrder[]>`
- Produces hooks `useOpenOrders()` and `usePaidOrders(paidOn)`.

- [ ] **Step 1: Write the failing report-math tests**

Change fixtures to `paidOn` and assert rows combine by `paidOn`.

- [ ] **Step 2: Implement the type and API changes**

`ORDER_COLUMNS` includes `paid_on`. `listOpenOrders` filters `status = OPEN` and sorts oldest first. `listPaidOrders` filters `paid_on = date` and `status in (PAID, EXPORTED)`. `saveOrder` sends `p_paid_on`. Report functions map `paid_on` to `paidOn`.

- [ ] **Step 3: Update hooks and invalidation**

Open and paid queries use separate keys. Saving/payment invalidates `['sales']`.

- [ ] **Step 4: Run unit tests and typecheck**

Run: `npx vitest run tests/unit/sales-report-math.test.ts && npm run typecheck`
Expected: PASS, with UI type errors fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/features/sales/types.ts src/features/sales/api.ts src/features/sales/hooks/use-sales.ts src/features/sales/report-math.ts tests/unit/sales-report-math.test.ts
git commit -m "feat: add paid dates to the sales API"
```

---

### Task 4: Shared draft state, validation, and summary card

**Files:**
- Create: `src/features/sales/hooks/use-order-draft.ts`
- Create: `src/features/sales/components/OrderSummaryCard.tsx`
- Create: `src/features/sales/components/CustomerFields.tsx`
- Create: `src/features/sales/components/LaborFields.tsx`
- Create: `src/features/sales/components/ExtrasFields.tsx`
- Modify: `src/features/sales/components/OrderPaymentEditor.tsx`
- Test: `tests/unit/order-draft.test.ts`

**Interfaces:**
- `useOrderDraft(initial: OrderDraftInitial, currentUserId: string)` returns state setters, derived money, `buildInput(paidOn)`, `validateJob()`, `validatePayment()`, `chooseMain()`, `chooseHelper()`.
- `OrderSummaryCard` props: `mode: 'job' | 'payment'`, `partsCentavos`, `laborCentavos`, `extrasCentavos`, `paidCentavos`, `changeCentavos`, `balanceCentavos`, `status`, `primaryAction`, `secondaryAction?`.

- [ ] **Step 1: Write failing validation tests**

```ts
expect(validateJobDraft(draftWithNoPayment)).toBeNull();
expect(validatePaymentDraft(draftWithNoPayment)).toContain('payment');
```

Also test the helper share, GCash recipients, and paid-order rebalancing rule.

- [ ] **Step 2: Implement the hook and components**

Extract the customer, labor, extras, and summary sections from the current `OrderFormPage`. Use `staffLabel` for every staff choice. The payment editor receives `currentUserId` and labels the current user “You”.

- [ ] **Step 3: Run unit tests and typecheck**

Run: `npx vitest run tests/unit/order-draft.test.ts && npm run typecheck`
Expected: PASS after the UI consumers are updated in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/features/sales/hooks/use-order-draft.ts src/features/sales/components tests/unit/order-draft.test.ts
git commit -m "feat: add shared order draft and summary"
```

---

### Task 5: Step 1 new-job page

**Files:**
- Modify: `src/features/sales/OrderFormPage.tsx`
- Modify: `src/features/sales/components/OrderItemEditor.tsx` only if labels need the current user
- Test: `tests/unit/order-form-page.test.tsx`

**Interfaces:**
- Consumes `useOrderDraft`, `useCatalog`, `useStaff`, `useSaveOrder`.
- Produces: a new order saved with `paidOn: null`, `extras: []`, `payments: []`, `changes: []`.

- [ ] **Step 1: Write the failing component test**

Render `/orders/new`, add a catalog item, enter labor, and assert the summary shows Parts, Labor, and Job total. Submit and assert the mutation receives no payments and `paidOn: null`.

- [ ] **Step 2: Implement the page**

Sections: Customer, Items, Labor, summary. No extras, payments, change, or review dialog. On success: toast “Job saved. Take payment when the work is done.” and navigate to `/orders`.

- [ ] **Step 3: Run the test and typecheck**

Run: `npx vitest run tests/unit/order-form-page.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/sales/OrderFormPage.tsx tests/unit/order-form-page.test.tsx
git commit -m "feat: save unpaid jobs from step one"
```

---

### Task 6: Order detail with Order / Payment tabs

**Files:**
- Create: `src/features/sales/OrderDetailPage.tsx`
- Create: `src/routes/OrderDetailPage.tsx`
- Modify: `src/app/router.tsx`
- Test: `tests/unit/order-detail-page.test.tsx`

**Interfaces:**
- Route `/orders/:id` renders the detail page; `?tab=payment` opens the payment tab.
- Consumes `useOrder`, `useOrderDraft`, `useSaveOrder`, `ShareReceiptDialog`.
- Share receipt is only rendered for `PAID` or `EXPORTED`.

- [ ] **Step 1: Write the failing test**

Load an open order, assert the Order tab shows the job total and the Payment tab shows “No payment yet”. Save payment with a balanced amount and assert `paidOn` is sent and the status becomes Paid.

- [ ] **Step 2: Implement the page and route**

Header: order number, status badge, job date, paid date, back, share (paid only). Tabs: Order and Payment. Order tab saves job details; Payment tab saves extras/payments/change and the payment date. Paid orders with changed items show the rebalancing error until the balance is zero.

- [ ] **Step 3: Run the test and typecheck**

Run: `npx vitest run tests/unit/order-detail-page.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/sales/OrderDetailPage.tsx src/routes/OrderDetailPage.tsx src/app/router.tsx tests/unit/order-detail-page.test.tsx
git commit -m "feat: split order details and payment"
```

---

### Task 7: Orders page with Open jobs and Paid sales

**Files:**
- Modify: `src/features/sales/OrdersPage.tsx`
- Test: `tests/unit/orders-page.test.tsx`

**Interfaces:**
- Consumes `useOpenOrders`, `usePaidOrders`, `useDailyReport`, `useLaborReport`, `usePaymentsReport`.
- Produces: open jobs list with Take payment links and a paid-sales section keyed by payment date.

- [ ] **Step 1: Write the failing test**

Fixture with one open job and one paid sale: assert the open job appears in Open jobs with its job total, the paid sale appears in Paid sales, and the sales summary excludes the open job.

- [ ] **Step 2: Implement the page**

Open jobs first, then the date picker labeled “Sales paid on”, summary cards, labor per person, and paid rows. Use `staffLabel` for worker names. Each open job links to `/orders/:id?tab=payment`.

- [ ] **Step 3: Run the test and typecheck**

Run: `npx vitest run tests/unit/orders-page.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/sales/OrdersPage.tsx tests/unit/orders-page.test.tsx
git commit -m "feat: show open jobs and paid sales"
```

---

### Task 8: Reports, GCash, and receipt labels

**Files:**
- Modify: `src/features/sales/ReportsPage.tsx`
- Modify: `src/features/sales/GcashPage.tsx`
- Modify: `src/features/sales/SalesReceiptPage.tsx`
- Modify: `src/features/sales/components/ShareReceiptDialog.tsx` only if date text changes
- Modify: `tests/unit/reports-page.test.tsx`
- Modify: `tests/unit/sales-receipt.test.tsx`

**Interfaces:**
- Reports use `paidOn` and labels “Sales paid”.
- GCash cards and history use `staffLabel`.
- Receipts only render for paid orders and show `paidOn`.

- [ ] **Step 1: Write failing assertions**

Reports page shows the payment date; receipt shows “Paid on”; GCash balances show “You” for the signed-in user.

- [ ] **Step 2: Implement the label and date changes**

Use `useAuth` for the current user ID. Do not change stored names.

- [ ] **Step 3: Run unit tests and typecheck**

Run: `npx vitest run tests/unit/reports-page.test.tsx tests/unit/sales-receipt.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/sales/ReportsPage.tsx src/features/sales/GcashPage.tsx src/features/sales/SalesReceiptPage.tsx tests/unit/reports-page.test.tsx tests/unit/sales-receipt.test.tsx
git commit -m "feat: use paid dates and you labels"
```

---

### Task 9: E2E, docs, and deploy

**Files:**
- Modify: `tests/e2e/sales-log.spec.ts`
- Modify: `tests/e2e/fixtures.ts`
- Modify: `docs/spec.md`, `docs/roadmap.md`, `docs/runbook.md`, `docs/setup.md`, `AGENTS.md`, `README.md`
- Create: `docs/decisions/0009-job-payment-split.md`

- [ ] **Step 1: Update the E2E mocks and flow**

Create an unpaid job, verify Open jobs, take payment with extras plus mixed cash/GCash and change, verify Paid sales on the payment date, open the receipt, and check “You” on the main-worker choice.

- [ ] **Step 2: Run the full verification**

```bash
npm run check
npm run test:e2e
```

Expected: PASS. Database tests must pass in CI.

- [ ] **Step 3: Update the docs**

Document the open/paid lifecycle, paid-date reports, names, and “You” behavior. Update the roadmap Step 10 and add the ADR.

- [ ] **Step 4: Commit, PR, merge, deploy**

Push the branch, open the PR, wait for CI, squash merge, and let the deploy workflow apply the two new migrations. Smoke-test production:

- create an unpaid job,
- see it in Open jobs,
- take payment,
- see it in Paid sales,
- open the receipt,
- confirm the names Aldwin/Magma and the “You” labels.

- [ ] **Step 5: Capture updated screenshots**

Save new mobile/desktop screenshots under `docs/screenshots/step-10-job-payment-*.png` and commit them in a docs PR.

## Out of scope (follow-up)

- QuickBooks IIF export, month lock, and reconciliation.
- Deposits, partial payments, refunds, and void sales.
- Public quotation links for unpaid jobs.
- Customer accounts.
