# Delivery Roadmap — AI-Driven Build

**Status:** Living document
**Owner / Architect:** Sean
**Implementer:** AI
**Rule:** One step at a time. Do not start the next step until the current one is approved.

---

## 1. How we work

This is an AI-driven project. Sean is the architect and decides what the system is and when a step is polished. The AI is the workhorse: it plans, builds, tests, and demos one step at a time.

1. **Sean approves the step and its acceptance criteria.**
2. The AI writes a short implementation plan for that step in `docs/superpowers/plans/`.
3. The AI builds only that step.
4. The AI runs `npm run check`, then gives a short demo script and screenshots.
5. Sean reviews and polishes. The AI makes changes until Sean says **approved**.
6. Only then does the next step begin.

Rules:

- **No skipping ahead.** A later step may be tempting, but it waits.
- **Polish is part of the step.** Passing tests is not the same as being done.
- **The AI does not invent scope.** If something is missing, it goes into the roadmap or the spec first.
- **Fixes stay in the current step.** If a fix belongs to a later step, it is written down, not built now.
- **Every step ends with evidence:** `npm run check`, a demo script, and screenshots on a 360px phone and desktop.
- **The spec is behavior; the roadmap is order.** `docs/spec.md` says what the system does; this file says when we build it.

---

## 2. Definition of polished

A step is not done until all of these are true:

- [ ] It works at 360px and on desktop.
- [ ] Loading, empty, and error states exist.
- [ ] Touch targets are at least 48px; primary actions 56px.
- [ ] Keyboard focus is visible; labels are present; status is not color-only.
- [ ] No console errors, no raw SQL errors, no secrets in the browser.
- [ ] `npm run check` passes.
- [ ] Database permissions are enforced and tested (when the step touches data).
- [ ] Docs or the spec are updated if behavior changed.
- [ ] No file exceeds 1,000 lines; no new Markdown at the repository root.
- [ ] Sean has reviewed the screens and said **approved**.

---

## 3. Step overview

| # | Step | Status |
|---|---|---|
| 00 | Foundation: repo, stack, design system, Supabase connection, skills | Done |
| 01 | **Login and staff identity** | **Done — approved** |
| 02 | **PIN lock and idle lock** | **Done — approved** |
| 03 | **App shell and navigation** | **Done — approved 21 Nov 2026 (delegated)** |
| 04 | **Inventory and stock** | **In progress** |
| 05 | Bay tickets | Waiting |
| 06 | Payments and completion | Waiting |
| 07 | E-receipt and verification | Waiting |
| 08 | Owner dashboard and day close | Waiting |
| 09 | Launch: PWA, backups, deploy, UAT | Waiting |
| 10 | Phase 2: storefront, QR pass, photos, returns, QuickBooks | Later |

---

## 4. Current step

**Step 04 — Inventory and stock.**
Status: **In progress.** Step 03 is approved and closed. On 21 Nov 2026 Sean delegated approval decisions and asked for autonomous completion of the remaining phase-1 steps; the one-step-at-a-time review pause is suspended for this run and every step is still verified with `npm run check` and CI before it is marked done. Plan: `docs/superpowers/plans/2026-11-21-step-04-inventory.md`.

**Next session starts here.** Start fresh from this section; do not rebuild Step 03. Step 03 screenshots are in `docs/screenshots/step-03-shell-*.png`.

---

## Step 00 — Foundation

**Status:** Done.

- [x] Vite + React + strict TypeScript.
- [x] Oxlint, Prettier, Vitest, Testing Library, Playwright.
- [x] Tailwind CSS v4 and shadcn/ui primitives.
- [x] Service Bay Ledger design system (`docs/design.md`).
- [x] Brand mark, status badge, 48px button size, fonts.
- [x] Supabase project connected through `.env.local`.
- [x] Supabase agent skills installed locally.
- [x] Repository layout and 1,000-line file-size check.
- [x] `npm run check` green.

**Gate:** passed. We may start Step 01.

---

## Step 01 — Login and staff identity

**Goal:** A staff member can sign in with an employee ID and password, the app knows their name and role, and the session survives a refresh. No PIN, no app shell, and no shop data yet.

**Why this is first:** every later screen depends on knowing who is signed in and whether they are the owner or the mechanic.

### AI builds

