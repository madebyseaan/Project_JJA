# 0009 — Save the job first, take payment later

**Date:** 23 November 2026
**Status:** Accepted

## Context

The first sales-log version required a balanced payment before saving an order. In the shop, the job is written first and the customer pays after the repair. Staff also needed the buyer to see the job total before payment, and they needed to know which worker is “me” when choosing a main worker, helper, or GCash recipient.

## Decision

- Split the flow into **Step 1: Job** and **Step 2: Payment**.
- Step 1 saves an `OPEN` order with items and labor, no payment, and shows **Job total = parts + labor**.
- Step 2 records extras, cash/GCash, change, and a Manila **payment date**, and requires a zero balance. It sets `PAID` and `paid_on`.
- Sales, labor, GCash, and receipts use `paid_on`; open jobs appear in an **Open jobs** section and never in sales totals.
- A paid order can be corrected, but the payment must be rebalanced before saving. A paid order cannot become unpaid through the normal form.
- One atomic `save_sales_order` RPC handles both steps. It accepts `p_paid_on` and allows zero payments only for an open order.
- Staff accounts are **Aldwin** (`JJA-001`) and **Magma** (`JJA-002`). The signed-in person is shown as **You** in staff choices, order rows, reports, and GCash; the database stores real names.

## Consequences

- The buyer sees the job cost before payment, and the shop can take payment later without losing the job.
- Reports and GCash reconcile on the day the money arrives, not the day the work started.
- Paid-order edits are atomic and cannot silently leave an unbalanced record.
- The old one-step form and report-by-business-date behavior are replaced.
- A job may have no public receipt until it is paid.
