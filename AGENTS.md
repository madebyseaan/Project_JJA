# AGENTS.md

This file is the engineering contract for anyone — human or AI — working in this repository. Read it before changing anything. If an instruction here conflicts with a casual request, stop and ask.

---

## 1. What this project is

A web app for **one** motorcycle parts and repair shop in the Philippines.

- The mechanic creates a walk-in ticket at the counter, adds parts and labor, verifies the parts, takes payment, and issues an e-receipt.
- The owner manages inventory, sees daily sales, reconciles cash, and exports CSV for QuickBooks Desktop.
- Customers receive an e-receipt by QR or link. No customer accounts.
- Hosting and database must stay at **₱0/month**.
- The full product and technical design is in [`docs/spec.md`](docs/spec.md). That file is the source of truth.

**This is not the multi-tenant POS product described by the `pos-*` skills.** That product uses a monorepo, Fastify, Prisma, and `storeId` scoping. None of that applies here. If a `pos-*` skill is loaded, ignore its architecture and database conventions; use this file and `docs/spec.md`.

---

## 2. Read first

Before any change:

1. [`docs/spec.md`](docs/spec.md) — product behavior, data model, rules.
2. [`docs/runbook.md`](docs/runbook.md) — deploy, backup, restore, incidents.
3. [`docs/decisions/`](docs/decisions/) — why the architecture is what it is.
4. [`README.md`](README.md) — setup and commands.

If a change alters behavior, update the spec in the same pull request. A change that contradicts the spec is a bug or a new decision — not something to quietly implement.

---

## 3. Non-negotiables

1. **No server.** The app is a static React SPA. It talks directly to Supabase. Do not add Next.js, OpenNext, a custom API, Workers functions, Prisma, Fastify, or an always-on backend.
2. **No direct writes.** Mutations to tickets, ticket items, labor, payments, receipts, stock, day closes, and audit data go through PostgreSQL functions (`supabase.rpc(...)`). Never use `.insert()`, `.update()`, or `.delete()` on those tables from the client.
3. **Money is integer centavos.** No floats, no `parseFloat` arithmetic for money, no client-supplied totals. The database computes totals.
4. **Philippine business dates.** Use `Asia/Manila` for "today," daily numbers, day close, and reports. Store timestamps as `timestamptz`.
5. **Snapshots.** `ticket_items` freeze the part name, unit price, and unit cost when added. `receipts` store a complete immutable snapshot.
6. **Every stock change writes a ledger row.** `stock_movements` is append-only and written in the same transaction as the change. No silent stock updates.
7. **Completed records are immutable.** Completed tickets, their items, payments, and receipts cannot be edited. A completed sale is reversed only by `void_sale` (owner-only), which restores stock, records a refund, and marks the receipt VOID.
8. **Roles are enforced in the database.** Hiding a button is not security. RLS policies and function checks decide what a mechanic or owner can do.
9. **RLS on every table.** Default deny. No table ships without policies and tests.
10. **No secrets in the browser.** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public. The service-role key never appears in `src/`, the bundle, logs, or screenshots.
11. **Migrations only.** Never change the schema from the Supabase dashboard. Every change is a migration in `supabase/migrations`.
12. **No scope creep.** Phase 1 only. No multi-shop code, customer accounts, storefront, photos, offline sales, SMS/email, partial returns, or BIR official-receipt features unless the spec is updated and approved.
13. **One dependency at a time.** Do not add a package because it is convenient. The spec lists the stack; justify anything new in the PR.
14. **Every bug gets a regression test.** Every database function change gets a database test.
15. **`npm run check` must pass before you claim anything is done.**

---

## 4. Stack

| Layer | Choice |
|---|---|
| Language | TypeScript, strict |
| UI | React, Vite, Tailwind CSS v4, shadcn/ui, lucide-react |
| Routing | React Router |
| Server state | TanStack Query |
| Forms | React Hook Form + zod |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Database access | `@supabase/supabase-js`; reads with RLS, writes via RPC |
| PWA | `vite-plugin-pwa` |
| Tables | TanStack Table |
| Toasts | Sonner |
| QR | `qrcode.react` |
| CSV | papaparse |
| Lint / format | Oxlint + Prettier |
| Unit tests | Vitest + Testing Library |
| E2E | Playwright |
| Hosting | Cloudflare Workers static assets |
| CI/CD | GitHub Actions |
| Package manager | npm |

