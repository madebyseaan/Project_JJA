# Step 07 — E-receipt and Verification Implementation Plan

> Execute inline. The architect delegated approval on 21 Nov 2026.

**Goal:** The customer gets a receipt by QR or link, and anyone can verify it against the live record.

**Spec:** `docs/spec.md` §6.4, §6.5, §10.8, §14; `docs/design.md` receipt/verify screens; `docs/roadmap.md` Step 07.

## Tasks

### Task 1 — Public receipt and verification

- [x] `/r/:token` public receipt page with shop, receipt number, items, labor, totals, payments, verification code, QR, print-to-PDF.
- [x] `/verify` receipt number + code page with Valid, Void, and No match responses.
- [x] Public responses never include cost or customer contact data.
- [x] Completion dialog shows the receipt QR.
- [x] Owner integrity RPC `get_receipt_integrity`: recompute hashes, find missing numbers, list voids.
- [x] Database tests for valid, tampered, missing, and voided receipts.
- [x] Unit test for the public receipt page.

### Task 2 — Verification

- [x] `npm run check` and CI database job.
- [x] Commit and PR.

## Gate

`npm run check` green; CI database job green; a valid receipt verifies and a tampered snapshot fails.
