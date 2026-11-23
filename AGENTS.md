# AGENTS.md

This file is the engineering contract for anyone — human or AI — working in this repository. Read it before changing anything. If an instruction here conflicts with a casual request, stop and ask.

---

## 0. Highest priority

1. **No file may exceed 1,000 lines of code.** This is a hard limit, not a target. Split by responsibility into components, hooks, feature modules, or SQL function files before a file gets close. If a file would cross 1,000 lines, stop and split it first.
2. **The repository root contains only `README.md` and `AGENTS.md`.** Every other Markdown document belongs under `docs/` — `docs/roadmap.md`, `docs/spec.md`, `docs/design.md`, `docs/runbook.md`, `docs/setup.md`, `docs/decisions/`, and `docs/superpowers/plans/`. Never create `NOTES.md`, `TODO.md`, `CHANGELOG.md`, or any other Markdown file at the root.
3. **One roadmap step at a time.** `docs/roadmap.md` defines the delivery order. Do not begin the next step until the human architect has tested the current step, requested any polish, and said **approved**.

---

## 1. What this project is

A web app that is a **daily sales log** for **J.J.A Motor Accessories and Motorcycle Repair Shop** (Est. 2023), one motorcycle parts and repair shop in the Philippines.

- Aldwin and Magma record each walk-in job: date, optional customer and motorcycle, parts, labor, helper share, extras, and cash/GCash payments after the repair.
- The signed-in person is shown as **You** in staff choices and reports; the shell keeps the real name.
- The item list and prices come from QuickBooks. The app does **not** track stock; QuickBooks remains the stock and accounting record.
- Both staff have the **same access**. There is no owner/mechanic split in the sales log.
- The app shows daily and monthly sales, labor per person, cash, GCash, and shop GCash held in personal accounts.
- An optional public digital receipt can be shared by link or QR.
- A later step exports the month’s **parts only** to QuickBooks as IIF, locks the month, and reconciles.
- Hosting and database must stay at **₱0/month**.
- The full product and technical design is in [`docs/spec.md`](docs/spec.md). That file is the source of truth.

**This is not the multi-tenant POS product described by the `pos-*` skills.** That product uses a monorepo, Fastify, Prisma, and `storeId` scoping. None of that applies here. If a `pos-*` skill is loaded, ignore its architecture and database conventions; use this file and `docs/spec.md`.

**Supabase skills:** `.agents/skills/supabase` and `.agents/skills/supabase-postgres-best-practices` are installed project-locally. Use them for auth, RLS, migrations, SQL, and troubleshooting. They include Next.js/SSR advice; this repo is a static Vite SPA, so ignore server components, middleware, cookie auth, and `NEXT_PUBLIC_*` guidance. The rules in this file and `docs/spec.md` win.

---

## 2. Read first

Before any change:

1. [`docs/roadmap.md`](docs/roadmap.md) — the current step, its gate, and the delivery order.
2. [`docs/spec.md`](docs/spec.md) — product behavior, data model, rules.
3. [`docs/runbook.md`](docs/runbook.md) — deploy, backup, restore, incidents.
4. [`docs/decisions/`](docs/decisions/) — why the architecture is what it is.
5. [`README.md`](README.md) — setup and commands.

If a change alters behavior, update the spec in the same pull request. A change that contradicts the spec is a bug or a new decision — not something to quietly implement.

---

## 3. Non-negotiables

