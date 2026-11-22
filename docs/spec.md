# J.J.A Sales Log — Specification

**Status:** Current source of truth.
**Updated:** 22 November 2026.
**Supersedes:** the inventory and bay-ticket specification of 15–21 November 2026.

The shop is **J.J.A Motor Accessories and Motorcycle Repair Shop** (Est. 2023), one motorcycle parts and repair shop in the Philippines. This document describes the daily sales log that replaces the old inventory/repair-ticket app. The old inventory, bay, day-close, and receipt tables remain in the database until a later cleanup, but their screens are no longer part of the product.

The approved design note is `docs/superpowers/specs/2026-11-22-sales-log-design.md`. If this file and that note disagree, this file wins.

---

## 1. Summary

Dad and Uncle record each customer order in a phone-friendly sales log:

- date, optional customer name, optional motorcycle;
- parts from the QuickBooks item list, with quantity and a per-order price;
- custom lines for parts missing from QuickBooks;
- total labor, an optional helper, and the helper’s share;
- extras (keep-the-change tips) assigned to one of the two workers;
- one or more cash/GCash payments, with the GCash recipient;
- change, as cash or GCash.

The app reports daily and monthly sales, labor per person, cash, GCash, and the shop’s GCash held in personal accounts. It can share an optional public digital receipt. There is **no stock tracking**: QuickBooks remains the official stock and accounting record.

QuickBooks Desktop Enterprise 13.0 Retail Edition is used for accounting and stock. A later step exports **parts only** as IIF sales receipts, one per day per payment method, and locks the month. Labor is never exported.

---

## 2. Goals

1. Replace the paper daily record book with a fast phone-friendly log.
2. Show daily and monthly sales, labor per person, cash, and GCash clearly.
3. Never lose track of who earned labor or who is holding shop GCash.
4. Keep both workers on equal footing with the same access.
5. Fit a 360px phone and a desktop browser with large, high-contrast controls.
6. Keep monthly QuickBooks export possible without retyping sales (a later step).
7. Host at ₱0/month on Cloudflare Workers static assets and Supabase’s free tier.

## 3. Non-goals (current phase)

- Stock quantities, reservations, stock ledgers, or low-stock alerts.
- Supplier, purchase-order, or receiving workflows.
- Multi-shop or multi-tenant support.
- Customer accounts or a storefront.
- Online cart, delivery, or shipping.
- Partial returns or exchanges.
- Payroll, commissions, or government deductions.
- BIR Official Receipts or sales-invoice compliance features.
- Camera scanners, part photos, or SMS/email delivery.
- Offline sales. The app is offline-tolerant for viewing but never queues a sale.
- Importing historical sales.
- QuickBooks live API integration. QuickBooks Desktop uses file export/import.

---

## 4. Users and access

Two staff accounts, both with the same access:

| Staff | Employee ID | Display name |
|---|---|---|
| Dad | `JJA-001` | Dad |
| Uncle | `JJA-002` | Uncle |

- Login is Supabase Auth with a hidden internal email derived from the employee ID: `jja-001@staff.jja.internal`. Staff type only the employee ID and password.
- `profiles.role` remains `owner` or `mechanic` for compatibility with legacy tables, but the sales log **does not use it**. No screen in the sales log is owner-only.
- Both staff can create, view, edit, and share orders; add extras; record payments and change; import items; record GCash transfers; and view reports and settings.
- The old owner/mechanic navigation split is retired.
- The local PIN lock remains a screen lock. It is not identity and never goes to the server.

---

## 5. Daily flow

1. Open **Orders**. Today’s Manila business date is selected.
2. Tap **New order**.
3. Optionally enter the customer and motorcycle.
4. Add items:
   - search the QuickBooks catalog by name, SKU, or description;
   - add an item; the price fills from the catalog;
   - change the quantity;
   - change the price for this order only;
   - remove a line.
5. If the item is not in QuickBooks, add a **custom line**: name, quantity, price. It is marked “not in QuickBooks”.
6. Enter **total labor**. If someone helped, choose the helper and enter the helper’s share. The main worker receives `total labor − helper share`.
7. Add optional **extras** (tips/keep-the-change). The recipient defaults to the main worker; the helper can be chosen. Extras go to labor, not to shop sales.
8. Record payment:
   - one or more payments;
   - each is Cash or GCash;
   - each GCash payment records who received it;
   - change can be cash or GCash and records its own recipient.