- [x] A `profiles` table with `id`, `employee_id`, `display_name`, `role` (`owner` or `mechanic`), and timestamps.
- [x] A trigger that creates a profile when a Supabase auth user is created.
- [x] RLS helpers `private.is_staff()` and `private.is_owner()`.
- [x] Read policies: staff can read profiles; roles are not editable from the client in this step.
- [x] `src/lib/supabase.ts`: browser client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [x] A clear setup screen if the environment variables are missing.
- [x] `src/types/domain.ts` with `Role`, `Profile`, and `AuthState`.
- [x] `AuthProvider` and `useAuth`: session listener, profile fetch, sign in, sign out, loading.
- [x] `/login`: employee ID, password, validation, pending state, wrong-password error, unknown-ID error, missing-profile error.
- [x] A temporary post-login screen that shows the staff name, role, and a sign-out button. The real shell comes in Step 03.
- [x] Session persistence across refresh.
- [x] Unit tests for the login form, auth provider, and setup screen.
- [x] Database tests for the profile trigger, roles, and RLS (written; run after setup).
- [x] A GitHub Actions verify workflow: typecheck, lint, format, file size, unit tests, build.
- [x] A short implementation plan in `docs/superpowers/plans/`.

### Setup needed before the demo

- [x] Apply the migration.
- [x] Create Dad (`JJA-001`) and Uncle (`JJA-002`) in Supabase Auth using the synthetic staff emails.
- [x] Set Dad to `owner` and set both display names.
- [ ] Put the staging keys in `.env.test.local` and run `npm run test:db`. (Can be added later; the manual sign-in is confirmed.)
- [x] Sign in with `JJA-001` and confirm the demo script below.

### Human checkpoints

- [ ] Create the two auth users in the Supabase dashboard: Dad (`JJA-001`, owner) and Uncle (`JJA-002`, mechanic), using the synthetic staff emails.
- [ ] Confirm both users; keep the passwords private. Staff only type the employee ID.
- [ ] Provide the staging project ref for migrations, and the test keys in `.env.test.local` (never in chat).
- [ ] Approve the login visual direction after the first demo.

### Acceptance criteria

- [ ] Dad signs in with `JJA-001` and sees `Dad` and `Owner`.
- [ ] Uncle signs in with `JJA-002` and sees `Uncle` and `Mechanic`.
- [ ] Refreshing the page keeps the session.
- [ ] Signing out returns to `/login`.
- [ ] A wrong password shows a clear, human message.
- [ ] An unknown employee ID shows the same generic message (no account enumeration).
- [ ] A missing profile signs the user out with a clear explanation.
- [ ] Missing environment variables show the setup screen, not a blank page.
- [ ] The page works at 360px and on desktop.
- [ ] `npm run check` and CI pass.
- [ ] Sean says **approved**.

### Demo script

1. Open `/login` on a phone-sized window and on desktop.
2. Sign in with `JJA-001` and Dad's password. Confirm `Dad` and `Owner`.
3. Refresh. Confirm the session survives.
4. Sign out. Confirm the return to `/login`.
5. Sign in with `JJA-002` and Uncle's password. Confirm `Uncle` and `Mechanic`.
6. Enter a wrong password. Confirm the error is clear and does not reveal whether the employee ID exists.
7. Temporarily remove an environment variable. Confirm the setup screen appears and names the missing variable.

**GATE:** Do not start Step 02 until Sean has tested this, requested any polish, and said **approved**.

---

## Step 02 — PIN lock and idle lock

**Status:** Done — approved 15 Nov 2026.

**Goal:** After login, a 4-digit PIN locks the screen. The app locks after 5 minutes idle. Five wrong PINs sign the user out while keeping the saved PIN. An expired session returns to login with a clear message.

### AI builds

- [x] `pin.ts`: salted SHA-256 hash in `localStorage`, per user, never sent to the server.
- [x] First-login PIN setup: enter twice, save, continue.
- [x] `/lock`: staff name, Manila clock, 64px keypad.
- [x] Idle lock after 5 minutes; reset on pointer and keyboard activity.
- [x] Five wrong attempts signs out and keeps the saved PIN; the next password sign-in resets the attempts.
- [x] Session-expiry handling: explain and return to `/login`.
- [x] Unit tests with fake timers and a mocked auth session.
- [x] Shared brand panel and mobile header so login and lock match.
- [x] PIN state syncs across tabs; a missing PIN signs the tab out instead of falling into setup.

### Human checkpoints

- [ ] Try the keypad with one hand, on the actual phone.
- [ ] Confirm the lock timing feels right for the shop.
- [x] Approve the copy and the lock screen look.

### Demo script

1. Sign in with `JJA-001` and the owner password.
2. On first entry, set a 4-digit PIN and confirm it. The app opens the staff home.
3. Press **Lock**. The lock screen shows Dad's name, `JJA-001`, and the Manila clock.
4. Enter a wrong PIN. Confirm the message counts down from 4 attempts.
5. Enter the correct PIN. The staff home returns.
6. Leave the screen idle for 5 minutes. Confirm it locks by itself.
7. Press **Forgot PIN? Sign in with password.** Confirm it clears the PIN and returns to `/login`.