1. **No server.** The app is a static React SPA. It talks directly to Supabase. Do not add Next.js, OpenNext, a custom API, Workers functions, Prisma, Fastify, or an always-on backend.
2. **No direct writes.** Mutations to the catalog, orders, order items, labor, extras, payments, changes, GCash allocations, GCash transfers, receipts, and audit data go through PostgreSQL functions (`supabase.rpc(...)`). Never use `.insert()`, `.update()`, or `.delete()` on those tables from the client.
3. **Money is integer centavos.** No floats, no `parseFloat` arithmetic for money, no client-supplied totals. The database computes totals.
4. **Philippine business dates.** Use `Asia/Manila` for "today," job dates, payment dates, order numbers, reports, and month selection. Store timestamps as `timestamptz`.
5. **Snapshots.** `sales_order_items` freeze the item name, quantity, and unit price when the order is saved. The catalog base price is never used to rewrite an old order.
6. **No stock tracking.** QuickBooks owns stock. Do not add quantities on hand, reservations, stock ledgers, or low-stock screens to this app. The old inventory tables are retained only until a cleanup migration.
7. **Jobs are saved unpaid; payment comes later.** A job is `OPEN` with no payment. A balanced payment makes it `PAID` with a Manila `paid_on` date. A paid order cannot become unpaid. Sales, labor, GCash, and receipts use the payment date. Editing a paid order requires rebalancing before save. After QuickBooks export exists, a locked month is read-only and corrections happen in QuickBooks. Never silently rewrite an exported order.
8. **Both staff have equal access.** The database enforces staff-only access; it does not use the legacy owner/mechanic split in the sales log. Hiding a button is not security.
9. **RLS on every table.** Default deny. No table ships without policies and tests.
10. **No secrets in the browser.** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public. The service-role key never appears in `src/`, the bundle, logs, or screenshots.
11. **Migrations only.** Never change the schema from the Supabase dashboard. Every change is a migration in `supabase/migrations`.
12. **No scope creep.** Current phase is the sales log and the approved QuickBooks follow-up. No multi-shop code, customer accounts, storefront, photos, offline sales, SMS/email, partial returns, payroll, or BIR official-receipt features unless the spec is updated and approved.
13. **One dependency at a time.** Do not add a package because it is convenient. The spec lists the stack; justify anything new in the PR.
14. **Every bug gets a regression test.** Every database function change gets a database test.
15. **`npm run check` must pass before you claim anything is done.**
16. **Respect the highest-priority limits.** No file over 1,000 lines; no new Markdown files in the repository root.

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
  app/
    guards/            RequireStaff, RequireOwner
    layouts/           StaffLayout, PublicLayout
    providers.tsx
    router.tsx
    App.tsx
  components/
    ui/                shadcn primitives only
    ...                shared components (BrandMark, StatusBadge, etc.)
  features/
    auth/              login, PIN lock, session hooks
    sales/             orders, items, reports, GCash, receipt, hooks, APIs
    pwa/               install, update, offline UI
    receipts/          legacy receipt page and verify page
    bay/               legacy ticket screens (not routed)
    inventory/         legacy stock screens (not routed)
    owner/             legacy owner screens (not routed)
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
  setup/
  unit/
  db/
  e2e/
docs/
  design.md
  roadmap.md
  setup.md
  spec.md
  runbook.md
  screenshots/
  decisions/
  superpowers/plans/
scripts/
  check-file-size.mjs
.agents/skills/        Supabase-provided skills
.opencode/skills/      project-local skills
public/
.github/
  workflows/
  pull_request_template.md
