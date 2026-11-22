# Sales Log and QuickBooks Monthly Interchange — Design

**Status:** Draft for approval
**Date:** 2026-11-22
**Owner:** Sean
**Supersedes:** the inventory/stock and repair-ticket flow in `docs/spec.md` for phase 1. The existing spec stays in the repo until this design is approved, then it is updated to match.

---

## 1. Plain-English summary

This is a **daily sales log**, not an inventory system.

- Dad and Uncle record each customer order: date, items, quantity, price, labor, and payment.
- The item list comes from QuickBooks. The app does not track stock.
- Parts money belongs to the shop. Labor money belongs to the person who did the work.
- One order can have multiple items and up to two workers.
- The main user types the total labor and, if someone helped, the helper’s share. The system gives the rest to the main user.
- Customers can pay cash, GCash, or both. GCash goes to a personal account; the app tracks who received it and how much of it belongs to the shop.
- Customers can leave extra change. It goes to labor, defaulting to the main user.
- Dad and Uncle have the same access.
- At month end, the app settles GCash, exports the month’s **parts sales** to QuickBooks as IIF, and locks the month.
- QuickBooks remains the official stock and accounting record. Labor stays in our app and is not exported.
- A reconciliation screen compares our totals with QuickBooks totals.

---

## 2. Goals

1. Replace the paper daily record book with a fast phone-friendly log.
2. Show daily sales, labor per user, cash, and GCash clearly.
3. Never lose track of who earned labor or who is holding shop GCash.
4. Export a month of parts sales to QuickBooks without retyping.
5. Keep QuickBooks aligned with our totals through a reconciliation screen.
6. Be simple enough for two users with the same access.
7. Keep the existing login, PWA shell, design system, deployment, and backups.

## 3. Non-goals

- Stock tracking, reservations, or stock ledgers in our app.
- Purchase orders, suppliers, receiving, or warehouse locations.
- Customer accounts, online ordering, or a storefront.
- Payroll, tax computation, or full accounting.
- Direct live integration with QuickBooks.
- Partial returns or exchanges.
- Owner/mechanic permission split. Both users have the same access.
- Historical sales import into the app.

---

## 4. Users and access

| Person | Login | Access |
|---|---|---|
| Dad | `JJA-001` | Everything in the new sales log |
| Uncle | `JJA-002` | Everything in the new sales log |

- Both can create, view, edit, and export.
- Both can add extras, record payments, and record GCash transfers.
- No owner-only screens in the new module.
- Authentication remains Supabase Auth. Roles in the old `profiles` table remain for compatibility but are not used by the new module.
- The old inventory, bay, and owner routes are removed from navigation and replaced by the new module.

---

## 5. Daily flow

1. Open **Orders**. Today is selected by default.
2. Tap **New order**.
3. Optional: customer name and motorcycle.
4. Add items:
   - search the catalog,
   - choose an item,
   - quantity,
   - price fills from the item list and can be changed for this order only.
5. If the item is missing from the catalog, add a **custom line**: name, quantity, price. It is marked “not in QuickBooks.”
6. Enter the **total labor**.
7. If a helper worked:
   - choose the helper,
   - enter only the helper’s share,
   - main user gets `total labor − helper share`.
8. Payment:
   - one or more payments,
   - each is Cash or GCash,
   - each GCash payment records who received it,
   - enter change, with its method,
   - optional extra, default main user.
9. Review screen shows items, labor split, payments, change, extra, totals.
10. Save.
11. Optional: share a digital receipt link/QR.

Orders stay editable while the month is open.

---

## 6. Screens and routes

| Route | Purpose |
|---|---|
| `/orders` | Daily list, date picker, daily totals, full breakdown toggle |
| `/orders/new` | Create an order |
| `/orders/:id` | View/edit an order, share receipt |
| `/items` | Searchable QuickBooks item/price list; import updated list |
| `/reports` | Daily and monthly reports, labor per user, breakdown |
| `/reports/gcash` | GCash held and transfers |
| `/quickbooks` | Month close, export preview, export history, reconciliation |
| `/settings` | Shop details and QuickBooks mapping |
| `/r/:token` | Public digital receipt (optional) |