Screenshots: `docs/screenshots/step-02-pin-setup-{desktop,tablet,mobile}.png`, `step-02-pin-unlock-*.png`, `step-02-pin-error-*.png`.

**GATE:** Passed — Sean approved Step 02 on 15 Nov 2026.

---

## Step 03 — App shell and navigation

**Status:** Done — approved 21 Nov 2026 (delegated by the architect for the autonomous build run).

**Goal:** The staff frame: mobile bottom tabs, desktop left rail, Bay/Stock/Owner routes, role guards, connection status, and real empty states.

### AI builds

- [x] `StaffLayout` and `PublicLayout`.
- [x] `AppNav` with Bay, Stock, and Owner (owner only).
- [x] `RequireStaff` and `RequireOwner` guards.
- [x] Placeholder Bay, Stock, and Owner screens with `PageHeader` and `EmptyState`.
- [x] Connection status dot and offline banner.
- [x] Long-name truncation at 360px.
- [x] Route and guard tests.

### Human checkpoints

- [ ] Check the nav labels and active states.
- [ ] Confirm the mobile tab bar is comfortable.
- [ ] Confirm the desktop rail feels balanced.
- [ ] Confirm a mechanic cannot reach `/owner`.

### Demo script

1. Sign in as Dad (`JJA-001`) and set or enter the PIN.
2. Open `/`. Confirm it redirects to `/bay` and the Bay tab is active.
3. At 360px, confirm the mobile top bar, bottom tabs, and Lock button fit without horizontal scrolling.
4. Open Stock. Confirm the Stock tab is active and the placeholder empty state is clear.
5. Open Owner as Dad. Confirm today's placeholder is visible.
6. Sign out and sign in as Uncle (`JJA-002`). Confirm the Owner tab is gone.
7. Type `/owner` directly as Uncle. Confirm the app returns to `/bay`.
8. Toggle the network offline. Confirm the dot says Offline and the banner says changes are disabled. Toggle it back and confirm both recover.
9. Tap Lock. Confirm the lock screen appears; unlock with the PIN. On mobile, sign out through **Sign in as someone else**.

Screenshots: `docs/screenshots/step-03-shell-bay-desktop.png`, `step-03-shell-bay-mobile.png`, `step-03-shell-owner-desktop.png`, `step-03-shell-mechanic-desktop.png`.

**GATE:** Passed — Step 03 approved by delegation on 21 Nov 2026. Screenshots: `docs/screenshots/step-03-shell-*.png`.

---

## Step 04 — Inventory and stock

**Goal:** A real parts catalog: add, edit, restock, adjust, low-stock alerts, and a full stock ledger.

### AI builds

- [ ] `parts` table with prices, cost, stock, reserved, available, low-stock threshold, active flag.
- [ ] Owner RPCs: `create_part`, `update_part`, `adjust_stock`.
- [ ] Every stock change writes a `stock_movements` row with actor and reason.
- [ ] Inventory screen: search, filters, add/edit sheet, restock/adjust dialog.
- [ ] Low-stock filter and dashboard count.
- [ ] Disable write actions while offline and show the reconnect state promised by the offline banner.
- [ ] Permission tests: mechanic read-only; owner writes; anon denied.

### Human checkpoints

- [ ] Enter a small real catalog and check the table density.
- [ ] Test restock and adjustment with the owner account.
- [ ] Confirm the low-stock level is useful.

**GATE:** Do not start Step 05 until Sean says **approved**.

---

## Step 05 — Bay tickets

**Goal:** The daily workflow: a walk-in ticket, parts and labor, stock reservation, verification, statuses, and live updates.

### AI builds

- [ ] `tickets`, `ticket_items`, `ticket_labor` tables and counters.
- [ ] RPCs: create ticket, add/remove/set item quantity, add/remove labor, verify item(s), update status.
- [ ] Row locks and reservation rules; no overselling.
- [ ] Bay queue and ticket detail screens.
- [ ] Part picker with search and stock badges.
- [ ] Sticky total/action bar on mobile.
- [ ] Realtime updates and refetch on focus/reconnect.
- [ ] Tests for reservation, concurrency, status transitions, and permissions.

### Human checkpoints

- [ ] Create a real ticket in under a minute.
- [ ] Check the part picker speed and touch targets.
- [ ] Confirm the status labels and progress flow.
- [ ] Test with two devices.