```

Every new file has a home in this tree. Do not create a new top-level folder without updating this section and the plan.

Rules:

- Feature code belongs in `src/features/<feature>/`. Do not create a second `components/` or `utils/` dumping ground.
- `src/features/sales/` is the current product. Legacy `bay/`, `inventory/`, and `owner/` code is not routed and must not gain new features.
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
npm run typecheck       # tsc -b
npm run lint            # Oxlint
npm run lint:fix         # Oxlint with fixes
npm run format          # Prettier write
npm run format:check    # Prettier check
npm run check:size      # fail if any source file exceeds 1,000 lines
npm run test            # Vitest unit tests
npm run test:watch      # Vitest watch
npm run test:db         # database integration tests (local Supabase or CI)
npm run test:e2e        # Playwright
npm run check           # typecheck + lint + format check + file size + unit + build
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
- The deploy workflow applies pending migrations through `supabase db push` using the CI-only `SUPABASE_DB_URL` secret before it deploys the frontend. Do not run `db:push` against production from a laptop.

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
- The legacy receipt HMAC secret lives in `private.app_secrets`. A backup copy lives in GitHub Actions secrets. Never print it. New orders use the digital receipt token, not HMAC verification.
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
- Mobile-first. The orders, order form, items, reports, and GCash screens must work at 360px width.
- Minimum touch target: **48 × 48px**. High contrast. Large text for the garage.
- Use shadcn/ui primitives from `src/components/ui`. Do not hand-roll buttons, dialogs, drawers, inputs, or badges.
- Use Tailwind tokens and CSS variables. No hardcoded hex colors in components.
- Every data screen has **loading, empty, and error** states. Empty states offer the next action.
- Mutations show a pending state and disable the trigger. No double-submit.
- **No optimistic updates for orders, payments, or GCash balances.** The database is the truth.
- Forms use React Hook Form + zod. The same rules are enforced again in PostgreSQL.
- Use `aria-live` for toasts and status changes. Every input has a label. Focus states are visible.
- Status is never conveyed by color alone; use text plus color.
- No `dangerouslySetInnerHTML`.
- Respect `prefers-reduced-motion`.
- The PIN lock and staff guard are UX; the database remains authoritative.
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
- All functions are `security definer` with `search_path = ''` and fully qualified names (`public.sales_orders`, `private.sales_order_counters`).
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` then grant execution explicitly.
- Validate every argument: positive quantities, non-negative amounts, valid enums, trimmed/length-limited strings.
- Lock catalog rows with `SELECT ... FOR UPDATE` when importing so concurrent imports cannot create duplicate names.
- Write the business change and its `audit_events` row in the same transaction.
- Use stable error codes: `INVALID_DATE`, `INVALID_LABOR_SPLIT`, `PAYMENT_MISMATCH`, `PAYMENT_REQUIRED`, `CHANGE_TOO_LARGE`, `EMPTY_ORDER`, `ITEM_NOT_FOUND`, `INSUFFICIENT_GCASH`, `ORDER_NOT_FOUND`, `ORDER_LOCKED`, `FORBIDDEN`.
- Use `timestamptz`. Business date: `(now() at time zone 'Asia/Manila')::date`.
- Money columns end in `_centavos` and are integers. No `numeric` money, no floats.
- Use generated columns for line totals, order totals, and GCash share sums where possible.
- Use `security_invoker = true` on views.
- Use triggers only for timestamps and profile creation. Business logic belongs in functions.
- Mark catalog rows inactive with `is_active`. Do not hard-delete catalog rows that orders reference.
- Append-only tables (`audit_events`) have no update or delete grants.
- After any migration: `npm run db:types`, commit the generated file, and run `npm run db:types:check` in CI.
- Never change the schema from the Supabase dashboard. If it happens in an emergency, capture it as a migration immediately.

---

## 11. Auth, roles, and security

- Supabase Auth with a hidden internal email derived from the employee ID (`JJA-001` → `jja-001@staff.jja.internal`). Staff log in with the employee ID + password; they never see or type the email. Public sign-ups disabled. Two accounts: Aldwin and Magma.
- The signed-in person is shown as **You** in staff choices, order rows, reports, and GCash. The stored and exported names stay Aldwin/Magma.
- `profiles.role` remains `owner` or `mechanic` for legacy tables, but the sales log does not branch on it. Both staff have the same access to orders, items, reports, GCash, and settings.
- `private.is_staff()` is the security-definer helper used by RLS. Do not add owner-only checks to sales-log functions.
- The PIN is local, hashed with salted SHA-256 in `localStorage`. It is a screen lock, not identity. Never send it to the server.
- Lock after 5 minutes idle; five bad attempts force a full sign-out.
- `anon` may execute `ping()`, `get_sales_receipt(token)`, and the legacy `get_receipt(token)` / `verify_receipt(no, code)`.
- The new public receipt is issued only for paid orders and may show shop details, order number, job date, payment date, optional customer/bike, item names and quantities, labor total, extras, total charged, payments, change, and net paid. It never shows the internal labor split, costs, notes, or contact details.
- Public tokens are 128-bit random. If abuse appears, add per-IP throttling.
- Escape CSV formula injection on export.
- Do not add analytics, trackers, or third-party scripts without approval.
- Dependency policy: keep the tree small, commit the lockfile, review Dependabot PRs, and do not add abandoned packages.

