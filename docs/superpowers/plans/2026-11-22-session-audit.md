# Session Audit — 21–22 November 2026

**Status:** Paused by the architect for a scope/flow redesign.
**Branch at pause:** `main`
**Last code commit:** `10b2f3d` — `fix: make the mobile shell behave like an app (#16)`
**Production URL:** <https://jja-pos.seanromaa.workers.dev>

---

## 1. What this session delivered

Steps 03–08 of the roadmap were built, tested, merged, and deployed. Step 09 launch tooling was built and the production site was deployed. The shop app is live, but launch is not signed off because real-device UAT, the restore drill, and UptimeRobot are still open.

| PR | Change |
|---|---|
| #2 | Step 03: app shell, mobile tabs, desktop rail, guards, screenshots |
| #3 | Step 04: inventory, stock ledger, owner stock RPCs |
| #4 | Step 05: bay tickets, reservations, verification |
| #5 | Step 06: payments, completion, cancellation, void sale, receipts |
| #6 | Step 07: public e-receipt, verification, integrity report |
| #7 | Step 08: owner dashboard, day close, sales/CSV, audit, settings |
| #8 | Step 09: PWA, deploy/backup/keep-alive workflows, Playwright E2E |
| #9 | Step 09 verification record |
| #10 | Launch workflows skip cleanly when secrets are absent |
| #11 | Bake production Supabase env into the deploy build |
| #12 | Require the Supabase session pooler for backups |
| #13 | Employee ID auto-uppercase, hyphen insertion, zero-padding |
| #14 | Android/iPhone install guidance and iOS PWA meta tags |
| #15 | Staff read-only Sales tab and CSV export; Uncle owner, Dad mechanic |
| #16 | Mobile shell as a `100dvh` flex column; safe areas; no gap/jump; out-of-stock status |

---

## 2. Production state

**App:** Cloudflare Worker `jja-pos`, `https://jja-pos.seanromaa.workers.dev`

**Production Supabase project:** `hodeuqfrauvqiukhodtr`
**Staging Supabase project:** `iwzcvwhuawquenlnufsq`

Applied migrations in production:

1. `20261115100000_profiles.sql`
2. `20261121120000_inventory.sql`
3. `20261121130000_bay_tickets.sql`
4. `20261121140000_payments_receipts.sql`
5. `20261121150000_receipt_integrity.sql`
6. `20261121160000_owner.sql`

Verified in production:

- `ping()` returns `1`.
- Anonymous table reads are denied.
- `get_receipt` and `verify_receipt` respond correctly.
- Staff sign-in works.
- Dad sees Sales, not Owner.
- Uncle sees Owner.
- Same-device PIN reload asks for unlock, not setup.
- A new device asks to set a PIN.
- Install dialog opens.
- Mobile shell: header stays at top, tabs stay at viewport bottom, no gap, only the main area scrolls.
- Inputs are 16px on mobile; `touch-action: manipulation`.
- Stock shows `Out of stock` for zero stock and `Needs restock (50)`.

---

## 3. Production data changes

- Staff profiles:
  - `JJA-001` — Dad — **mechanic**
  - `JJA-002` — Uncle — **owner**
- Role changes were written to `audit_events`.
- Shop settings seeded with the shop name and low-stock default 3.
- **50 starter parts** were added with zero opening stock. They are generic researched examples for a Philippine motorcycle shop, not company data.
- No QuickBooks items were imported.
- No real sales, tickets, payments, or receipts were created.

---

## 4. QuickBooks file reviewed (not imported)

The private file `C:\Users\Sean\Desktop\jja-private\draft.csv` was inspected only. It is outside the repo.

- 1,319 rows; 1,316 Inventory Parts; 1 Service; 1 Other Charge; 1 Sales Tax Item.
- 1,053 active inventory items; 263 inactive.
- 857 active items have stock.
- 196 active items have zero or negative stock.
- 55 items have negative QuickBooks quantities.
- 19 active items have zero selling price; 31 have zero cost.
- No reorder points; 42 preferred vendors; only 13 MPNs.
- No customer names or contact data.

Import was paused before any write. No QuickBooks data is in the app.

---

## 5. Secrets and local files

GitHub Actions secrets currently set (names only):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL` — production **session pooler** URL
- `RECEIPT_HMAC_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Local, gitignored:

- `.env.local` — staging public keys
- `.env.production.local` — production URL, publishable key, secret key, database password
- `.env.setup.local` — staging database password and service-role key
- `.staff-credentials.local` — generated production staff passwords
- `C:\Users\Sean\Desktop\JJA-private\draft.csv` — QuickBooks item export

The staff password file should be saved to a password manager and then deleted. None of these files are committed.

---

## 6. Verification evidence

- `npm run check` — passes: typecheck, lint, Prettier, file-size, unit tests, production build, PWA service worker.
- `npm run test:e2e` — 8 Playwright tests pass on desktop Chromium and Pixel 7.
- CI — verify, database, and E2E jobs pass; all PRs #2–#16 merged.
- Deploy — succeeds from `main`.
- Nightly backup workflow — tested successfully after switching to the IPv4 session pooler.
- Keep-alive workflow — tested successfully.
- Production smoke — login, roles, install dialog, PIN behavior, mobile layout, and out-of-stock labels verified.

---

## 7. Decisions made

- `docs/decisions/0006-autonomous-build.md` — the 21 Nov instruction was treated as delegated approval; each step merged only after green CI.
- `docs/decisions/0007-staff-sales-access.md` — Uncle is owner; Dad is mechanic with read-only Sales/CSV access. Owner-only financial controls remain with Uncle.
- Part photos remain Phase 2 in the spec; not implemented.
- QuickBooks import remains a future, file-based interchange; no direct API/server.
- Negative stock is never stored as sellable stock. Import should preserve the QuickBooks number as a note and set sellable stock to 0 with a “needs count” flag.

---

## 8. Open items at pause

- Real-device UAT with Dad and Uncle.
- Restore drill from the backup artifact.
- UptimeRobot monitors.
- Final launch approval; Step 09 remains **In progress**.
- Part photos.
- QuickBooks inventory import, reconciliation, CSV/IIF export.
- Inventory workspace redesign and any new flow from the architect’s next draft.
- Cloudflare token rotation policy (current token has no expiry).
- Delete `.staff-credentials.local` after saving the passwords.

---

## 9. Pause rule

No further product changes should be made until the architect provides the new flow/draft. The next work starts with a spec/roadmap update and a fresh plan, not code.
