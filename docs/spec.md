# Motorcycle Parts & Repair Shop POS — Specification

**Status:** Draft for review
**Date:** 2026-11-15
**Owner:** Sean
**Scope:** One shop, phase 1
**Budget:** ₱0 per month
**Locale:** Philippines — ₱ (PHP), Asia/Manila

---

## 1. Summary

A phone-friendly web app for one motorcycle parts and repair shop.

The mechanic creates a walk-in ticket at the counter, adds parts and labor, verifies the parts physically, takes payment, and the system issues a tamper-evident e-receipt. The owner manages inventory, sees the day's sales, reconciles cash, and exports daily sales to CSV for QuickBooks Desktop.

The app is a static React application hosted free on Cloudflare. Supabase provides staff accounts, PostgreSQL, live updates, and storage. There is no custom server, no server-side rendering, and no monthly bill.

---

## 2. Goals

1. A walk-in ticket takes under one minute from the bay screen.
2. Stock is always accurate: no overselling, no silent adjustments, no negative counts.
3. Every peso is traceable: who took it, how it was paid, and which receipt it belongs to.
4. Every receipt is tamper-evident: a customer or the owner can verify it against the live system.
5. The owner can close the day and export sales without retyping anything.
6. The app works on ordinary Android and iPhone browsers, and installs as a PWA.
7. The monthly hosting and database bill stays at ₱0.
8. One person can maintain the codebase without a framework treadmill.

---

## 3. Non-goals (phase 1)

- Multi-shop or multi-tenant support. This is one shop.
- Customer accounts, a public storefront, or online ordering.
- Offline sales or offline queueing.
- SMS or email delivery of receipts.
- BIR-registered "Official Receipts" or tax computation.
- Payroll, full accounting, purchase orders, suppliers, or loyalty points.
- Part photos and image uploads.
- Returns, partial refunds, or warranty workflows. Phase 1 supports whole-sale voids only.
- Barcode scanning. Phase 2 may add a camera scanner.
- A custom API server, Next.js, Prisma, Fastify, or any always-on backend.

---

## 4. Constraints and key decisions

| Decision | Choice | Reason |
|---|---|---|
| Hosting | Cloudflare Workers static assets | Free, commercial use allowed, HTTPS included, no server CPU limit |
| Front end | React + Vite + TypeScript | Fully static SPA; no server rendering needed |
| Backend | Supabase Free | PostgreSQL, Auth, Realtime, Storage in one free tier |
| Writes | PostgreSQL functions only | The browser cannot forge prices, stock, payments, or receipts |
| Money | Integer centavos | No floating-point rounding errors |
| Dates | `timestamptz`, business date in `Asia/Manila` | "Today" means the shop's today, not UTC |
| Receipts | Immutable snapshot + HMAC verification code | Edits are detectable; history cannot be rewritten |
| Printer | None at launch; e-receipt primary | No hardware dependency; print/PDF can be added later |
| Package manager | npm | Already installed; no extra tooling |
| Local database | Supabase staging project; CI uses local Supabase in Docker | Docker is not installed on the development laptop |
| CI/CD | GitHub Actions | Free minutes; the repository is already on GitHub |

---

## 5. Users and roles

| Role | Person | Can do |
|---|---|---|
| **Owner** | Dad | Everything: bay, inventory, prices, stock adjustments, payments, void sales, day close, audit log, settings |
| **Mechanic** | Uncle | Create tickets, add catalog parts and labor, verify parts, record payments, complete tickets, view inventory |
| **Customer** | Walk-in | No account. Receives an e-receipt link or QR. Can open and verify a receipt. |

Rules:

- The owner account can also work the bay. There is no separate "owner mode" toggle; permissions follow the signed-in account.
- A mechanic cannot void a sale, edit a price, adjust stock, close the day, or read the audit log.
- The PIN is a local screen lock, not an identity. The Supabase session decides the role.
- Each person should use their own device or sign out when switching. A shared device logged in as the owner gives the next user owner powers.

---

## 6. Core flows

### 6.1 Walk-in ticket (primary flow)

1. Mechanic opens **Bay → New Ticket**.
2. Optionally enters the customer name and bike model.
3. Searches the catalog and adds parts. The database reserves each part immediately.
4. Adds labor lines with a description and amount.
5. Saves. The ticket gets a daily number, e.g. `TK-20261115-0001`.
6. The ticket appears in the bay queue and on other staff devices in real time.

### 6.2 Repair and verification

1. Mechanic moves the ticket through `PENDING → VERIFYING → IN_PROGRESS → READY`.
2. Each part line has a **Verified** checkbox. The mechanic ticks it after physically pulling the part.
3. A ticket with parts cannot be completed until every part is verified.
4. Mid-repair additions use the same add-part and add-labor actions. Stock is reserved immediately.

### 6.3 Payment and completion

1. On **Complete**, the app shows the total, the payments already recorded, and the balance.
2. The mechanic records the final payment (cash or GCash/Maya) and confirms.
3. The database, in one transaction:
   - checks that the payment balance is zero,
   - deducts `stock_on_hand` and `reserved_qty` for every part,
   - writes a `SALE` row to the stock ledger,
   - issues the receipt with a daily number, immutable snapshot, verification code, and public token,
   - marks the ticket `COMPLETED`.
4. If any step fails, nothing is committed.

### 6.4 E-receipt delivery

1. The completion screen shows a QR code and a **Copy Link** button.
2. The customer scans the QR with their phone camera and opens the receipt page.
3. The receipt page shows the shop details, receipt number, items, labor, total, payments, verification code, and a "Verified" badge.
4. The customer can save the page as a PDF or screenshot it. The verification code is what makes a screenshot checkable.
5. If the customer has no phone, the staff shows the receipt on the shop device and writes the receipt number on the customer's slip. The owner can look it up later.

