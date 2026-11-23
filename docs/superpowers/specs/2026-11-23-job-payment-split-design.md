# Job / Payment Split and Staff Names — Design

**Date:** 23 November 2026
**Status:** Approved direction; implementation plan follows.
**Supersedes:** the one-step paid-order flow in `docs/spec.md` section 5.

## 1. Problem

The order form currently mixes job details and payment on one long page, and a balanced payment is required before saving. In the shop, the job is recorded first and the customer pays after the repair is finished. Staff also find “Dad” and “Uncle” confusing because those are relationship labels, not the people’s names.

## 2. Goals

- Split the order into **Step 1: Job** and **Step 2: Payment**.
- Let Step 1 save an **Open / Unpaid** order without payment.
- Show the buyer a clear **Job total = parts + labor** on Step 1.
- Record payment later, with extras, cash/GCash, change, and a payment date.
- Count sales, labor, GCash, and receipts on the **payment date**.
- Rename the staff accounts to **Aldwin** (`JJA-001`) and **Magma** (`JJA-002`).
- Show **You** wherever the signed-in person is an option, so they always know which choice is theirs.
- Keep the UI simple enough for a phone at the counter.

## 3. Non-goals

- Deposits or partial payments.
- Refunds, void sales, or unpaying a paid order.
- Credit balances or customer accounts.
- Public quotation links for unpaid jobs.
- QuickBooks export and month lock. Those remain the next step.

## 4. Lifecycle

| Status | Meaning |
|---|---|
| `OPEN` | Job saved. No payment. `paid_on` is null. |
| `PAID` | Payment recorded. `paid_on` is the Manila payment date. |
| `EXPORTED` | Later QuickBooks export; read-only. |

Rules:

- An open job can be edited freely.
- A paid order can be edited, but items/labor/extras and payment must balance before saving.
- A paid order cannot become unpaid through the normal form.
- An exported order is locked.
- Only paid orders appear in sales reports, labor payout, GCash allocations, and public receipts.
- Unpaid jobs live in the **Open jobs** section until paid.

## 5. Step 1 — Job

Route: `/orders/new`

Fields:

- Date (job date), customer, motorcycle
- Items with quantity and per-order price
- Custom lines
- Total labor, helper, helper share
- **Job total card**: Parts, Labor, **Job total = parts + labor**

Actions:

- **Save order**
- Validation requires at least one item or labor.
- No payment, change, or extras fields.
- On success, return to `/orders`; the job appears under **Open jobs** with status Unpaid.
- The receipt is not shareable yet.

The job date owns the order number (`SL-YYYYMMDD-0001`). Moving the job date renumbers it.

## 6. Step 2 — Payment

Opened from:

- **Take payment** on an open job row, or
- the **Payment** tab on the order detail page.

Fields:

- Payment date: defaults to today; past allowed; future disabled; cannot be before the job date.
- Multiple cash/GCash payments, each with a GCash recipient.
- Change is calculated automatically: cash first, then GCash from the people who received it.
- Optional extras/tips after the payment; recipient defaults to the main worker, helper can be chosen; an extra reduces the change.
- **Total to pay = job total + extras**
- Payments, change, balance.

Actions:

- **Record payment** is enabled only when the balance is exactly zero.
- On success, status becomes Paid, `paid_on` is saved, and the receipt link becomes available.
- If a paid order is edited and the total changes, the payment must be rebalanced before the save succeeds.

## 7. Orders screen

- **Open jobs** section at the top:
  - All unpaid jobs from any date, oldest first.
  - Count and total unpaid.
  - Job date, order number, customer/bike, workers, job total.
  - **Take payment** action.
  - **Delete** action for an unpaid job, with a confirmation; paid jobs cannot be deleted.
- **Paid sales** section:
  - Filtered by the selected payment date.
  - Summary cards: parts, labor, cash net, GCash net, order count.
  - Labor per person.
  - Each row shows paid status and total.
- Date picker label: **Sales paid on**.
- Empty states:
  - No open jobs: “No jobs waiting for payment.”
  - No paid sales: “No paid sales on this date.”

## 8. Reports and receipts