Do not introduce Next.js, Serwist, `jose`, Prisma, Fastify, Redux, Zustand, or a UI kit other than shadcn/ui.

---

## 5. Repository layout

```text
src/
  app/                 providers, router, layout, guards
  components/ui/       shadcn primitives only
  features/
    auth/              login, lock screen, session hooks
    bay/               queue, ticket detail, part picker, labor, payment
    inventory/         parts table, part form, stock actions
    owner/             dashboard, sales, day close, audit, settings
    receipts/          receipt page, verify page, QR, print
  hooks/               cross-feature hooks only
  lib/                 supabase, money, dates, csv, errors, print, pin
  routes/              thin page components; no business logic
  styles/
  types/               database.types.ts (generated) + domain types
supabase/
  migrations/
  seed.sql
  config.toml
tests/
  unit/
  db/
  e2e/
docs/
  spec.md
  runbook.md
  decisions/
public/
.github/
  workflows/
  pull_request_template.md
```

Rules:

- Feature code belongs in `src/features/<feature>/`. Do not create a second `components/` or `utils/` dumping ground.
- A feature folder may contain `components/`, `hooks/`, `api.ts`, `schemas.ts`, and `types.ts`.
- `src/lib` is for genuinely cross-cutting code. If only one feature uses it, keep it in that feature.
- `src/routes` contains thin page components that compose feature components. No business rules there.
- Do not add barrel files (`index.ts` re-exports). Import directly.
- Do not hand-edit `src/types/database.types.ts`. It is generated.
- Tests mirror the source in `tests/`; do not scatter test files across features unless they are component-level and tightly coupled.

---

## 6. Commands

These are the contract. If a script is missing during scaffolding, add it with this name; do not invent a parallel command.

```bash
npm run dev             # Vite dev server
npm run build           # typecheck + production build
npm run preview         # serve the production build locally
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint
npm run lint:fix         # ESLint with fixes
npm run format          # Prettier write
npm run format:check    # Prettier check
npm run test            # Vitest unit tests
npm run test:watch      # Vitest watch
npm run test:db         # database integration tests (local Supabase or CI)
npm run test:e2e        # Playwright
npm run check           # typecheck + lint + format check + unit + build
npm run db:start        # local Supabase (requires Docker; not on the laptop)
npm run db:stop         # stop local Supabase
npm run db:reset        # reset the LOCAL database only
npm run db:push         # apply migrations to the linked project
npm run db:types        # regenerate src/types/database.types.ts
npm run db:types:check  # fail if generated types are stale
npm run deploy          # build + wrangler deploy
```

Rules:

- `npm run check` is the minimum verification before saying a task is complete.
- `npm run test:db` and `npm run test:e2e` must pass in CI. Locally they may be skipped only if Docker is unavailable; say so explicitly in the PR.
- Never run `db:reset`, `db:push`, or destructive SQL against production.
- Deployment happens from `main` through CI, not from a laptop unless there is an incident and the runbook says so.

---

## 7. Environment and secrets

`.env.example` documents:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- `.env.local` is for local development and is gitignored.
- `VITE_*` values are embedded in the public bundle. Never put a secret behind a `VITE_` prefix.
- The service-role key is used only by CI/admin scripts and stored in GitHub Actions secrets.
- The receipt HMAC secret lives in `private.app_secrets`. A backup copy lives in GitHub Actions secrets. Never print it.
- If a secret is committed: remove it, rotate it, and note the incident. Do not just delete the commit.
- Do not log tokens, JWTs, passwords, PINs, or customer data.

---

## 8. TypeScript and code conventions