### 6.5 Receipt verification

1. Anyone opens `/verify` on the shop's official URL.
2. Enters the receipt number and verification code.
3. The system recomputes the code from the stored snapshot and returns:
   - `Valid` with date, total, and payment method, or
   - `Void` with the void reason, or
   - `No match`.
4. The verification response never includes the customer's name or the full item list.

### 6.6 Day close

1. Owner opens **Owner → Day Close**.
2. The screen shows:
   - sales issued today (parts vs labor),
   - payments received today by method,
   - expected cash in the drawer,
   - voided sales today.
3. Owner enters the counted cash and notes.
4. The system stores the close and shows the variance.
5. The close is a snapshot; it does not lock the day or prevent later sales.

### 6.7 Void sale (owner only)

A completed sale can be voided in full when it was a genuine mistake or a full refund is given.

1. Owner opens the receipt and chooses **Void Sale**, enters a reason and refund method.
2. The database, in one transaction:
   - restores `stock_on_hand` for every item and writes `RETURN` ledger rows,
   - records a negative payment for the net amount paid (the refund),
   - marks the receipt `VOID` with the reason,
   - marks the ticket `VOIDED`,
   - writes audit events.
3. The receipt page and verification page show **VOID**. A new ticket is created for a corrected sale.
4. Partial returns and exchanges are phase 2.

### 6.8 Inventory

1. Owner adds a part with name, category, compatible models, price, cost, initial stock, and low-stock level.
2. Owner restocks or adjusts stock. Every change writes a ledger row with reason and actor.
3. Price changes are audited. Open tickets keep the price snapshot taken when the part was added.
4. Low-stock items appear on the owner dashboard and in the inventory filter.

---

## 7. Screens and routes

| Route | Access | Purpose |
|---|---|---|
| `/login` | Public | Staff email/password sign-in |
| `/lock` | Staff | PIN screen lock; unlock or sign out |
| `/bay` | Staff | Live queue, new ticket, ticket search |
| `/bay/ticket/:id` | Staff | Ticket detail: items, labor, payments, verification, status, complete |
| `/inventory` | Staff (read), owner (write) | Parts table, add/edit, restock, adjust, low-stock filter |
| `/owner` | Owner | Today's sales, payment split, low stock, day close summary |
| `/owner/sales` | Owner | Receipt/sales list, filters, CSV export |
| `/owner/audit` | Owner | Audit log and receipt integrity report |
| `/owner/settings` | Owner | Shop details, receipt footer, defaults |
| `/r/:token` | Public (unguessable token) | Customer e-receipt |
| `/verify` | Public | Receipt number + code verification |

Layout rules:

- The bay and inventory screens are mobile-first with 48px minimum touch targets.
- The owner screens work on a phone and a laptop.
- Every data screen has loading, empty, and error states.
- Owner-only navigation is hidden from mechanics, but the database enforces the permission.

---

## 8. Technology stack

| Layer | Choice |
|---|---|
| Language | TypeScript, strict mode |
| UI | React 19, Vite, Tailwind CSS v4, shadcn/ui, lucide-react |
| Routing | React Router |
| Server state | TanStack Query |
| Forms | React Hook Form + zod |
| Validation | zod on the client; PostgreSQL checks and function validation on the server |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage in phase 2) |
| Database access | `@supabase/supabase-js`; reads via PostgREST with RLS, writes via RPC |
| PWA | `vite-plugin-pwa` (Workbox) |
| Tables | TanStack Table |
| Toasts | Sonner |
| QR generation | `qrcode.react` |
| CSV | papaparse |
| Image compression (phase 2) | `browser-image-compression` |
| Unit tests | Vitest + Testing Library |
| End-to-end tests | Playwright |
| Hosting | Cloudflare Workers static assets |
| CI/CD | GitHub Actions |
| Package manager | npm |

No Next.js, no OpenNext, no Serwist, no `jose`, no Prisma, no Fastify.

---

## 9. Architecture

```
┌──────────────────────────────┐
│  Phone / tablet / laptop     │
│  React SPA (static files)    │
│  - TanStack Query            │
│  - Supabase JS client        │
│  - PIN lock (local)          │
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌──────────────────────────────┐
│  Supabase Free               │
│  - Auth (email/password)     │
│  - PostgREST + RLS           │
│  - PostgreSQL functions      │
│  - Realtime (staff)          │
│  - Storage (phase 2)         │
└──────────────────────────────┘

Static files: Cloudflare Workers static assets
```

### 9.1 Data flow

- **Reads:** the browser queries tables or views with the staff JWT. RLS decides which rows are visible.
- **Writes:** the browser calls a PostgreSQL function. The function checks the caller's role, validates inputs, locks rows, writes the change and the audit record in one transaction.
- **Realtime:** the bay subscribes to ticket changes. The UI invalidates TanStack Query caches on events, on window focus, and on reconnect. A 60-second poll is a fallback.
- **Public pages:** the receipt page and verification page call two narrowly scoped functions granted to the `anon` role. They never read tables directly.

### 9.2 Why no server

- Cloudflare Workers Free allows only 10ms of CPU per request. A server-rendered Next.js app regularly exceeds that, especially on cold starts at low traffic.
- Almost every screen is interactive client-side work: catalog search, cart, queue, tables. Server rendering adds no value.
- Removing the server removes an entire deployment target, adapter, and auth layer.

### 9.3 Hosting