9. Review the order: items, labor split, extras, payments, change, totals, balance.
10. Save. The order appears in the daily log and reports.
11. Optionally share the digital receipt link or QR code.

Orders stay editable while the month is open. Changing an order’s business date assigns a new order number for that date. Once QuickBooks export and month lock exist, an exported month is read-only and corrections happen in QuickBooks.

---

## 6. Screens and routes

| Route | Purpose |
|---|---|
| `/orders` | Daily list, date picker, daily totals, labor per person, order links |
| `/orders/new` | Create an order |
| `/orders/:id` | View/edit an order, share its receipt |
| `/items` | Search the catalog; import the QuickBooks item list |
| `/reports` | Monthly report with daily rows, totals, and labor breakdown |
| `/reports/gcash` | GCash held per person, transfers, recent history |
| `/settings` | Read-only shop details and QuickBooks-related guidance |
| `/s/:token` | Public digital receipt |

Navigation has four items for both staff: **Orders**, **Items**, **Reports**, **Settings**.

Legacy routes `/r/:token` (old receipt), `/verify` (old verification), `/login`, and `/lock` remain available. Old `/bay`, `/inventory`, `/sales`, and `/owner` routes are removed. Unknown paths redirect to `/orders`.

The root path `/` redirects to `/orders`.

---

## 7. Data model

All money is integer **centavos**. All business dates use `Asia/Manila`; timestamps are `timestamptz`. Writes go through database functions.

### 7.1 `catalog_items`

The QuickBooks item list. No stock.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | Unique case-insensitively, 1–120 characters |
| `description` | text | Up to 300 characters |
| `sku` | text nullable | QuickBooks MPN; not unique |
| `base_price_centavos` | integer | ≥ 0 |
| `item_type` | text | Usually `Inventory Part` |
| `income_account` | text | QuickBooks income account |
| `cogs_account` | text | QuickBooks COGS account |
| `asset_account` | text | QuickBooks asset account |
| `preferred_vendor` | text | QuickBooks preferred vendor |
| `is_active` | boolean | Only active items are shown |
| `source` | text | `quickbooks` or `manual` |
| `imported_at`, `updated_at` | timestamptz | |

Imports are idempotent by item name. Inactive and non-inventory rows are skipped. No stock quantity is stored.

### 7.2 `sales_orders`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_no` | text unique | `SL-YYYYMMDD-0001`, using the business date |
| `business_date` | date | Manila business date |
| `customer_name` | text nullable | Up to 120 characters |
| `bike_model` | text nullable | Up to 120 characters |
| `main_user_id` | uuid | Worker who gets the labor remainder |
| `helper_user_id` | uuid nullable | Must differ from the main user |
| `parts_total_centavos` | integer | Sum of line totals; computed by the RPC |
| `labor_total_centavos` | integer | Total labor entered by staff |
| `total_centavos` | integer generated | `parts + labor` |
| `status` | text | `OPEN` or `EXPORTED` (export is a later step) |
| `created_by` | uuid | |
| `created_at`, `updated_at` | timestamptz | |
| `reviewed_by`, `reviewed_at` | uuid, timestamptz | Set on save |
| `public_token` | text unique | 128-bit random hex token for the digital receipt |

### 7.3 `sales_order_items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | Cascade delete with the order |
| `catalog_item_id` | uuid nullable | Null for custom lines |
| `item_name_at_time` | text | Snapshot |
| `qty` | integer | > 0 |
| `unit_price_at_time_centavos` | integer | ≥ 0; snapshot |
| `line_total_centavos` | integer generated | `qty × unit price` |
| `is_custom` | boolean | True when not in QuickBooks |

A custom line must have no catalog item. A catalog line must have one. Repeated catalog items are merged into one line and the quantity is increased. Custom lines are always separate.

### 7.4 `sales_labor`

One row per worker per order.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | |
| `user_id` | uuid | |
| `amount_centavos` | integer | ≥ 0 |
| `is_main` | boolean | Exactly one main row per order |