Navigation: **Orders**, **Items**, **Reports**, **QuickBooks**, **Settings**.

---

## 7. Data model

### 7.1 `catalog_items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text unique | QuickBooks item name |
| `description` | text | Optional, max 300 |
| `sku` | text nullable | MPN when present |
| `base_price_centavos` | integer | >= 0 |
| `item_type` | text | Default `INVENTORY_PART` |
| `income_account` | text | QuickBooks mapping |
| `cogs_account` | text | QuickBooks mapping |
| `asset_account` | text | QuickBooks mapping |
| `preferred_vendor` | text | Optional |
| `is_active` | boolean | Default true |
| `source` | text | `quickbooks` |
| `imported_at` | timestamptz | |
| `updated_at` | timestamptz | |

No stock columns. Search index on `lower(name)` and description.

### 7.2 `sales_orders`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_no` | text unique | `SL-YYYYMMDD-0001` |
| `business_date` | date | Today or past; no future |
| `customer_name` | text nullable | max 120 |
| `bike_model` | text nullable | max 120 |
| `main_user_id` | uuid | Creator/main worker |
| `helper_user_id` | uuid nullable | Second worker |
| `parts_total_centavos` | integer | Recalculated by DB |
| `labor_total_centavos` | integer | Total labor typed |
| `total_centavos` | integer generated | parts + labor |
| `status` | text | `OPEN` or `EXPORTED` |
| `created_by` | uuid | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `reviewed_by` | uuid nullable | Verify/review step |
| `reviewed_at` | timestamptz nullable | |
| `public_token` | text unique nullable | Digital receipt |

### 7.3 `sales_order_items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | |
| `catalog_item_id` | uuid nullable | Null for custom lines |
| `item_name_at_time` | text | Snapshot |
| `qty` | integer | > 0 |
| `unit_price_at_time_centavos` | integer | Snapshot, >= 0 |
| `line_total_centavos` | integer generated | qty × price |
| `is_custom` | boolean | Not in QuickBooks |

Repeated catalog items are merged into one line and the quantity is increased. Custom lines are always separate.

### 7.4 `sales_labor`

One row per worker per order.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | |
| `user_id` | uuid | |
| `amount_centavos` | integer | >= 0 |
| `is_main` | boolean | |
| `created_at` | timestamptz | |

Rule: `sum(sales_labor.amount) = sales_orders.labor_total_centavos`.

### 7.5 `sales_extras`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | |
| `user_id` | uuid | Who receives the extra |
| `amount_centavos` | integer | > 0 |
| `note` | text nullable | |
| `created_by` | uuid | |
| `created_at` | timestamptz | |

Default recipient is the main user; can be changed to the helper.

### 7.6 `sales_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid | |
| `method` | text | `CASH` or `GCASH` |
| `amount_centavos` | integer | > 0 |
| `gcash_recipient_id` | uuid nullable | Required for GCash |
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
| `created_by` | uuid | |
| `created_at` | timestamptz | |

### 7.8 `gcash_transfers`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | Whose personal GCash |
| `amount_centavos` | integer | > 0 |
| `destination` | text | `SHOP_BANK` or another user |
| `counterparty_user_id` | uuid nullable | For user-to-user transfer |
| `reference` | text nullable | Bank reference |
| `note` | text nullable | |
| `created_by` | uuid | |
| `created_at` | timestamptz | |

### 7.9 `month_exports`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `month` | date | First day of month, unique |
| `status` | text | `LOCKED` |
| `file_name` | text | |
| `checksum` | text | SHA-256 of the IIF file |
| `exported_by` | uuid | |
| `exported_at` | timestamptz | |
| `carry_reason` | text nullable | If GCash was carried forward |

