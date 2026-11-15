# Motorcycle Parts & Repair Shop POS

A phone-friendly web app for one motorcycle parts and repair shop: walk-in tickets, inventory, payments, tamper-evident e-receipts, and daily sales for QuickBooks Desktop.

**Status:** Phase 0 foundation in progress — app scaffolded, design system and features following the implementation plan.

**Budget:** ₱0 per month. Static React app on Cloudflare, Supabase Free for auth, database, and realtime.

---

## Documentation

| Document | Purpose |
|---|---|
| [`docs/roadmap.md`](docs/roadmap.md) | Step-by-step delivery order and approval gates |
| [`docs/spec.md`](docs/spec.md) | Product and technical specification — the source of truth |
| [`docs/design.md`](docs/design.md) | Service Bay Ledger design system |
| [`AGENTS.md`](AGENTS.md) | Engineering rules and the contract for AI agents |
| [`docs/runbook.md`](docs/runbook.md) | Deploy, backup, restore, and incident procedures |
| [`docs/decisions/`](docs/decisions/) | Architecture decision records |

Read `docs/spec.md` and `AGENTS.md` before changing code.

---

## Stack

- React 19 + Vite + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui
- React Router + TanStack Query
- React Hook Form + zod
- Supabase (PostgreSQL, Auth, Realtime)
- `vite-plugin-pwa`
- Oxlint + Prettier
- Vitest + Playwright
- Cloudflare Workers static assets
- GitHub Actions

No Next.js, no custom server, no Prisma, no Fastify.

---

## Prerequisites

- Node.js 24+
- npm 11+
- A Supabase account (two free projects: staging and production)
- A Cloudflare account
- GitHub

Docker is optional locally. Database integration tests run in GitHub Actions; production and staging run on Supabase.

---

## Quickstart

```bash
npm install
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

The app runs at the URL printed by Vite.

### Environment

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Only the public anon key belongs in the browser. The service-role key is a CI-only secret.

### Database

```bash
npm run db:types   # regenerate TypeScript types after migrations
npm run db:push    # apply migrations to the linked Supabase project
```

Never change the schema from the Supabase dashboard. Use migrations.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build for production |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run test` | Unit tests |
| `npm run test:db` | Database integration tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run check` | Typecheck, lint, format check, unit tests, build |
| `npm run deploy` | Build and deploy to Cloudflare |

---

## Project layout

```text
src/
  app/            router, providers, layouts, guards
  components/ui/  shadcn primitives
  features/       auth, bay, inventory, owner, pwa, receipts, settings
  hooks/          cross-feature hooks
  lib/            supabase, money, dates, csv, errors, print, pin
  routes/         thin page components
  styles/
  types/          generated database types + domain types
supabase/
  migrations/  seed.sql
tests/
  setup/ unit/ db/ e2e/
docs/
  spec.md  design.md  runbook.md  setup.md  decisions/  superpowers/plans/
scripts/
  check-file-size.mjs
.agents/skills/    Supabase-provided skills
.opencode/skills/  Project-local skills
```

---

## House rules (short version)

- The browser never writes transactional tables directly; use PostgreSQL functions.
- Money is integer centavos; the database computes totals.
- Stock changes always write a ledger row in the same transaction.
- Completed tickets and receipts are immutable. Void the sale and create a new ticket.
- Roles are enforced by RLS and functions, not by hiding buttons.
- The service-role key never reaches the browser.
- No source file may exceed 1,000 lines; split by responsibility.
- The repository root contains only `README.md` and `AGENTS.md`; other docs go under `docs/`.
- `npm run check` must pass before a change is complete.

The full rules are in [`AGENTS.md`](AGENTS.md).

---

## License

Private and proprietary. Not for redistribution.