The main row is always written, even when its amount is zero. Rows sum to `sales_orders.labor_total_centavos`.

### 7.5 `sales_extras`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | |
| `user_id` | uuid | Main or helper for this order |
| `amount_centavos` | integer | > 0 |
| `note` | text nullable | Up to 120 characters |
| `created_by`, `created_at` | | |

Extras are part of labor payout, not part of customer sales.

### 7.6 `sales_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | |
| `method` | text | `CASH` or `GCASH` |
| `amount_centavos` | integer | > 0 |
| `gcash_recipient_id` | uuid nullable | Required for GCash; null for cash |
| `received_by` | uuid | Staff who recorded it |
| `received_at` | timestamptz | |

### 7.7 `sales_changes`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | |
| `method` | text | `CASH` or `GCASH` |
| `amount_centavos` | integer | > 0 |
| `gcash_recipient_id` | uuid nullable | Required for GCash change |
| `created_by`, `created_at` | | |

For each method, change cannot exceed payments. For GCash, change must come from a recipient who received a GCash payment, and cannot exceed that recipient’s own GCash payment. Across the order:

`payments = parts + labor + extras + change`

and the review screen must show a zero balance before save.

### 7.8 `sales_gcash_allocations`

One row per order and GCash recipient.

| Column | Type | Notes |
|---|---|---|
| `order_id`, `recipient_id` | uuid | Unique together |
| `net_gcash_centavos` | integer | GCash payments − GCash change for this recipient |
| `shop_share_centavos` | integer | Parts share of the net GCash |
| `labor_share_centavos` | integer | Labor and extras share |
| check | | Shares sum to net GCash |

The split is proportional to parts versus labor+extras for the order. Rounding is deterministic so the parts share plus the labor share always equals the net exactly.

### 7.9 `gcash_transfers`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | Whose personal GCash held the money |
| `amount_centavos` | integer | > 0 |
| `destination` | text | `SHOP_BANK` or `USER` |
| `counterparty_user_id` | uuid nullable | Required for `USER`, different from sender |
| `reference` | text nullable | Up to 120 characters |
| `note` | text nullable | Up to 300 characters |
| `created_by`, `created_at` | | |

A transfer cannot exceed the shop or labor balance held by that person. `INSUFFICIENT_GCASH` is returned otherwise.

### 7.10 Legacy tables

`parts`, `stock_movements`, `tickets`, `ticket_items`, `ticket_labor`, `ticket_payments`, `receipts`, `day_closes`, `reconciliations`, and `shop_settings` remain in the database for now. The sales log uses only `shop_settings` (shop name, address, contact, receipt footer) and `profiles`. The old tables are not written by the new module and may be dropped only after a backup and an explicit cleanup migration.

### 7.11 Counters

`private.sales_order_counters(day date primary key, next_no integer)` issues `SL-YYYYMMDD-0001`. Numbers are sequential per business date with no normal gaps.

---

## 8. Money and labor rules

- Money is integer centavos. Never use floats for arithmetic.
- The database computes line totals, parts totals, order totals, and GCash allocations. The client never sends a total.
- Prices are snapshotted at save time. Editing the catalog later does not change old orders. Costs stay in QuickBooks and are not stored on the order.
- Per-order price overrides are allowed and do not update the catalog.
- Helper share cannot exceed total labor. The main share is `total − helper share` and is never negative.
- A helper must be a different staff account from the main worker.
- An extra must go to the main or helper on that order. The default is the main worker.
- Payments and changes must balance exactly; a mismatch is rejected by the database.
- Cash and GCash change cannot exceed the payments for that method.
- Daily net by method is `payments − change` for that method.
- Reported parts and labor are allocated across methods for later export using the net method amounts. The preview will allow an override in the export step; the default allocation must always sum exactly.

---

## 9. GCash held and settlement

- GCash payments land in a personal GCash account. The app records whose account.
- Each payment’s net is split into a shop share (parts) and a labor share (labor and extras).
- The recipient holds the shop share until it is transferred to the shop bank.
- A user-to-user transfer moves held labor money from one person to the other.
- `get_gcash_balances()` shows, per person:
  - shop share received;
  - shop transfers to the bank;
  - shop GCash held;
  - labor share received;
  - labor transfers out;
  - labor GCash held (including transfers received);
  - labor earned all-time.