### 7.10 `reconciliations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `business_date` | date | |
| `method` | text | `CASH` or `GCASH` |
| `app_total_centavos` | integer | From our exported totals |
| `qb_total_centavos` | integer | Typed from QuickBooks |
| `difference_centavos` | integer generated | QB minus app |
| `checked_by` | uuid | |
| `checked_at` | timestamptz | |
| unique | `(business_date, method)` | |

### 7.11 Existing tables

- `profiles` stays for auth.
- `audit_events` stays and is reused.
- `shop_settings` stays for shop details and QuickBooks mapping. New columns:
  - `quickbooks_cash_account`
  - `quickbooks_gcash_account`
  - `quickbooks_sales_tax_code`
  - `quickbooks_item_imported_at`
- `private.sales_order_counters(day date primary key, next_no integer)` for `SL-YYYYMMDD-0001`.
- Old inventory/ticket/receipt tables stay until the new module is approved and deployed. They are not used by the new screens. A later cleanup migration may drop them after a backup.

---

## 8. Money and labor rules

- All money is integer **centavos**.
- The database computes every total. The client sends quantities, IDs, and amounts; never a total.
- `parts_total = sum(line_total)`.
- `customer_total = parts_total + labor_total`.
- Labor:
  - main user gets `labor_total − helper_share`;
  - helper gets `helper_share`;
  - helper share cannot exceed labor total.
- Extras:
  - are separate from the order total;
  - go to the chosen user;
  - default to the main user;
  - are included in labor payout for the day.
- Payments:
  - sum of payments must be at least `customer_total + extras`;
  - `change = payments − customer_total − extras`;
  - change cannot be negative;
  - change has its own method and is selected each time.
- Daily cash/GCash:
  - `net_method = payments_by_method − change_by_method`.
  - The shop’s parts total and the labor payout are allocated across methods proportionally to `net_method`.
  - Residual centavos are assigned deterministically to the main method (cash first, then GCash) so the sum always matches exactly.
  - The export preview can override the allocation.

---

## 9. GCash held and settlement

- Every GCash payment records its recipient.
- Each GCash payment is split into:
  - shop share,
  - labor share (including extras).
- The recipient holds the shop share until it is transferred to the shop bank.
- If the recipient is not the labor user, the app shows a **user-to-user settlement** as well.
- `gcash_transfers` reduces the held balance.
- At any time, the app shows:
  - shop GCash held by Dad,
  - shop GCash held by Uncle,
  - labor GCash held for the other user, if any.
- Month close requires shop GCash held to be zero, unless a deliberate **Carry forward** with a written reason is recorded.

---

## 10. Month close and QuickBooks export

### Checklist

1. All orders are reviewed.
2. Custom items are resolved or explicitly carried.
3. Shop GCash held is zero, or carry-forward reason is recorded.
4. Export preview is checked.
5. Export and lock.

### Export

- One **IIF** file per month.
- Contains **parts sales only**.
- One QuickBooks sales receipt per day per payment method:
  - cash day → one cash receipt;
  - GCash day → one GCash receipt;
  - both → two receipts.
- Item names must match QuickBooks catalog names.
- Custom items block export until resolved or explicitly carried.
- The file uses QuickBooks account/tax mappings from Settings.
- The file is saved with a checksum and export timestamp.
- After export, the month is read-only. Corrections are made in QuickBooks.
- Labor is never included in the QuickBooks file.

### Reconciliation

- For each day and method, compare:
  - our exported total,
  - the QuickBooks total (typed manually in v1).
- Status: **Aligned**, **Difference**, **Not checked**.
- A later version can import a QuickBooks CSV report to fill the QuickBooks side automatically.

---

## 11. Item catalog

- Imported from a QuickBooks Item List CSV.
- Only active items are imported.
- Fields: name, description, SKU/MPN, base price, item type, income/COGS/asset accounts, preferred vendor.
- No stock quantities.
- Permanent item changes happen in QuickBooks first, then the item list is re-imported.
- Per-order price override is allowed; it does not change the catalog.
- Missing items can be added as custom lines on an order and are flagged.
- The catalog import is idempotent by item name.