---

## 12. Money, labor, GCash, and receipt rules

These are the highest-risk paths. Change them only with tests.

### Money and labor

- Integer centavos everywhere. Parse peso input with a string parser, not `parseFloat`.
- The database computes line totals, parts totals, order totals, and GCash allocations. The client never sends a total.
- A job saves with no payment (`OPEN`). Extras require a payment.
- A paid order requires payments = parts + labor + extras + change and a zero balance.
- Payment date defaults to today, may be backdated, cannot be future or before the job date.
- A paid order cannot become unpaid. Editing items/labor/extras requires rebalancing the payment.
- Change by method cannot exceed payments by that method.
- GCash change must come from someone who received a GCash payment, and cannot exceed that person's own payment.
- Helper share cannot exceed total labor; the main share is the remainder and is never negative.
- A helper must differ from the main worker.
- An extra goes to the main or helper on that order; the default is the main worker.
- Item names and prices are snapshotted on the order. A later catalog change never rewrites an old order.

### Stock

- The app does not track stock. Do not add quantities, reservations, or stock ledgers.
- QuickBooks owns stock and accounting. The old inventory tables are legacy and must not be used by new code.
- Catalog rows are marked inactive, never hard-deleted while orders reference them.

### GCash

- Every GCash payment records a recipient.
- Net GCash is split into a shop share (parts) and a labor share (labor plus extras). The split must sum exactly to net.
- Shop GCash held is the shop share minus transfers to the shop bank.
- Labor GCash held is the labor share plus transfers received minus transfers sent.
- A transfer cannot exceed the held balance; return `INSUFFICIENT_GCASH`.
- Month close (later step) requires shop GCash held to be zero unless a written carry-forward reason is recorded.

### Digital receipt

- Optional per paid order. Open jobs have no public receipt.
- Shows order, job date, payment date, optional customer/bike, items, labor total, optional extra/tip, total charged, payments received, and change returned.
- Never shows the internal labor split, costs, notes, or transfer data.
- A change to the receipt payload or public function must include a database test that a valid paid token returns the expected shape and an unknown or unpaid token returns null.
- The legacy receipt and verification functions remain for old links but are not used by new orders.

---

## 13. Testing

- Unit tests: money, dates, monthly report math, order balance math, CSV import mapping, error mapping, PIN, zod schemas.
- Database tests: every function and RLS policy. At minimum:
  - unpaid job save and later payment; open jobs never in sales views,
  - payment date validation and paid-date reports,
  - paid order rebalancing and refusal to unpay,
  - order create/edit with items, labor split, extras, payments, and change,
  - helper share over total and payment mismatch rejection,
  - custom and catalog line snapshots,
  - past-dated job numbering and paid-date reporting,
  - GCash allocation, held balances, and over-transfer rejection,
  - public receipt by paid token; open/missing token returns null;
  - staff-only reads; anon denied; direct table writes denied,
  - catalog import counts, idempotency, and full-list deactivation.
- E2E: login → unpaid job → item → helper split → job total → open jobs → take payment → extras → mixed cash/GCash → change → paid sales → report → GCash → digital receipt. Both staff see the same navigation and “You” labels.
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
- `docs/roadmap.md` is the delivery order and approval gates. Update it when a step is finished, split, blocked, or reordered.
- `docs/design.md` is the visual system. Update it when a token, layout, or component rule changes.
- `docs/runbook.md` is the operations manual. Update it when deploy, backup, restore, or staff procedures change.
- `docs/setup.md` is the first-run guide. Keep the commands accurate.
- `docs/decisions/NNNN-short-title.md` records non-obvious decisions. Use the existing format:
  - Context, decision, consequences.