- A transfer never makes a balance negative.
- Month close in the later export step must require shop GCash held to be zero, unless a deliberate carry-forward reason is recorded.

---

## 10. Reports

### Daily

- Date picker defaults to today; past dates allowed; future dates disabled.
- Summary: parts, labor, cash net, GCash net, order count.
- Labor per person for the date.
- Every order for the date, with order number, customer/bike, workers, status, and total.
- Empty, loading, and error states.

### Monthly

- Month picker defaults to the current Manila month; future months disabled.
- Summary: sales, parts, labor, cash net, GCash net, extras, order count.
- Daily table: date, orders, parts, labor, cash, GCash, sales, month total.
- Tapping a date opens that day’s orders.
- Full breakdown: labor by person for the month (base labor, extras, payout).
- Empty, loading, and error states.

### GCash

- Total shop GCash still held.
- Each person’s shop and labor balances.
- “Record transfer” with from, amount, destination (shop bank or other person), reference, and note.
- Recent transfers.
- Empty, loading, and error states.

---

## 11. Catalog import

- Source: QuickBooks Desktop Item List exported as CSV.
- Required columns: `Item`, `Type`, `Price`.
- Imported columns: name, description, `MPN` as SKU, price, type, income account, COGS account, asset account, preferred vendor, active status.
- Only `Inventory Part` rows with `Active Status = Active` are imported.
- No stock quantity is imported.
- Missing prices are reported as row errors; valid rows still import in batches.
- The import is idempotent by item name. Re-import updates descriptions, prices, accounts, vendor, and active status.
- Permanent item changes happen in QuickBooks first and are re-imported.
- The private QuickBooks export file is never committed.

---

## 12. Digital receipt

- Optional per order.
- Public URL `/s/:token` with a 128-bit random token.
- Shows shop details, order number, business date, optional customer and motorcycle, item names and quantities, parts total, labor total, optional extra/tip, total charged, payments received, change returned, and net paid.
- Never shows the internal labor split, costs, notes, customer contact details, or transfer data.
- Includes a QR code and copy-link button; printing/saving as PDF uses the browser.
- Returns “Receipt not found” for an unknown token and never leaks whether an order exists.
- The old `/r/:token` receipt route remains for legacy links.

---

## 13. Security

- Supabase Auth only. Public sign-ups disabled.
- RLS is enabled on every new table; default deny.
- `authenticated` gets select only. No direct insert/update/delete grants on transactional tables.
- All writes are `security definer` functions with `search_path = ''` and fully qualified names.
- `REVOKE ALL` from `PUBLIC`, then explicit grants.
- `private.is_staff()` gates staff reads and functions. `anon` cannot read sales tables or views.
- `anon` may execute only the public receipt function and legacy public verification functions. The new public receipt function accepts only the token and a valid 32-hex format.
- CSV formula injection must be escaped on any future export.
- No service-role key, HMAC secret, password, PIN, JWT, or customer data in the browser bundle or logs.
- No analytics or third-party scripts.

---

## 14. Validation and errors

The database validates all arguments, strings are trimmed and length-limited, and quantities are positive.

Stable error codes:

- `INVALID_DATE` — date missing, before 2000, or in the future.
- `INVALID_MAIN_USER`, `INVALID_HELPER` — bad staff account.
- `INVALID_LABOR`, `INVALID_LABOR_SPLIT` — negative or helper share over total.
- `INVALID_EXTRA`, `INVALID_EXTRA_USER` — bad extra amount or recipient.
- `INVALID_QTY`, `INVALID_PRICE`, `INVALID_ITEM`, `INVALID_ITEM_NAME` — bad line.
- `INVALID_METHOD`, `INVALID_AMOUNT` — bad payment or change.
- `INVALID_GCASH_RECIPIENT`, `INVALID_CASH_RECIPIENT` — recipient does not match method.
- `INVALID_GCASH_RECIPIENT` also covers a missing recipient.
- `CHANGE_TOO_LARGE` — change exceeds the method payment.
- `PAYMENT_MISMATCH` — payments do not balance.
- `EMPTY_ORDER` — no items, labor, or extras.
- `ITEM_NOT_FOUND` — catalog item missing or inactive.
- `INSUFFICIENT_GCASH` — transfer exceeds the held balance.
- `INVALID_DESTINATION`, `INVALID_COUNTERPARTY`, `INVALID_REFERENCE`, `INVALID_NOTE` — bad transfer.
- `ORDER_NOT_FOUND`, `ORDER_LOCKED` — edit target missing or exported.
- `FORBIDDEN` — not staff.
- `PAYMENT_MISMATCH`, `INVALID_GCASH_RECIPIENT`, and `CHANGE_TOO_LARGE` are mapped to human messages in the UI.