---

## 12. Digital receipt

- Optional per order.
- Public link and QR.
- Shows:
  - shop details,
  - order number and date,
  - items and quantities,
  - labor total,
  - total,
  - payment method(s),
  - optional customer/bike.
- Never shows the internal labor split, costs, or customer contact details.
- No customer account.
- The public page is read-only and uses a random token.

---

## 13. Security and RLS

- Staff must be signed in.
- Both staff have the same access.
- All writes go through database functions. No direct table writes from the client.
- RLS default deny on every new table.
- Public receipt access only through a narrowly scoped function by token.
- Audit every order, labor, extra, payment, change, transfer, export, and reconciliation.
- The month lock is enforced in the database, not only in the UI.
- No secrets in the browser.

---

## 14. Error handling

Stable codes and human messages:

- `ORDER_LOCKED` — “This month is already exported. Fix it in QuickBooks.”
- `INVALID_LABOR_SPLIT` — “The helper’s share cannot be more than the total labor.”
- `PAYMENT_MISMATCH` — “Payments do not match the total and extra.”
- `CHANGE_TOO_LARGE` — “Change cannot be more than the payments.”
- `GCASH_NOT_SETTLED` — “Transfer the shop’s GCash before closing the month.”
- `CUSTOM_ITEM_UNRESOLVED` — “Add the custom item to QuickBooks or carry it forward.”
- `ITEM_NOT_FOUND` — “This item is no longer in the catalog.”

Every mutation shows pending, success, and error states. No raw SQL errors reach the UI.

---

## 15. Testing

### Unit

- money parsing and centavos
- labor split
- extra assignment
- payment/change math
- proportional cash/GCash allocation
- month lock dates
- QuickBooks IIF line generation
- CSV item import mapping

### Database

- order create/edit/snapshot
- labor split validation
- extra assignment
- multiple payments and change
- GCash held and transfers
- month close blocks with unsettled GCash
- export locks the month
- RLS: staff only, no direct writes
- reconciliation difference

### End-to-end

- create order with items and labor
- helper split
- mixed cash/GCash payment
- extra
- daily and monthly totals
- GCash transfer
- month export and lock
- digital receipt opens
- QuickBooks IIF file downloads

---

## 16. Rollout

1. Add the new tables and functions in a migration.
2. Import the active QuickBooks item list.
3. Build the new module behind the new routes.
4. Remove the old inventory/bay/owner navigation.
5. Keep old tables and data until the new flow is approved.
6. After approval and a backup, add a cleanup migration to drop unused old tables.
7. Deploy through the existing CI and Cloudflare workflow.

---

## 17. Open decisions

1. QuickBooks account names for cash and GCash.
2. QuickBooks sales tax code (VAT or non-VAT).
3. Exact IIF header format for QuickBooks Enterprise 13.
4. Whether inactive QuickBooks items should be imported (recommended: no).
5. Whether custom items are blocked at export or allowed with a carry note.
6. Digital receipt verification: simple link only, or also a verification code.
7. Weekly vs monthly GCash settlement reminders.

---

## 18. Acceptance criteria

- Both users can create an order with multiple items, labor, helper split, mixed payments, change, and extra.
- Parts money, labor money, and extras are reported separately.
- Daily and monthly reports match the orders.
- GCash held per person is visible and transfers reduce it.
- A month cannot be locked until GCash is settled or a reason is recorded.
- The QuickBooks IIF file contains one daily receipt per payment method, parts only.
- QuickBooks stock is reduced by the imported sales.
- A locked month cannot be edited.
- Reconciliation shows Aligned or Difference.
- The digital receipt opens from a link/QR and shows parts, labor, total, payment method, and optional customer/bike.
- Both users have the same access.
- No stock screens or stock tracking in the new module.
