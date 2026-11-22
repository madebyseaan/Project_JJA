# 0008 — Replace the inventory POS with a daily sales log

**Date:** 22 November 2026
**Status:** Accepted

## Context

The first build modelled the shop as an inventory and repair-ticket system: stock reservations, ticket verification, completion, void sales, day close, and owner-only screens. That is not how the shop actually works. Dad and Uncle write sales in a daily record book. QuickBooks already owns the item list, stock, and accounting. The shop needs a fast way to record what was sold, who did the labor, how the customer paid, and who is holding shop GCash.

The two staff also need the same access. The owner/mechanic split added friction without protecting anything the shop cares about.

## Decision

Replace the routed product with a **daily sales log**:

- A catalog imported from the QuickBooks Item List. No stock quantities.
- Orders with items, per-order price overrides, custom lines, total labor, a helper share, and extras.
- Multiple cash/GCash payments and change. GCash records its recipient.
- GCash allocations split each net GCash payment into a shop share and a labor share.
- Daily and monthly reports, GCash held and transfers, and an optional public digital receipt.
- Both staff have identical access. RLS and functions enforce staff-only access, not roles.
- Retire the old bay, inventory, sales, and owner routes. Keep the old tables and legacy receipt links until a later cleanup migration.
- Defer QuickBooks IIF export, month lock, and reconciliation to the next step, pending the account/tax/IIF decisions.

## Consequences

- The product is smaller and matches the shop’s paper flow.
- QuickBooks remains the source of truth for stock and accounting.
- Labor is tracked in the app and never exported to QuickBooks.
- The sales log can record historical dates and edit open months; after export exists, a locked month must be read-only.
- The old inventory code is dead weight until a backup and cleanup migration. It must not gain new features.
- Database tests must cover money, labor splits, GCash balances, and receipt privacy because those are the new high-risk paths.