**GATE:** Do not start Step 06 until Sean says **approved**.

---

## Step 06 — Payments and completion

**Goal:** Take deposits and final payment, complete the ticket, deduct stock, issue the receipt, and reverse a sale safely.

### AI builds

- [ ] `ticket_payments` table, signed amounts, method, reference, received by.
- [ ] `record_payment`, `complete_ticket`, `cancel_ticket`, `void_sale` RPCs.
- [ ] Payment validation: balance, no overpayment, no credit.
- [ ] Stock deduction and ledger rows in the completion transaction.
- [ ] Receipt issuance: daily number, snapshot, HMAC code, public token.
- [ ] Void sale: restore stock, refund, mark receipt and ticket VOID.
- [ ] Payment and completion UI.
- [ ] Tests for every money and stock path.

### Human checkpoints

- [ ] Pay cash and GCash.
- [ ] Check the change calculation and the confirmation step.
- [ ] Void a test sale and confirm stock returns.
- [ ] Approve the receipt wording.

**GATE:** Do not start Step 07 until Sean says **approved**.

---

## Step 07 — E-receipt and verification

**Goal:** The customer gets a receipt by QR or link, and anyone can verify it against the live record.

### AI builds

- [ ] Public receipt page `/r/:token`.
- [ ] QR code and Copy Link on the completion screen.
- [ ] Verify page `/verify` with receipt number and code.
- [ ] Limited verification response: status, date, total, method.
- [ ] Owner integrity report: hash mismatches and missing numbers.
- [ ] Tests for valid, tampered, void, and missing receipts.

### Human checkpoints

- [ ] Scan the QR on an actual phone.
- [ ] Confirm the receipt looks trustworthy and prints/PDFs cleanly.
- [ ] Try a valid and an edited code on `/verify`.
- [ ] Approve the customer-facing wording.

**GATE:** Do not start Step 08 until Sean says **approved**.

---

## Step 08 — Owner dashboard and day close

**Goal:** The owner can see today's sales, reconcile cash, review voids and low stock, and export CSV.

### AI builds

- [ ] Daily summary RPC/view: parts vs labor, cash vs GCash/Maya, voids, low stock.
- [ ] Sales list with filters and receipt drill-down.
- [ ] Day close: expected vs counted cash, variance, notes.
- [ ] CSV export with formula-injection protection.
- [ ] Audit log and receipt integrity screens.
- [ ] Shop settings read/write.
- [ ] Tests for totals, day close, CSV, and permissions.

### Human checkpoints

- [ ] Compare the dashboard with the physical drawer.
- [ ] Check the CSV in Excel/QuickBooks.
- [ ] Confirm the day-close flow and variance display.
- [ ] Review the audit log.

**GATE:** Do not start Step 09 until Sean says **approved**.

---

## Step 09 — Launch

**Goal:** A reliable PWA in the shop, with backups, monitoring, CI/CD, and training.

### AI builds

- [ ] PWA install polish, update prompt, offline banner.
- [ ] Nightly backup workflow and restore drill.
- [ ] Daily keep-alive.
- [ ] Cloudflare deploy workflow and rollback notes.
- [ ] UptimeRobot monitors.
- [ ] Setup, runbook, and training notes.
- [ ] Final smoke test.

### Human checkpoints

- [ ] Install on Dad's and Uncle's phones.
- [ ] Run a full day of UAT with real tickets.
- [ ] Confirm the backup restore works.
- [ ] Approve the launch.

**GATE:** Launch only after Sean says **approved**.

---

## Step 10 — Phase 2

Only after the shop has used phase 1 for a while:

- [ ] Customer storefront and online cart.
- [ ] Customer QR ticket pass and live status.
- [ ] Camera QR scanner at the bay.
- [ ] Part photos.
- [ ] Partial returns and exchanges.
- [ ] Bulk CSV item import.
- [ ] Optional email receipt delivery.

---

## Change control

- If a new requirement appears, write it in this roadmap or `docs/spec.md` first. Do not slip it into the current step.
- If a step needs a design change, change `docs/spec.md` and get approval before coding.
- If a step is blocked by an external account or key, mark it **blocked** and list exactly what is needed.
- If a step grows beyond one focused deliverable, split it into a new step before continuing.

---

## Per-step plan template

When a step starts, create `docs/superpowers/plans/YYYY-MM-DD-step-NN-<name>.md` with:

- Goal and spec references.
- Files created and modified.
- Interfaces produced for later steps.
- Test-first steps with exact commands and expected results.
- The demo script.
- The gate: what Sean must approve.

No plan file at the repository root. No Markdown at the root except `README.md` and `AGENTS.md`.