- TypeScript **strict**. `noUncheckedIndexedAccess` and `verbatimModuleSyntax` are on.
- No `any`. Use `unknown` and narrow it. Oxlint enforces this.
- No non-null assertion (`!`) unless the invariant is obvious and a comment explains why.
- Prefer `type` over `interface` for data shapes. Component props may use either; be consistent within a file.
- Use `const` objects and union types instead of `enum`.
- Named exports everywhere. Default exports only where a tool requires them (`vite.config.ts`, `vitest.config.ts`).
- Use the `@/` path alias for `src/`. Do not write `../../..` chains.
- Import order: external packages, `@/` imports, relative imports, type-only imports. Keep it consistent; Prettier handles formatting.
- Prefer small pure functions. Business logic lives in PostgreSQL functions or a feature's `api.ts`; components render.
- No `useEffect` for data fetching. Use TanStack Query.
- No global state library. Server state is Query; UI state is local.
- No `console.log` in application code. `console.error` is allowed in the error boundary and the logger.
- Comments explain **why**, not what. A comment that repeats the code is noise.
- Keep files focused. If a component passes ~200 lines, split it.
- Error messages shown to users are human and actionable. Raw SQL errors never reach the UI.
- Trim and length-limit user input in the database too, not only in zod.
- Dates and money go through `src/lib/dates.ts` and `src/lib/money.ts`. Do not scatter `Intl` or `* 100` arithmetic.

---

## 9. React and UI conventions

- Function components only. No class components. No `React.FC`.
- Components in `PascalCase.tsx`; hooks in `use-kebab-case.ts`; utilities in `kebab-case.ts`.
- Mobile-first. The bay and inventory screens must work at 360px width.
- Minimum touch target: **48 × 48px**. High contrast. Large text for the garage.
- Use shadcn/ui primitives from `src/components/ui`. Do not hand-roll buttons, dialogs, drawers, inputs, or badges.
- Use Tailwind tokens and CSS variables. No hardcoded hex colors in components.
- Every data screen has **loading, empty, and error** states. Empty states offer the next action.
- Mutations show a pending state and disable the trigger. No double-submit.
- **No optimistic updates for stock, payments, or receipts.** The database is the truth.
- Forms use React Hook Form + zod. The same rules are enforced again in PostgreSQL.
- Use `aria-live` for toasts and status changes. Every input has a label. Focus states are visible.
- Status is never conveyed by color alone; use text plus color.
- No `dangerouslySetInnerHTML`.
- Respect `prefers-reduced-motion`.
- The PIN lock and owner guard are UX; the database remains authoritative.
- The service worker must **never cache Supabase responses**. `NetworkOnly` for `*.supabase.co`.
- PWA updates use a prompt. Never force-reload while a form is open.
- Audio alerts require a user gesture. Provide an explicit "Enable alerts" button.
- Print styles target A4 by default; a 58mm/80mm layout is optional later.

---

## 10. Database conventions

