# 0007 — Staff sales access and shop role assignment

**Status:** Accepted
**Date:** 2026-11-22

## Context

The shop's real roles differ from the initial assumption:

- **Dad (`JJA-001`)** works the bay and handles QuickBooks. He needs the sales list and CSV export.
- **Uncle (`JJA-002`)** is the main owner. He needs the owner controls, but does not handle QuickBooks.
- Both need to search stock every day.

The phase-1 role model has only `owner` and `mechanic`. Giving Dad the owner role would also give him price edits, stock adjustments, void sales, day close, audit, and settings. Giving him only the mechanic role would hide the QuickBooks export.

## Decision

- Make **Uncle the owner** and **Dad the mechanic**.
- Add a staff-level **Sales** page at `/sales` with the receipt list, filters, and CSV export. Both roles can read it.
- Keep the following owner-only: price edits, stock adjustments, void sale, day close, audit, settings, and the owner dashboard.
- Keep stock read-only for the mechanic. Both roles can search and view stock quantities.
- The Sales page never writes money or stock; it only reads receipts and exports a report.

## Consequences

- Dad can export QuickBooks sales without gaining owner-only financial controls.
- Uncle keeps the controls that can change money, stock, or history.
- If Dad later needs to adjust stock, prefer giving him a narrow stock permission over making him a full owner.
- The spec and setup docs now describe Uncle as owner and Dad as mechanic.
- RLS already allows staff to read receipts and payments; the new page uses the existing policies.
