# Step 06 — Payments and Completion Implementation Plan

> Execute inline. The architect delegated approval on 21 Nov 2026.

**Goal:** Take deposits and final payment, complete the ticket, deduct stock, issue the receipt, and reverse a sale safely.

**Spec:** `docs/spec.md` §6.3, §6.7, §10.7–§10.9, §11, §12.2, §12.4; `docs/roadmap.md` Step 06.

## Tasks

### Task 1 — Payments, receipts, completion, cancellation, void

- [x] `supabase/migrations/20261121140000_payments_receipts.sql`: payments, receipts, counters, HMAC secret, views, RPCs.
- [x] `tests/db/payments.test.ts`: deposits, overpayment, verification gate, completion, stock deduction, receipt HMAC, public token, cancellation refunds, void sale, permissions.
- [x] CI database job validates the migration and tests.

### Task 2 — Payment UI

- [x] `TicketPaymentsCard`, `RecordPaymentDialog`, `CompleteTicketDialog`, `CancelTicketDialog`.
- [x] Ticket detail shows paid/balance, verified gate, cancel rules, receipt result with QR.
- [x] Offline disables writes; pending states disable double-submit.

### Task 3 — Verification

- [x] Unit tests for payment schema and receipt display.
- [x] `npm run check` and CI.
- [x] Commit and PR.

## Gate

`npm run check` green; CI database job green; cash/GCash completion and void sale work.