- The built `dist/` directory is deployed as a static Worker with SPA fallback.
- HTTPS is automatic, which the PWA and (phase 2) camera require.
- A custom domain is optional. The free `*.workers.dev` URL works; changing it later breaks old receipt QR codes, so choose the final URL before launch.

### 9.4 PWA

- Installable with 192px, 512px, and maskable icons.
- The app shell is precached. Supabase requests are **NetworkOnly** and never cached, to avoid leaking stale prices or one user's data to another.
- Updates use a prompt; the app never reloads in the middle of a ticket.
- Offline shows a clear banner and disables all writes. There is no offline selling.

---

## 10. Data model

### 10.1 Conventions

- All primary keys are `uuid` unless noted.
- All timestamps are `timestamptz`.
- All money is integer centavos (`integer`, max ₱21,474,836.47 per value — far above any ticket).
- Business dates are derived with `(now() at time zone 'Asia/Manila')::date`.
- Every table has RLS enabled.
- Transactional tables have no direct write grants to `authenticated`; functions own the writes.
- Completed and voided records are immutable.
- `stock_movements` and `audit_events` are append-only.
- The `public` schema is exposed by Supabase. Secrets and counters live in the `private` schema.

### 10.2 `public.profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | References `auth.users(id)` on delete cascade |
| `display_name` | `text` not null | Shown in the UI and audit log |
| `role` | `text` not null | `owner` or `mechanic` |
| `created_at` | `timestamptz` not null | |
| `updated_at` | `timestamptz` not null | |

A trigger creates a profile when an auth user is created. The default role is `mechanic`; the owner role is assigned deliberately.

### 10.3 `public.parts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` not null | |
| `sku` | `text` unique | Nullable |
| `category` | `text` not null default `'General'` | Free text with UI suggestions |
| `compatible_models` | `text[]` not null default `'{}'` | e.g. `{Honda Click 125, Yamaha Mio}` |
| `unit_price_centavos` | `integer` not null | `>= 0` |
| `cost_price_centavos` | `integer` not null default 0 | `>= 0` |
| `stock_on_hand` | `integer` not null default 0 | `>= 0` |
| `reserved_qty` | `integer` not null default 0 | `>= 0` and `<= stock_on_hand` |
| `available_qty` | `integer` generated | `stock_on_hand - reserved_qty` |
| `low_stock_threshold` | `integer` not null default 3 | `>= 0` |
| `is_active` | `boolean` not null default true | Soft delete |
| `image_path` | `text` | Reserved for phase 2 |
| `created_by` | `uuid` | References `profiles` |
| `updated_by` | `uuid` | References `profiles` |
| `created_at` | `timestamptz` not null | |
| `updated_at` | `timestamptz` not null | |

Indexes: `lower(name)`, `sku`, `category`, GIN on `compatible_models`, `is_active`.

### 10.4 `public.tickets`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `ticket_no` | `text` unique not null | `TK-YYYYMMDD-0001` |
| `type` | `text` not null | `REPAIR` or `SALE` |
| `status` | `text` not null default `'PENDING'` | See transitions |
| `customer_name` | `text` | Optional |
| `bike_model` | `text` | Optional |
| `notes` | `text` | Optional |
| `parts_total_centavos` | `integer` not null default 0 | `>= 0` |
| `labor_total_centavos` | `integer` not null default 0 | `>= 0` |
| `total_centavos` | `integer` generated | `parts + labor` |
| `created_by` | `uuid` not null | References `profiles` |
| `created_at` | `timestamptz` not null | |
| `updated_at` | `timestamptz` not null | |
| `completed_at` | `timestamptz` | |
| `cancelled_at` | `timestamptz` | |
| `cancel_reason` | `text` | |
| `voided_at` | `timestamptz` | |
| `void_reason` | `text` | |

Statuses: `PENDING`, `VERIFYING`, `IN_PROGRESS`, `READY`, `COMPLETED`, `CANCELLED`, `VOIDED`.

The item and labor functions recalculate `parts_total_centavos` and `labor_total_centavos` in the same transaction. The client never supplies totals.

Allowed transitions:

| From | To | Who |
|---|---|---|
| `PENDING` | `VERIFYING`, `IN_PROGRESS`, `CANCELLED` | Staff |
| `VERIFYING` | `IN_PROGRESS`, `CANCELLED` | Staff |
| `IN_PROGRESS` | `READY`, `CANCELLED` | Staff |
| `READY` | `IN_PROGRESS` (rework), `CANCELLED` | Staff |
| Any open status | `COMPLETED` | Only through `complete_ticket` |
| `COMPLETED` | `VOIDED` | Only through `void_sale`, owner |
| `COMPLETED`, `CANCELLED`, `VOIDED` | — | Terminal |

### 10.5 `public.ticket_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `ticket_id` | `uuid` not null | References `tickets` |
| `part_id` | `uuid` not null | References `parts` |
| `part_name_at_time` | `text` not null | Snapshot |
| `qty` | `integer` not null | `> 0` |
| `unit_price_at_time_centavos` | `integer` not null | Snapshot |
| `unit_cost_at_time_centavos` | `integer` not null | Snapshot for margin |
| `line_total_centavos` | `integer` generated | `qty * unit_price` |
| `verified_at` | `timestamptz` | Set by the mechanic |
| `verified_by` | `uuid` | References `profiles` |
| `created_at` | `timestamptz` not null | |

Unique constraint: `(ticket_id, part_id)`. Adding the same part again increases the quantity at the existing snapshot price.

### 10.6 `public.ticket_labor`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `ticket_id` | `uuid` not null | References `tickets` |
| `description` | `text` not null | e.g. "Replace brake pads" |
| `amount_centavos` | `integer` not null | `>= 0` |
| `created_by` | `uuid` not null | References `profiles` |
| `created_at` | `timestamptz` not null | |