- `docs/superpowers/plans/` holds implementation plans. Do not create plan files at the root.
- `README.md` is the quickstart. Keep it accurate.
- **Only `README.md` and `AGENTS.md` may live at the repository root.** Every other Markdown file goes under `docs/`.
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
11. Place every new file in the repository layout. Never create a new top-level folder or a root-level Markdown file without updating `AGENTS.md` and the plan.
12. Before a file approaches 1,000 lines, stop and split it. The size check is part of `npm run check`.
13. Read `docs/roadmap.md` before starting. Work only on the current step.
14. A step ends with `npm run check`, a demo script, and screenshots. Wait for the human architect's approval before starting the next step.
15. If a request belongs to a later step, write it in the roadmap instead of building it now.

---

## 17. Definition of done

A task is done only when:

- [ ] Behavior matches `docs/spec.md`, or the spec is updated in the same PR.
- [ ] The flow works on a 360px phone and on a laptop.
- [ ] Loading, empty, and error states exist.
- [ ] Permissions are enforced in the database and tested.
- [ ] Money, labor, GCash, or receipt changes have database tests.
- [ ] `npm run check` passes.
- [ ] Database tests and E2E pass in CI.
- [ ] `database.types.ts` is regenerated and current.
- [ ] Docs and ADRs are updated.
- [ ] No file exceeds 1,000 lines.
- [ ] No new Markdown file at the repository root.
- [ ] No secrets, no `console.log`, no raw SQL errors in the UI.
- [ ] The PR description lists what changed and how it was tested.

---

## 18. Scope and non-goals (current phase)

**In scope:** staff auth and PIN lock, sales-log navigation, QuickBooks catalog import, unpaid job save, later payment with extras/cash/GCash/change, paid-date reports, GCash held and transfers, optional digital receipt for paid orders, PWA shell, backups, keep-alive, CI. The approved follow-up is QuickBooks export, month lock, and reconciliation.

**Out of scope:** stock tracking, multi-shop, customer accounts, public storefront, online cart, QR ticket pass, camera scanner, part photos, partial returns, exchanges, email/SMS delivery, BIR official receipts, payroll, suppliers, purchase orders, loyalty points, offline sales, historical sales import.

If a request belongs to the out-of-scope list, say so and propose updating the spec and phase plan first.

---

## 19. Glossary

- **Order** — one customer sale, with items, labor, optional extras, payments, and change.
- **Open job** — an order saved before payment; no sales, labor, GCash, or receipt yet.
- **Paid order** — an order with a balanced payment and a payment date.
- **Catalog** — the QuickBooks item and price list. No stock.
- **Custom line** — an item not in QuickBooks, flagged on the order.
- **Main worker** — the person who gets the labor remainder.
- **Helper** — the second worker on an order, with a fixed labor share.
- **Extra** — a keep-the-change tip assigned to a worker.
- **Net GCash** — GCash payments minus GCash change.
- **Shop GCash held** — the parts share of GCash still in a personal account.
- **Labor GCash held** — the labor/extras share of GCash still in a personal account.
- **Transfer** — moving GCash to the shop bank or to the other worker.
- **Snapshot** — a frozen item name and price stored on an order.
- **Month close** — settle GCash, export parts sales, and lock the month (later step).
- **IIF** — the QuickBooks Desktop import file format.
- **RPC** — a PostgreSQL function called from the browser; the only way to write transactional data.
- **RLS** — Row Level Security; the database rules that decide which rows a user can see or change.
- **PWA** — an installable web app with an offline shell.
- **Anon key** — the public Supabase key. Safe only because RLS and functions restrict it.
- **Service role key** — the secret key that bypasses RLS. It never ships to the browser.