Raw SQL errors never reach the UI. Forms show a human message and keep the entered values.

---

## 15. Offline and PWA behavior

- The app is an installable PWA with an offline shell.
- Supabase responses are **NetworkOnly** and never cached by the service worker.
- Viewing a cached shell while offline is allowed; saving an order is disabled until connectivity returns.
- The app shows online/offline status and an offline banner.
- PWA updates prompt; they never force-reload while a form is open.
- Audio alerts require a user gesture; the sales log has no mandatory audio alert.
- Print styles target A4; a thermal receipt layout is not required.
- The installed app must fit a 360px phone with no horizontal scrolling and no bottom safe-area gap.

---

## 16. Technology and architecture

| Layer | Choice |
|---|---|
| Language | TypeScript strict |
| UI | React, Vite, Tailwind CSS v4, shadcn/ui, lucide-react |
| Routing | React Router |
| Server state | TanStack Query |
| Forms | React Hook Form + zod where forms are complex |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Database access | `@supabase/supabase-js`; reads with RLS; writes via RPC |
| PWA | `vite-plugin-pwa` |
| CSV | papaparse |
| QR | `qrcode.react` |
| Tables | TanStack Table |
| Lint/format | Oxlint + Prettier |
| Unit tests | Vitest + Testing Library |
| E2E | Playwright |
| Hosting | Cloudflare Workers static assets |
| CI/CD | GitHub Actions |
| Package manager | npm |

There is no custom server. The browser talks to Supabase directly. The app is a static SPA.

---

## 17. Database functions

- `private.next_sales_order_no(p_day date) returns text` — daily order number.
- `public.save_sales_order(...) returns sales_orders` — create or replace an open order and all child rows in one transaction.
- `public.import_catalog_items(p_items jsonb) returns jsonb` — idempotent catalog upsert.
- `public.get_gcash_balances() returns jsonb` — per-person shop and labor balances.
- `public.record_gcash_transfer(...) returns gcash_transfers` — validated transfer.
- `public.get_sales_receipt(p_token text) returns jsonb` — public receipt payload.

Reads use RLS-protected tables and `security_invoker` views:

- `v_sales_daily`
- `v_sales_labor_daily`
- `v_sales_payments_daily`

Every write and every money-relevant change writes an `audit_events` row in the same transaction. The append-only audit table remains owner-only for legacy reasons; the sales functions write through security-definer functions.

---

## 18. Testing

### Unit

- Money parsing and formatting, including invalid and maximum values.
- Order money: parts, extras, payments, change, balance, net per method.
- Main labor remainder and helper-share edge cases.
- Month range, monthly rows, monthly totals, labor by person.
- Catalog CSV mapping: required columns, active/inventory filtering, missing price, blank MPN.
- Error-code to human-message mapping.
- Component states: orders, items, reports, GCash, receipt.

### Database

- Create an order with items, labor split, extras, mixed payments, and change.
- Reject helper share over total.
- Reject payment mismatch and too much change.
- Edit replaces child rows and recalculates totals.
- Custom and catalog line snapshots.
- Past-dated order appears in the correct daily report and order number.
- GCash balances and over-transfer rejection.
- Public receipt by token; altered or missing token returns null.
- Staff can read; anon cannot; direct writes are denied.
- Catalog import inserted/updated counts and idempotency.

### E2E

- Login as Dad; create an order with an item, helper split, extra, mixed payment, and change.
- See it in the daily list and monthly report.
- Open the edit form and see saved values.
- Open GCash balances and the public receipt.
- The mechanic sees the same navigation and access.
- The shell fits 360px without horizontal scrolling.