### 10.7 `public.ticket_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `ticket_id` | `uuid` not null | References `tickets` |
| `method` | `text` not null | `CASH`, `GCASH`, `MAYA`, `OTHER` |
| `amount_centavos` | `integer` not null | Signed; `<> 0`; negative = refund |
| `reference_no` | `text` | GCash/Maya reference |
| `received_by` | `uuid` not null | References `profiles` |
| `received_at` | `timestamptz` not null | Default `now()`; Manila day derived |
| `note` | `text` | |

Deposits are positive payments on an open ticket. `record_payment` rejects a payment that would exceed the outstanding balance, and rejects payments on completed, cancelled, or voided tickets. Completion requires the sum of payments to equal the ticket total. No credit sales in phase 1.

### 10.8 `public.receipts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `receipt_no` | `text` unique not null | `YYYYMMDD-0001` |
| `ticket_id` | `uuid` not null | References `tickets` |
| `status` | `text` not null default `'ISSUED'` | `ISSUED` or `VOID` |
| `issued_at` | `timestamptz` not null | |
| `issued_by` | `uuid` not null | References `profiles` |
| `snapshot` | `jsonb` not null | Immutable receipt data |
| `total_centavos` | `integer` not null | Copied from the snapshot |
| `verification_hash` | `text` not null | Full HMAC-SHA256 hex |
| `verification_code` | `text` not null | 16 hex chars, grouped `XXXX-XXXX-XXXX-XXXX` |
| `public_token` | `text` unique not null | 128-bit random hex |
| `voided_at` | `timestamptz` | |
| `voided_by` | `uuid` | References `profiles` |
| `void_reason` | `text` | |
| `created_at` | `timestamptz` not null | |

Partial unique index: one `ISSUED` receipt per ticket.

The receipt snapshot contains:

```json
{
  "shop": { "name": "", "address": "", "contact": "", "footer": "" },
  "ticket": {
    "no": "TK-20261115-0001",
    "type": "REPAIR",
    "customer_name": "",
    "bike_model": "",
    "created_at": "2026-11-15T08:00:00Z"
  },
  "items": [
    { "name": "Brake pad", "qty": 2, "unit_price_centavos": 15000, "line_total_centavos": 30000 }
  ],
  "labor": [
    { "description": "Install brake pads", "amount_centavos": 20000 }
  ],
  "totals": { "parts_centavos": 30000, "labor_centavos": 20000, "total_centavos": 50000 },
  "payments": [
    { "method": "CASH", "amount_centavos": 50000, "received_by": "Dad" }
  ],
  "receipt_no": "20261115-0001",
  "issued_at": "2026-11-15T08:30:00Z"
}
```

The snapshot contains no cost prices and no customer phone number.

### 10.9 `public.stock_movements`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `part_id` | `uuid` not null | References `parts` |
| `delta` | `integer` not null | `<> 0` |
| `reason` | `text` not null | `INITIAL`, `RESTOCK`, `ADJUSTMENT`, `SALE`, `RETURN` |
| `ticket_id` | `uuid` | References `tickets` |
| `receipt_id` | `uuid` | References `receipts` |
| `actor_id` | `uuid` not null | References `profiles` |
| `note` | `text` | |
| `created_at` | `timestamptz` not null | |

Append-only. No update or delete grants. The ledger is the source of truth for how a count changed.

### 10.10 `public.audit_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `actor_id` | `uuid` | References `profiles`; null for system |
| `action` | `text` not null | e.g. `ticket.created`, `part.price_changed` |
| `entity_type` | `text` not null | |
| `entity_id` | `uuid` | |
| `before` | `jsonb` | |
| `after` | `jsonb` | |
| `created_at` | `timestamptz` not null | |

Append-only. Owner-only read.

### 10.11 `public.day_closes`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `business_date` | `date` unique not null | Manila date |
| `expected_cash_centavos` | `integer` not null | From payments |
| `counted_cash_centavos` | `integer` not null | Owner input |
| `variance_centavos` | `integer` generated | Counted minus expected |
| `expected_gcash_centavos` | `integer` not null default 0 | |
| `expected_maya_centavos` | `integer` not null default 0 | |
| `expected_other_centavos` | `integer` not null default 0 | |
| `notes` | `text` | |
| `closed_by` | `uuid` not null | References `profiles` |
| `closed_at` | `timestamptz` not null | |

One close per business date. The owner may update the counted amount and notes; the change is audited.

### 10.12 `public.shop_settings`

Single row (`id = 1`): `shop_name`, `address`, `contact`, `receipt_footer`, `low_stock_default`, `timezone` (`Asia/Manila`), `currency` (`PHP`), `updated_at`, `updated_by`.

### 10.13 Private schema

- `private.ticket_counters(day date PK, next_no integer)`.
- `private.receipt_counters(day date PK, next_no integer)`.
- `private.app_secrets(key text PK, value text)` — holds `receipt_hmac_key`.
- `private.is_staff()`, `private.is_owner()` — security-definer helpers used by RLS.
- `private.next_ticket_no()`, `private.next_receipt_no()` — daily numbering.
- `private.receipt_hmac(...)` — computes the receipt code.

No grants to `anon` or `authenticated` on the `private` schema. Only security-definer functions may access it.

### 10.14 Views

- `v_open_tickets` — open tickets with totals and paid balance.
- `v_low_stock` — active parts where `available_qty <= low_stock_threshold`.
- `v_ticket_balances` — ticket total, paid, and balance.

Views use `security_invoker = true` so RLS applies to the caller.

