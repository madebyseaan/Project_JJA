# 0003 — Tamper-evident e-receipts

**Status:** Accepted
**Date:** 2026-11-15

## Context

The shop has no printer at launch. Receipts will be delivered as a web page by QR or link. A screenshot can be edited with ordinary tools, and AI tools make image edits easier. The owner also needs protection against staff quietly changing a price, voiding a cash sale, or issuing a receipt that does not match the system.

## Decision

Every completed sale receives:

- a daily receipt number (`YYYYMMDD-0001`) with no normal gaps;
- an immutable JSON snapshot of the shop, customer, items, labor, totals, payments, and timestamps;
- a 64-bit verification code derived from an HMAC-SHA256 over the receipt number, issue time, total, and snapshot;
- a 128-bit random public token for the customer receipt URL;
- a public verification page that recomputes the code and returns only status, date, total, and payment method.

Completed tickets and receipts cannot be edited. A completed sale can be reversed only by an owner-only whole-sale void, which restores stock, records a refund, and marks the receipt and ticket VOID. The owner also gets an integrity report that recomputes every hash and lists missing numbers.

## Consequences

- Editing a receipt image or the database snapshot makes the code fail to match.
- The HMAC secret must be backed up; losing it breaks verification of old receipts.
- Receipts are sales receipts, not BIR Official Receipts unless the shop registers them.
- Public endpoints must be narrowly scoped and rate-limited if abused.
- The system cannot stop a customer from photographing a receipt or visiting a look-alike site; the official URL and the verification code are the defense.
- A corrected sale is a new ticket, not an edit.