Tests are deterministic and never run against production. CI runs local Supabase in Docker.

---

## 19. Deployment and operations

- `main` is protected and always deployable. Work on feature branches and open a PR.
- CI must pass: typecheck, lint, format, file-size check, unit tests, build, database tests, and E2E.
- Database changes are migrations only. Never edit an applied migration and never change the schema from the dashboard.
- Generated types must be regenerated after migrations. Do not hand-edit `src/types/database.types.ts`.
- Deploy from `main` through GitHub Actions to Cloudflare Workers static assets.
- Nightly backups and a daily keep-alive are retained from the launch step.
- The service-role key is CI-only. The receipt secret stays in the database.
- Rollback: redeploy the previous successful build; never roll back a migration by editing it.

---

## 20. Repository structure

```text
src/
  app/            router, nav, guards, layouts, providers
  components/     shared components and ui primitives
  features/
    auth/         login, PIN lock
    sales/        orders, items, reports, GCash, receipt, hooks, APIs
    receipts/     legacy public receipt
    pwa/          install/update/offline
  hooks/          cross-feature hooks
  lib/            supabase, money, dates, errors, PIN, CSV helpers
  routes/         thin page wrappers
  styles/
  types/          generated database types and domain types
supabase/migrations/
tests/unit/
tests/db/
tests/e2e/
docs/
scripts/
```

No file over 1,000 lines. No new Markdown at the repository root. Feature code stays in `src/features/<feature>/`.

---

## 21. Phase plan

1. **Sales log core** — done: catalog, orders, labor, extras, payments, change, GCash, reports, receipt, navigation.
2. **QuickBooks export, month close, reconciliation** — blocked on the decisions in section 22.
3. **Sales-log UAT and production cutover** — after the export is approved.
4. **Later** — storefront, QR pass, camera scanner, photos, returns, payroll. Not scheduled.

A step ends with `npm run check`, database and E2E tests, a demo script, screenshots, and the architect’s **approved**.

---

## 22. Open decisions

1. QuickBooks account names for cash and GCash.
2. Sales tax code: VAT or non-VAT.
3. Exact IIF header format for QuickBooks Desktop Enterprise 13.0 Retail Edition.
4. Whether custom items block export or are carried with a note.
5. Whether inactive QuickBooks items are ever imported (recommended: no).
6. Digital receipt verification: link only or also a verification code.
7. Weekly or monthly GCash settlement reminder.

No export code ships until these are answered.

---

## 23. Glossary

- **Order** — one customer sale, with items, labor, extras, payments, and change.
- **Catalog** — the QuickBooks item and price list. No stock.
- **Custom line** — an item not in QuickBooks, flagged on the order.
- **Main worker** — the person who receives the labor remainder.
- **Helper** — the second worker, with a fixed share.
- **Extra** — a keep-the-change tip assigned to a worker.
- **Net GCash** — GCash payments minus GCash change.
- **Shop GCash held** — the parts share of GCash still in a personal account.
- **Labor GCash held** — the labor/extras share of GCash still in a personal account.
- **Transfer** — moving GCash to the shop bank or to the other worker.
- **Month close** — settle GCash, export parts sales, and lock the month (later step).
- **IIF** — the QuickBooks Desktop import file format.
- **RLS** — Row Level Security; the database rules for which rows a user can see or change.
- **RPC** — a PostgreSQL function called from the browser; the only way to write transactional data.
- **Snapshot** — a frozen item name and price stored on the order.
- **PWA** — an installable web app with an offline shell.

---

## 24. Acceptance criteria for the current step

- Both staff can create an order with multiple items, labor, a helper split, extras, mixed payments, and change.
- Parts money, labor money, and extras are reported separately.
- Daily and monthly reports match the orders.
- GCash held per person is visible; transfers reduce it and cannot overdraw.
- Editing an order replaces its lines without duplicates and recalculates totals.
- Custom lines are clearly flagged.
- The catalog import skips inactive and non-inventory rows and never imports stock.
- The public receipt opens by link and never shows the internal split.
- Both staff accounts have identical access.
- No stock screens or stock tracking are present.
- `npm run check`, database tests, and E2E pass.