- Migrations live in `supabase/migrations` with timestamps. Never edit an applied migration.
- Every migration includes tables, constraints, indexes, RLS policies, grants, and comments where useful.
- Enable RLS on every table. Default deny.
- No direct `INSERT`/`UPDATE`/`DELETE` grants on transactional tables to `authenticated`. Functions own the writes.
- Reads use explicit columns. Do not `select *` in application code.
- All functions are `security definer` with `search_path = ''` and fully qualified names (`public.tickets`, `private.receipt_counters`).
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` then grant execution explicitly.
- Validate every argument: positive quantities, non-negative amounts, valid enums, trimmed/length-limited strings.
- Lock part rows with `SELECT ... FOR UPDATE` in a deterministic order (sorted by `part_id`) before checking availability.
- Write the business change and its `audit_events` row in the same transaction.
- Use stable error codes: `INSUFFICIENT_STOCK`, `PAYMENT_MISMATCH`, `TICKET_NOT_OPEN`, `NOT_VERIFIED`, `FORBIDDEN`, `RECEIPT_NOT_ISSUED`, `ALREADY_COMPLETED`.
- Use `timestamptz`. Business date: `(now() at time zone 'Asia/Manila')::date`.
- Money columns end in `_centavos` and are integers. No `numeric` money, no floats.
- Use generated columns for line totals, ticket totals, available quantity, and variance where possible.
- Use `security_invoker = true` on views.
- Use triggers only for timestamps, profile creation, and immutability. Business logic belongs in functions.
- Soft-delete parts with `is_active`. Do not hard-delete catalog rows that tickets reference.
- Append-only tables (`stock_movements`, `audit_events`) have no update or delete grants.
- After any migration: `npm run db:types`, commit the generated file, and run `npm run db:types:check` in CI.
- Never change the schema from the Supabase dashboard. If it happens in an emergency, capture it as a migration immediately.

---

## 11. Auth, roles, and security

- Supabase Auth email/password. Public sign-ups disabled. Two accounts: owner and mechanic.
- `profiles.role` is `owner` or `mechanic`. `private.is_staff()` and `private.is_owner()` are security-definer helpers used by RLS.
- The PIN is local, hashed with salted SHA-256 in `localStorage`. It is a screen lock, not identity. Never send it to the server.
- Lock after 5 minutes idle; five bad attempts force a full sign-out.
- Owner-only: void sale, price edits, stock adjustments, day close, audit, settings, staff roles.
- Mechanic: create tickets, add catalog parts and labor, verify, record payments, complete tickets, view inventory.
- `anon` may execute only `ping()`, `get_receipt(token)`, and `verify_receipt(no, code)`.
- Public receipt/verify responses are limited to shop, receipt number, date, total, payment method, and status. No customer name, no item list, no phone.
- Public tokens are 128-bit random. Verification codes are 64-bit HMAC prefixes. If abuse appears, add per-IP throttling.
- Escape CSV formula injection on export.
- Do not add analytics, trackers, or third-party scripts without approval.
- Dependency policy: keep the tree small, commit the lockfile, review Dependabot PRs, and do not add abandoned packages.

---

## 12. Money, stock, and receipt rules

These are the highest-risk paths. Change them only with tests.

### Money

- Integer centavos everywhere. Parse peso input with a string parser, not `parseFloat`.
- The database computes line totals, ticket totals, and receipt totals. The client never sends a total.
- Payments are signed. Positive received, negative refunded. Completion requires the sum to equal the total.
- Cash tendered/change is display-only; the recorded payment is the amount applied.

### Stock

- `available = stock_on_hand - reserved_qty`.
- Add part → reserve. Complete → deduct and ledger `SALE`. Cancel → release. Void sale → restore and ledger `RETURN`.
- Never allow negative stock. Never adjust stock below `reserved_qty`.
- Every change writes `stock_movements` in the same transaction.
- Price and cost snapshots are taken when the part is added to the ticket.

### Receipts

- Issued exactly once per completed ticket, in the completion transaction.
- Daily number `YYYYMMDD-0001` from `private.receipt_counters`; no normal gaps.
- Immutable snapshot plus `verification_hash` and a 16-hex-character `verification_code`.
- Public token 128-bit random.
- A voided sale keeps the receipt and snapshot; status becomes `VOID`; stock is restored and a refund payment is recorded.
- Never edit a snapshot or a completed ticket. A correction is a new ticket.
- Any change to receipt code, snapshot shape, or verification must include:
  - a database test that a valid receipt verifies,
  - a test that an altered snapshot fails,
  - a test that the integrity report flags a mismatch and a missing number.

---

## 13. Testing

- Unit tests: money, dates, CSV, error mapping, PIN, zod schemas.
- Database tests: every function and RLS policy. At minimum:
  - reservation and oversell prevention (including concurrent adds),
  - completion, payment mismatch, unverified parts,
  - cancellation and deposit refund,
  - void sale and stock restoration,
  - receipt snapshot, HMAC, sequence, immutability,
  - role permissions (anon, mechanic, owner),
  - direct table writes denied,
  - day close totals.
- E2E: login → ticket → part → labor → verify → pay → receipt → stock down → owner sale → day close → CSV.
- Every bug fix gets a regression test.
- Tests are deterministic. Reset the database between runs. Never test against production.
- CI runs local Supabase in Docker. Locally, Docker is optional; `test:db` may be skipped only if documented.
- Coverage is not a number; critical paths must be covered.

---

## 14. Git and CI

- `main` is protected and always deployable. Work on branches; open a pull request.
- Branch names: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, `docs/<short-name>`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`.
- Keep pull requests small and focused. One concern per PR.
- Squash merge. Delete the branch after merge.
- Tag releases: `v0.1.0`, `v0.2.0`, and so on.
- CI must pass: typecheck, lint, format, unit, database, build. E2E runs on PRs and `main`.
- Generated types must be current; CI fails if `database.types.ts` drifted.
- Deploy only from `main` after CI passes.
- Never force-push `main`. Never commit `.env`, dumps, `node_modules`, coverage, or test artifacts.