- Daily and monthly reports group by `paid_on`.
- Labor per person uses paid orders.
- GCash allocations and held balances use paid orders.
- Monthly table labels the date as the payment date.
- A public receipt exists only for `PAID` or `EXPORTED` orders.
- The receipt shows the job date and the payment date.
- The share button is hidden or disabled until the order is paid.

## 9. Staff names and “You”

Accounts:

- `JJA-001` → **Aldwin**
- `JJA-002` → **Magma**

Display rules:

- In staff selectors (main worker, helper, extras recipient, GCash recipient, transfer from/received by), the current user is labelled **You**.
- In order rows, labor reports, and GCash cards/history, the current user is labelled **You**; the other person keeps their name.
- The shell identity (“Signed in as” and employee ID) keeps the real name so the account is never ambiguous.
- Reports and future CSV exports must use the real names in stored/exported data; “You” is a UI label only.
- The database stores user IDs, never “You”.

## 10. Data model

Add to `sales_orders`:

- `paid_on date nullable`
- `status` check becomes `OPEN`, `PAID`, `EXPORTED`
- check: `OPEN` has null `paid_on`; `PAID`/`EXPORTED` have non-null `paid_on`
- check: `paid_on is null or paid_on >= business_date`
- index on `paid_on`

Backfill:

- Existing orders with payments become `PAID` with `paid_on = business_date`.
- Existing orders without payments stay `OPEN` (there should be none from the old flow).

Reports:

- `v_sales_daily`, `v_sales_labor_daily`, `v_sales_payments_daily` group by `paid_on` and exclude open jobs.
- Output column is `paid_on`.

## 11. Save function

`save_sales_order` keeps one atomic save with a new `p_paid_on date` argument.

Validation:

- Items/labor unchanged from the current rules.
- No payments, changes, or extras:
  - allowed for a new or open order → `OPEN`, `paid_on = null`
  - rejected for an already-paid order → cannot unpay
- Payments present:
  - extras, payments, and change must balance exactly
  - status becomes `PAID`
  - `paid_on` is required or defaults to today
  - `paid_on` must be today or earlier and not before the job date
  - GCash allocations are written
- An exported order rejects any edit.
- A paid order whose items/labor/extras change must send rebalanced payments.

The old function signature is replaced. The PWA update prompt handles the short deploy window.

## 12. UI structure

Shared pieces:

- `OrderDetailsFields` — customer, date, items, labor
- `OrderSummaryCard` — parts, labor, job total, or payment totals
- `ExtrasEditor`
- `OrderPaymentFields` - payment date, payments, automatic change, extras
- `StaffChoice` / `staffLabel` helper for “You”

Pages:

- `/orders/new` — Step 1 only
- `/orders/:id` — tabs: **Order** and **Payment**
- `/orders/:id?tab=payment` — opens the payment step
- `/orders` — open jobs + paid sales

Mobile:

- Summary card near the top.
- Sticky bottom bar with total and primary action, above the tab bar.
- Bottom padding so content is never hidden.

Desktop:

- Form on the left, sticky summary card on the right.

## 13. Testing

Database:

- Save unpaid job → `OPEN`, `paid_on` null, not in reports.
- Pay later → `PAID`, appears on the payment date, not the job date.
- Job total excludes extras; total to pay includes extras.
- Paid order with changed items and old payment → rejected until rebalanced.
- Paid order cannot be un-paid.
- Existing paid orders backfilled.
- Receipt returns null for unpaid; valid for paid.
- Reports, labor, GCash use `paid_on`.

Unit:

- Staff label returns “You” for the current user.
- Step 1 validation allows no payment.
- Payment validation requires zero balance.
- Open jobs/paid sales calculations.

E2E:

- Create an unpaid job with items and labor.
- See it in Open jobs with the job total.
- Take payment with extras, mixed cash/GCash, and automatic change.
- See it move to Paid sales on the payment date.
- Open the receipt.
- Edit a paid order, change an item, and confirm rebalancing is required.

## 14. Acceptance

- The buyer can see the job total before payment.
- Staff can save a job without payment and pay it later.
- Reports count the sale on the payment date.
- The current user sees “You” in every staff choice.
- The names Aldwin and Magma appear consistently.
- A paid order cannot be silently unbalanced or un-paid.
- Loading, empty, and error states exist.
- `npm run check`, database tests, and E2E pass.