---

## 11. Database functions (RPCs)

All functions are `security definer` with `search_path = ''` and fully qualified object names. Execute is revoked from `public` and granted explicitly.

| Function | Caller | Purpose |
|---|---|---|
| `create_ticket(p_type, p_customer_name, p_bike_model, p_notes, p_items, p_labor)` | Staff | Create a ticket, reserve stock, snapshot prices |
| `add_ticket_item(p_ticket_id, p_part_id, p_qty)` | Staff | Reserve more stock; merge with an existing line |
| `set_ticket_item_qty(p_ticket_id, p_part_id, p_qty)` | Staff | Adjust a line and its reservation |
| `remove_ticket_item(p_ticket_id, p_part_id)` | Staff | Release the reservation and remove the line |
| `add_ticket_labor(p_ticket_id, p_description, p_amount_centavos)` | Staff | Add a labor line |
| `remove_ticket_labor(p_labor_id)` | Staff | Remove a labor line |
| `verify_ticket_item(p_ticket_id, p_part_id)` | Staff | Mark a part physically verified |
| `verify_all_ticket_items(p_ticket_id)` | Staff | Mark every part verified |
| `update_ticket_status(p_ticket_id, p_status)` | Staff | Move through non-terminal statuses |
| `record_payment(p_ticket_id, p_method, p_amount_centavos, p_reference_no, p_note)` | Staff | Record a deposit or partial payment |
| `complete_ticket(p_ticket_id, p_payments)` | Staff | Take the final payment, deduct stock, issue the receipt; requires all parts verified |
| `cancel_ticket(p_ticket_id, p_reason)` | Staff (no payments); owner (with deposits) | Release reservations; the owner branch records refunds |
| `void_sale(p_receipt_id, p_reason, p_refund_method)` | Owner | Reverse a completed sale in full |
| `create_part(...)` | Owner | Add a catalog part |
| `update_part(...)` | Owner | Edit part details and price |
| `adjust_stock(p_part_id, p_delta, p_reason, p_note)` | Owner | Restock or adjust stock with a ledger row |
| `update_shop_settings(...)` | Owner | Edit shop details |
| `close_day(p_business_date, p_counted_cash, p_notes)` | Owner | Store the daily close |
| `get_daily_summary(p_business_date)` | Owner | Sales, payments, voids, low stock |
| `get_receipt_integrity()` | Owner | Recompute receipt hashes and find number gaps |
| `get_receipt(p_token)` | Anon + staff | Public receipt by token |
| `verify_receipt(p_receipt_no, p_code)` | Anon + staff | Public verification |
| `ping()` | Anon | `select 1` for keep-alive |

Function rules:

- Validate every input: quantity > 0, amount >= 0, valid enum values, trimmed strings with length limits.
- Lock part rows with `FOR UPDATE` in a deterministic order (sorted by `part_id`) to avoid deadlocks.
- Raise errors with stable codes: `INSUFFICIENT_STOCK`, `PAYMENT_MISMATCH`, `TICKET_NOT_OPEN`, `NOT_VERIFIED`, `FORBIDDEN`, `RECEIPT_NOT_ISSUED`.
- Write `audit_events` in the same transaction as the change.
- `complete_ticket` and `void_sale` are the only functions that touch both stock and receipts.
- `cancel_ticket` releases reservations but writes no stock movement because stock was never deducted.
- `void_sale` restores stock and writes `RETURN` movements.

---

## 12. Business rules

### 12.1 Stock

- `available = stock_on_hand - reserved_qty`.
- Adding a part reserves it (`reserved_qty += qty`) in the same transaction.
- Completing a ticket deducts it (`stock_on_hand -= qty`, `reserved_qty -= qty`) and writes a `SALE` ledger row.
- Cancelling releases it (`reserved_qty -= qty`) and writes no ledger row.
- Voiding a sale restores it (`stock_on_hand += qty`) and writes a `RETURN` ledger row.
- Adjustments cannot push `stock_on_hand` below `reserved_qty`.
- The database refuses negative stock.
- No automatic reservation expiry in phase 1: tickets are created by staff, and a repair may wait days for parts. The bay highlights tickets older than 48 hours; the owner can cancel them.
- Part deletions are soft (`is_active = false`). Historical ticket lines use snapshots and remain readable.

### 12.2 Money

- All amounts are integer centavos. No floats.
- The browser sends quantities and IDs, never totals.
- Ticket totals are computed by the database from line items.
- Payments are signed: positive received, negative refunded.
- Completion requires the sum of payments to equal the total.
- Cash tendered and change are display calculations only; the recorded payment is the amount applied to the ticket.
- No credit sales, installments, or split-price discounts in phase 1.
- Receipts are the customer-facing proof of payment.

### 12.3 Tickets

- A ticket is editable only while open.
- Parts must be verified before completion.
- A ticket with no parts is allowed (labor-only).
- A ticket with no parts and no labor is rejected.
- Cancelling an open ticket releases stock. A mechanic may cancel only a ticket with no payments. If a deposit exists, only the owner may cancel; the cancellation function records the refund as a negative payment.
- A completed ticket cannot be edited. Only `void_sale` can reverse it, in full.
- A voided ticket is terminal. A corrected sale is a new ticket.

### 12.4 Receipts