---

## 15. Documentation

- `docs/spec.md` is the source of truth. Update it when behavior changes.
- `docs/runbook.md` is the operations manual. Update it when deploy, backup, restore, or staff procedures change.
- `docs/decisions/NNNN-short-title.md` records non-obvious decisions. Use the existing format:
  - Context, decision, consequences.
- `README.md` is the quickstart. Keep it accurate.
- This file is the agent contract. If a rule changes, update it in the same PR.
- Do not leave stale docs. A wrong doc is worse than no doc.

---

## 16. How to work

1. Read `AGENTS.md`, `docs/spec.md`, and the relevant ADRs.
2. Check `git status` before editing. Do not overwrite someone else's work.
3. For multi-file work, write a short plan first. For a one-file fix, proceed.
4. Prefer test-first for business logic and database functions:
   - write the failing test,
   - implement,
   - run the test,
   - run `npm run check`.
5. Make the smallest change that solves the problem. Do not refactor unrelated code.
6. Do not invent requirements. If the spec is ambiguous, stop and ask.
7. Do not add a dependency without a clear justification in the PR.
8. Do not modify generated files by hand.
9. Do not claim success without running the verification. Report the exact commands and results.
10. If something is blocked, say what is blocked and what you tried. Do not guess.

---

## 17. Definition of done

A task is done only when:

- [ ] Behavior matches `docs/spec.md`, or the spec is updated in the same PR.
- [ ] The flow works on a 360px phone and on a laptop.
- [ ] Loading, empty, and error states exist.
- [ ] Permissions are enforced in the database and tested.
- [ ] Money, stock, or receipt changes have database tests.
- [ ] `npm run check` passes.
- [ ] Database tests and E2E pass in CI.
- [ ] `database.types.ts` is regenerated and current.
- [ ] Docs and ADRs are updated.
- [ ] No secrets, no `console.log`, no raw SQL errors in the UI.
- [ ] The PR description lists what changed and how it was tested.

---

## 18. Scope and non-goals (phase 1)

**In scope:** staff auth and PIN lock, bay queue, ticket creation, parts and labor, stock reservation and ledger, verification, payments, completion, receipts, e-receipt page, verification page, void sale, inventory, owner dashboard, sales list, CSV export, day close, audit, integrity report, settings, PWA shell, backups, keep-alive, CI.

**Out of scope:** multi-shop, customer accounts, public storefront, online cart, QR ticket pass, camera scanner, part photos, partial returns, exchanges, bulk CSV import, email/SMS delivery, BIR official receipts, payroll, suppliers, purchase orders, loyalty points, offline sales.

If a request belongs to the out-of-scope list, say so and propose updating the spec and phase plan first.

---

## 19. Glossary

- **Ticket** — a job or over-the-counter sale, with parts, labor, payments, and a status.
- **Receipt** — the immutable proof of a completed sale, with a number and verification code.
- **Reserved** — stock set aside for an open ticket but not yet sold.
- **Available** — stock on hand minus reserved.
- **Snapshot** — a frozen copy of a price or receipt at a point in time.
- **Void sale** — a full reversal of a completed sale, owner-only.
- **Day close** — the owner's snapshot of sales, payments, expected cash, counted cash, and variance.
- **RPC** — a PostgreSQL function called from the browser; the only way to write transactional data.
- **RLS** — Row Level Security; the database rules that decide which rows a user can see or change.
- **PWA** — an installable web app with an offline shell.
- **HMAC** — a keyed hash only the database can produce; it makes receipt edits detectable.
- **Anon key** — the public Supabase key. Safe only because RLS and functions restrict it.
- **Service role key** — the secret key that bypasses RLS. It never ships to the browser.