- Issued exactly once per completed ticket (one active receipt).
- The receipt number is a daily sequence with no normal gaps. A missing number is visible in the integrity report.
- The receipt snapshot is immutable. It includes items, labor, totals, payments, customer name/bike, shop details, and timestamps.
- The verification code is an HMAC-SHA256 over `receipt_no | issued_at | total | sha256(snapshot)`.
- The full hash is stored; the displayed code is the first 16 hex characters, grouped.
- The public token is 128 bits of randomness.
- A voided receipt keeps its number and snapshot; status becomes `VOID`.
- The public receipt page shows the original data with a clear VOID banner.
- Screenshots can be edited; the verification page is what exposes the edit. This is stated to the owner in the UI help.
- BIR note: this is a sales receipt, not a BIR "Official Receipt," unless the shop registers it. The owner must confirm with their accountant.

### 12.5 Day close and reporting

- **Sales issued today:** sum of `ISSUED` receipts with `issued_at` on the Manila business date.
- **Parts vs labor:** from the receipt snapshot.
- **Payments received today:** sum of signed `ticket_payments` with `received_at` on the Manila business date, grouped by method.
- **Expected cash:** cash payments minus cash refunds for the business date.
- **Variance:** counted cash minus expected cash.
- **Voids today:** receipts voided on the business date, with the original number and total.
- The day close is a snapshot; it does not block later activity.
- The owner can update the counted amount or notes. The change is audited; the expected amounts are recomputed and stored.

### 12.6 Audit

Logged actions include:

- ticket created, status changed, item added/removed/qty changed, labor added/removed, part verified;
- payment recorded;
- receipt issued, sale voided;
- part created, price changed, stock adjusted;
- shop settings changed;
- day closed or corrected;
- staff role changed.

Each entry stores actor, action, entity, before/after, and timestamp. The audit log and stock ledger cannot be edited or deleted through the app.

---

## 13. Auth, roles, and security

### 13.1 Staff accounts

- Supabase Auth, email + password.
- Public sign-ups disabled. Two accounts created manually.
- A trigger creates a `profiles` row; the owner role is assigned deliberately.
- Password reset uses Supabase email. For two users, a manual dashboard reset is an acceptable fallback.

### 13.2 PIN lock

- After first login, each user sets a 4-digit PIN.
- The PIN is stored locally as salted SHA-256 via Web Crypto. It never reaches the server.
- The app locks after 5 minutes of idle time (configurable 1–30 minutes) or when the user taps Lock.
- Five wrong attempts force a full sign-out.
- The PIN is a convenience lock, not the security boundary. The session and database roles are the boundary.
- A lost device: change the password and revoke sessions from the Supabase dashboard. Runbook step.

### 13.3 RLS and grants

- RLS enabled on every table; default deny.
- `anon` has no table access and may execute only `ping`, `get_receipt`, and `verify_receipt`.
- `authenticated` may select staff-readable tables and execute staff functions.
- No direct insert/update/delete on `tickets`, `ticket_items`, `ticket_labor`, `ticket_payments`, `receipts`, `stock_movements`, `audit_events`, or `day_closes`.
- `parts` and `shop_settings` writes go through owner functions.
- Security-definer functions set `search_path = ''` and fully qualify every object.
- Revoke `execute` from `public`; grant explicitly to `authenticated` or `anon`.

### 13.4 Secrets

- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` ship to the browser. They are public by design.
- The Supabase service-role key is never in `src/` or any client bundle. It is used only in CI and admin scripts.
- The receipt HMAC secret lives in `private.app_secrets`, readable only by definer functions. A copy is stored in GitHub Actions secrets for disaster recovery.
- `.env.local` is gitignored. `.env.example` documents the variables.
- No secrets in logs, screenshots, issues, or commits.

### 13.5 Public endpoints

- `get_receipt(token)` returns one receipt snapshot for an unguessable token. It returns no other rows.
- `verify_receipt(receipt_no, code)` returns only status, date, total, and payment method. A wrong code returns `valid: false`.
- The verification code is 64 bits, so online guessing is impractical. If abuse appears, add per-IP throttling.
- Receipt and verify pages use the shop's official URL. The UI warns that a look-alike site is not the shop's system.

### 13.6 Input validation and errors

- Client: zod for UX.
- Server: PostgreSQL constraints plus function validation. The server is the source of truth.
- Strings trimmed and length-limited; names max 120 chars, notes max 500.
- No `dangerouslySetInnerHTML`.
- CSV exports escape formula injection (`=`, `+`, `-`, `@`, tab, CR).
- The client maps database error codes to friendly messages; it never displays raw SQL errors.
- Unexpected errors are logged; optional Sentry free tier in production.

---

## 14. E-receipt and verification

### 14.1 Receipt number

- Format: `YYYYMMDD-0001`, based on the Manila business date.
- The counter lives in `private.receipt_counters` and increments inside the completion transaction.
- A rolled-back transaction rolls back the counter, so normal operation has no gaps.
- Deleted or missing numbers are visible in the owner's integrity report.

### 14.2 Verification code

- Input: `receipt_no | issued_at (UTC canonical) | total_centavos | sha256(snapshot::text)`.
- Key: 32 random bytes in `private.app_secrets`.
- Full HMAC-SHA256 stored in `verification_hash`.
- Displayed code: first 16 hex characters, uppercase, grouped `XXXX-XXXX-XXXX-XXXX`.
- Any change to the amount, date, items, labor, payments, or customer details in the snapshot changes the hash, so the displayed code no longer matches.

### 14.3 Public receipt page

- Route: `/r/:token`.
- Calls `get_receipt(token)`.
- Shows shop details, receipt number, date/time, customer/bike (if entered), items, labor, totals, payments, verification code, and status.
- A VOID receipt shows a red VOID banner and the reason.
- A "Save as PDF" button uses browser print. No printer is required.
- A "Copy Link" button copies the same URL.

### 14.4 Verify page

- Route: `/verify`.
- Fields: receipt number and code.
- On success: `Valid`, date/time, total, payment method, and status.
- On a voided receipt: `Void`, original total, and reason.
- On mismatch: `No match`.
- No customer name, no item list, no phone number.

### 14.5 QR delivery

- The completion screen renders a QR for the receipt URL using `qrcode.react`.
- The customer scans it with the phone camera.
- If the customer cannot scan, staff taps Copy Link and sends it through Messenger or SMS manually.
- No email or SMS integration in phase 1.

### 14.6 Integrity report

- Owner-only.
- Recomputes every receipt hash and compares it to the stored hash.
- Lists mismatches.
- Lists missing receipt numbers per business date.
- Lists voided receipts.
- This is the "no loopholes" check: even a database-level edit is visible.

---

## 15. Offline and PWA behavior

- The app is installable and loads its shell offline.
- Supabase requests are never cached. No prices, tickets, or PII are stored by the service worker.
- Offline: a persistent banner, disabled write actions, and a "Reconnect" state. The app never claims a sale succeeded offline.
- A 60-second poll plus refetch on focus/reconnect keeps the bay queue fresh if the websocket drops.
- Updates prompt the user; the app does not reload while a ticket form is open.
- Phase 2 camera scanning requires HTTPS and user permission. Test on the actual Android and iPhone devices before promising it.

---

## 16. Error handling

| Code | User message |
|---|---|
| `INSUFFICIENT_STOCK` | "Only N left of [part]. Reduce the quantity or restock." |
| `PAYMENT_MISMATCH` | "Payments do not match the total. Balance: ₱X." |
| `TICKET_NOT_OPEN` | "This ticket is already closed." |
| `NOT_VERIFIED` | "Verify all parts before completing the ticket." |
| `FORBIDDEN` | "Only the owner can do this." |
| `RECEIPT_NOT_ISSUED` | "This sale has no active receipt." |
| `ALREADY_COMPLETED` | "This ticket is already completed." |
| `NETWORK` | "No connection. Nothing was saved." |
| `UNKNOWN` | "Something went wrong. Try again; if it persists, contact Sean." |

- Mutations show a pending state and disable the button.
- No optimistic updates for stock, payments, or receipts.
- Every screen has loading, empty, and error states.
- A React error boundary prevents a blank screen.
- Optional Sentry free tier for unexpected errors; the DSN is public and safe.

---

## 17. Testing

### 17.1 Unit (Vitest)

- Money parsing and formatting (centavos, commas, invalid input).
- Manila date boundaries and display.
- CSV escaping and formula-injection protection.
- Error-code mapping.
- PIN hashing and attempt logic.
- Form schemas.

### 17.2 Database integration (Vitest + local Supabase)

- Create ticket reserves stock; over-reservation fails.
- Concurrent adds cannot oversell (two sessions).
- Complete deducts stock, writes ledger rows, issues one receipt.
- Payment mismatch blocks completion.
- Unverified parts block completion.
- Cancel releases reservations and refunds deposits.
- Void sale restores stock, records a refund, marks receipt/ticket VOID.
- Receipt snapshot and HMAC verify; a changed snapshot fails.
- Receipt numbers are sequential per day; no normal gaps.
- Completed tickets, items, payments, receipts, ledger, and audit rows are immutable.
- RLS: anon cannot read tickets; mechanic cannot void or adjust stock; owner can; mechanic can read parts.
- Direct table writes are denied.
- Daily close expected cash matches payments.
- Integrity report detects a tampered hash and a missing number.

### 17.3 End-to-end (Playwright)

1. Mechanic logs in, creates a ticket, adds a part and labor, verifies, completes with cash.
2. Receipt page opens from the QR/link; verify page returns Valid.
3. Stock decreased by the quantity; ledger row exists.
4. Owner logs in, sees the sale, closes the day with counted cash, exports CSV.
5. Mechanic cannot open owner routes or call owner actions.
6. PWA manifest and service worker register; offline banner appears when the network is blocked.

### 17.4 CI

- Typecheck, lint, format check, unit tests, build.
- Database tests with `supabase start` (Docker is available on GitHub's Ubuntu runners).
- E2E on pull requests and `main`.
- Generated database types are current: regenerate and fail if the file changed.
- No test touches production.

---

## 18. Deployment and operations

### 18.1 Supabase

- Two projects: `staging` and `production`.
- Migrations live in `supabase/migrations`; applied with the Supabase CLI.
- No schema changes in the dashboard. Emergency manual changes must be captured as a migration immediately.
- Types generated with `supabase gen types typescript` and committed.
- Free-tier limits: 500MB database, 1GB storage, 5GB egress, 2 active projects. The shop is far below these.
- A daily keep-alive calls `ping()` so the project never pauses.
- Nightly `pg_dump` backup from GitHub Actions; 90-day artifacts plus a monthly archive in a private repository.
- Quarterly restore drill into staging; the runbook records the steps.
- If the project pauses: restore from the Supabase dashboard within one year; then investigate why the keep-alive failed.
- If the free tier becomes unacceptable, the upgrade is Supabase Pro at $25/month. The data remains portable PostgreSQL.

### 18.2 Cloudflare

- `wrangler.jsonc` serves `dist/` as static assets with SPA fallback.
- Deploy from `main` after CI passes.
- Rollback by redeploying the previous commit or `wrangler rollback`.
- Optional custom domain. The final URL must be chosen before launch because receipt QR codes point to it.
- No Workers functions, no server code, no paid image optimization. Images are client-compressed in phase 2.

### 18.3 GitHub Actions

- `ci.yml`: verify on every PR and push to `main`.
- `deploy.yml`: deploy to Cloudflare on `main` after verification.
- `backup.yml`: nightly database dump; monthly archive.
- `keepalive.yml`: daily `ping()`.
- Secrets: Supabase access token, database password, project refs, production DB URL, Cloudflare API token and account ID, receipt HMAC backup.
- Dependabot monthly for npm and GitHub Actions.

### 18.4 Monitoring

- UptimeRobot free tier: monitor the app URL and the Supabase `ping()` endpoint every 5 minutes; alert by email.
- Optional Sentry free tier for frontend errors.
- Cloudflare analytics is optional and privacy-friendly.
- No customer analytics or trackers in phase 1.

### 18.5 Runbook

`docs/runbook.md` covers deploy, rollback, migrations, backup, restore, paused database, lost device, key rotation, adding staff, closing the day, and the integrity check.

---

## 19. Repository structure

```text
.
├── src/
│   ├── app/                 # providers, router, layout
│   ├── components/ui/       # shadcn primitives only
│   ├── features/
│   │   ├── auth/
│   │   ├── bay/
│   │   ├── inventory/
│   │   ├── owner/
│   │   ├── receipts/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/                 # supabase, money, dates, csv, errors, print, pin
│   ├── routes/              # thin page components
│   ├── styles/
│   └── types/               # database.types.ts (generated) + domain types
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── tests/
│   ├── unit/
│   ├── db/
│   └── e2e/
├── docs/
│   ├── spec.md
│   ├── runbook.md
│   └── decisions/
├── public/
├── .github/
│   ├── workflows/
│   └── pull_request_template.md
├── AGENTS.md
├── README.md
├── .env.example
├── .editorconfig
├── .gitignore
├── eslint.config.js
├── .prettierrc
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.jsonc
```

Feature folders contain their own `components/`, `hooks/`, `api.ts`, and `schemas.ts`. Cross-feature code goes in `src/lib` or `src/hooks` only when it genuinely serves more than one feature.

---

## 20. Phase plan

### Phase 0 — Foundation

- Repository, tooling, CI, docs, Supabase projects, migrations baseline, app shell, auth, layout.

### Phase 1a — Inventory

- Parts table, search, add/edit, restock/adjust, ledger, low stock, owner permissions.

### Phase 1b — Bay

- Ticket creation, part search and add, labor, reservation, statuses, verification, realtime queue.

### Phase 1c — Money and receipts

- Deposits, completion, payment validation, stock deduction, receipt snapshot, HMAC, public receipt, verify page, void sale.

### Phase 1d — Owner

- Dashboard, sales list, day close, CSV export, audit log, integrity report, settings.

### Phase 1e — Launch

- PWA polish, backups, keep-alive, UptimeRobot, UAT with Dad and Uncle, training notes, production deploy.

### Phase 2 — Growth

- Customer storefront, cart, QR ticket pass, scanner, part photos, partial returns, bulk CSV import, optional email delivery.

---

## 21. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Supabase free project pauses or has an outage | Daily keep-alive, nightly backups, runbook, exportable PostgreSQL |
| Free-tier limits reached | The shop is far below 500MB/1GB; monitor monthly |
| Staff make pricing or entry mistakes | Snapshots, confirmation before completion, audit, whole-sale void |
| A receipt screenshot is edited | Verification code + live verify page + integrity report |
| Receipt HMAC secret lost | Copy in GitHub Actions secrets; restore procedure in the runbook |
| Lost or shared device | PIN lock, short idle lock, password change, session revocation |
| Staff resist a new workflow | Bay-first design, 48px targets, under-one-minute ticket, training with Dad and Uncle |
| QuickBooks Desktop cannot import the CSV directly | The export is a report; use a third-party importer or manual entry; clarify with the accountant |
| BIR receipt requirements | Call it a sales receipt; confirm with the accountant before claiming official-receipt status |
| No printer at launch | E-receipt is primary; print/PDF is a fallback; 58mm support later |
| One-person maintenance | Small scope, no framework treadmill, ADRs, runbook, CI |
| Camera/scanner issues in phase 2 | Test on the actual phones; manual ticket-number fallback |

---

## 22. Open decisions

1. Final shop name, address, contact, and receipt footer.
2. Final app URL: free `*.workers.dev` or a custom domain the family already owns.
3. Whether Maya is actually used, or only cash and GCash.
4. Whether the shop takes downpayments regularly (supported) or always pays at completion.
5. Whether partial returns or exchanges are needed at launch (currently phase 2).
6. BIR status and whether a separate official receipt is required.
7. Whether the family wants a thermal printer later (58mm/80mm) or A4 only.
8. Optional Sentry and UptimeRobot accounts.

---

## 23. Glossary

- **Ticket** — a job or over-the-counter sale. It holds parts, labor, payments, and a status.
- **Receipt** — the immutable proof of a completed sale, with a number and verification code.
- **Reserved** — stock set aside for an open ticket but not yet sold.
- **Available** — stock on hand minus reserved.
- **Snapshot** — a frozen copy of a price or receipt at a point in time.
- **Void sale** — a full reversal of a completed sale, owner-only.
- **Day close** — the owner's snapshot of sales, payments, expected cash, counted cash, and variance.
- **RPC** — a PostgreSQL function called from the browser; the only way to write transactional data.
- **RLS** — Row Level Security; PostgreSQL rules that decide which rows a user can see or change.
- **PWA** — an installable web app with an offline shell.
- **HMAC** — a keyed hash that only the database can produce; it makes receipt edits detectable.
- **Anon key** — the public Supabase key used by the browser. It is safe only because RLS and functions restrict it.
- **Service role key** — the secret Supabase key that bypasses RLS. It never ships to the browser.
