# Foundation & Tech Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the production-grade foundation for the shop app: a static React PWA with the full design system, auth shell, Supabase baseline, local OpenCode skills, CI, and a Cloudflare deploy.

**Architecture:** A static React + Vite SPA served from Cloudflare Workers static assets. Supabase provides auth, PostgreSQL, and realtime. The browser never writes transactional tables directly; all writes go through PostgreSQL functions. This plan covers **Phase 0 only** — the shell, tooling, design system, and baseline database. Inventory, bay, receipts, and owner features get separate plans.

**Tech Stack:** React, Vite, TypeScript (strict), Tailwind CSS v4, shadcn/ui, React Router, TanStack Query, React Hook Form + zod, Supabase JS, `vite-plugin-pwa`, Oxlint + Prettier, Vitest, Testing Library, Playwright, Cloudflare Workers static assets, GitHub Actions.

**Spec:** `docs/spec.md`

## Global Constraints

- Node 24+, npm 11+.
- ₱0/month hosting and database. No paid services.
- Static SPA only. No Next.js, no custom API server, no Workers functions.
- Supabase `anon` key only in the browser. The service-role key never ships.
- Money is integer centavos. No floats.
- Business dates use `Asia/Manila`.
- Every table has RLS, default deny.
- Writes go through PostgreSQL functions; reads use RLS.
- Minimum touch target 48px. Primary actions 56px.
- Mobile-first down to 360px.
- No secrets in the repo. `.env.local` is gitignored.
- `npm run check` must pass before any task is marked complete.
- Database types are generated, never hand-edited.
- Conventional commits, one focused commit per task.

## Review Focus

These are the failure modes most likely to bite a real user in Phase 0. Each is pinned to a test in the task that owns it.

1. **Missing Supabase environment variables on first load** — the app must show a clear setup screen, not a white page or an unhandled exception. (Task 4)
2. **A mechanic typing `/owner` directly** — the app must redirect, not render the owner screen. Hiding the nav item is not enough. (Task 3)
3. **An installed PWA serving stale data after a deploy** — Supabase responses must never be cached, and updates must prompt instead of reloading mid-ticket. (Task 6)
4. **Long shop names, ticket numbers, or customer names at 360px** — no horizontal overflow; text must truncate or wrap deliberately. (Tasks 2 and 3)
5. **A session expiring while the app is locked** — the lock screen must explain what happened and return to login, never trap the user. (Task 4)

---

## File Structure (Phase 0)

```text
src/
  app/
    App.tsx                 root component and setup guard
    providers.tsx           QueryClient, AuthProvider, Toaster
    router.tsx              createBrowserRouter routes
    guards/
      RequireStaff.tsx
      RequireOwner.tsx
    layouts/
      StaffLayout.tsx
      PublicLayout.tsx
  components/
    ui/                     shadcn primitives (generated and edited)
    AppNav.tsx
    BrandMark.tsx
    ConnectionStatus.tsx
    EmptyState.tsx
    PageHeader.tsx
    StatusBadge.tsx
  features/
    auth/
      auth-context.ts
      AuthProvider.tsx
      LoginPage.tsx
      LockPage.tsx
      PinPad.tsx
      pin.ts
      schemas.ts
      useAuth.ts
      useIdleLock.ts
    pwa/
      OfflineBanner.tsx
      UpdatePrompt.tsx
  lib/
    supabase.ts
    utils.ts
    use-online-status.ts
  routes/
    LoginRoute.tsx
    LockRoute.tsx
    BayRoute.tsx
    TicketRoute.tsx
    InventoryRoute.tsx
    OwnerRoute.tsx
    OwnerSalesRoute.tsx
    OwnerAuditRoute.tsx
    OwnerSettingsRoute.tsx
    ReceiptRoute.tsx
    VerifyRoute.tsx
    NotFoundRoute.tsx
  styles/
    globals.css
  types/
    database.types.ts       generated
    domain.ts               Role, Profile, AppError
tests/
  setup/
    setup.ts
    db.ts
  unit/
  db/
  e2e/
supabase/
  config.toml
  migrations/
  seed.sql
public/
  mark.svg
  pwa-192x192.png
  pwa-512x512.png
  maskable-icon-512x512.png
  apple-touch-icon-180x180.png
docs/
  design.md
  setup.md
  superpowers/plans/2026-11-15-foundation-and-tech-stack.md
.opencode/
  skills/
    pos-ui/SKILL.md
    supabase-rpc/SKILL.md
    pwa/SKILL.md
    receipt-integrity/SKILL.md
    playwright-e2e/SKILL.md
.github/
  workflows/
    ci.yml
    deploy.yml
    backup.yml
    keepalive.yml
wrangler.jsonc
opencode.jsonc
```

---

### Task 1: Scaffold the Vite app and tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/styles/globals.css`, `src/vite-env.d.ts`, `.oxlintrc.json`, `.prettierrc`, `.prettierignore`, `vitest.config.ts`, `tests/setup/setup.ts`, `tests/unit/app.test.tsx`
- Modify: `.gitignore` if needed

**Interfaces:**
- Produces: the exact npm scripts from `AGENTS.md`; `@/` alias; strict TypeScript; Vitest running in jsdom; `App` as the root component.

- [ ] **Step 1: Scaffold without overwriting the docs**

Run in the repo root:

```bash
npm create vite@latest .vite-scaffold -- --template react-ts
```

Copy `index.html`, `src/`, `public/`, `package.json`, `tsconfig.json`, `tsconfig.app.json`, and `tsconfig.node.json` from `.vite-scaffold` into the repo root. Do not overwrite `docs/`, `AGENTS.md`, `README.md`, or `.github/`. Delete `.vite-scaffold`.

- [ ] **Step 2: Install runtime and development dependencies**

```bash
npm install react-router @tanstack/react-query @supabase/supabase-js zod react-hook-form @hookform/resolvers @tanstack/react-table sonner qrcode.react papaparse lucide-react clsx tailwind-merge class-variance-authority
npm install -D typescript vite @vitejs/plugin-react vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom oxlint prettier prettier-plugin-tailwindcss @playwright/test supabase wrangler @types/node @types/papaparse
```

- [ ] **Step 3: Configure strict TypeScript and the `@/` alias**

In `tsconfig.app.json`, add `"noUncheckedIndexedAccess": true`, `"verbatimModuleSyntax": true`, and:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

In `vite.config.ts`, add the alias:

```ts
resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } }
```

- [ ] **Step 4: Add the npm scripts**

Add every script from `AGENTS.md` section 6 to `package.json`. `npm run check` must run:

```json
"typecheck": "tsc --noEmit",
"lint": "oxlint",
"format:check": "prettier --check .",
"test": "vitest run tests/unit",
"build": "npm run typecheck && vite build",
"check": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build"
```

Add `test:db`: `vitest run tests/db`, and `test:e2e`: `playwright test`.

- [ ] **Step 5: Configure Oxlint and Prettier**

Use `.oxlintrc.json` with the React, TypeScript, JSX accessibility, and import plugins. Ignore `dist/`, `coverage/`, `playwright-report/`, `test-results/`, and `src/types/database.types.ts`.

Create `.prettierrc`:

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 6: Configure Vitest**

Create `vitest.config.ts` with the React plugin, the `@/` alias, `environment: 'jsdom'`, `setupFiles: ['./tests/setup/setup.ts']`, and `css: true`.

`tests/setup/setup.ts` imports `@testing-library/jest-dom/vitest` and cleans up after each test.

- [ ] **Step 7: Write the failing smoke test**

`tests/unit/app.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from '@/app/App';

test('renders the application name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /motor works/i })).toBeInTheDocument();
});
```

- [ ] **Step 8: Run the test and verify it fails**

Run: `npm run test -- tests/unit/app.test.tsx`
Expected: FAIL because `App` does not exist.

- [ ] **Step 9: Implement the minimal `App`**

`src/app/App.tsx` renders a single `<h1>Motor Works POS</h1>` inside a `<main>`. `src/main.tsx` imports `./styles/globals.css` and renders `<App />` into `#root`. Create an empty `src/styles/globals.css` for now.

- [ ] **Step 10: Run the test and the full check**

Run: `npm run test -- tests/unit/app.test.tsx` — PASS.
Run: `npm run check` — PASS.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts tsconfig*.json index.html eslint.config.js .prettierrc .prettierignore src tests
git commit -m "chore: scaffold Vite React app with strict TypeScript and checks"
```

---

### Task 2: Design tokens, fonts, shadcn, and the design document

**Files:**
- Create: `docs/design.md`, `src/lib/utils.ts`, `components.json`, `src/components/BrandMark.tsx`, `src/components/StatusBadge.tsx`, `tests/unit/status-badge.test.tsx`, `tests/unit/button.test.tsx`
- Modify: `src/styles/globals.css`, `src/main.tsx`, `src/app/App.tsx`, `vite.config.ts`
- Generated: `src/components/ui/*` via shadcn CLI

**Interfaces:**
- Produces: CSS tokens; `cn(...classes)`; `Button` with `size="touch"`; `StatusBadge` for every ticket status; `BrandMark`; `Input`, `Label`, `Select`, `Dialog`, `AlertDialog`, `Sheet`, `Table`, `Badge`, `Tabs`, `Tooltip`, `Skeleton`, `Separator`, `Toaster`.

- [ ] **Step 1: Install Tailwind v4 and the fonts**

```bash
npm install tailwindcss @tailwindcss/vite @fontsource/barlow @fontsource/barlow-condensed @fontsource/ibm-plex-mono
npm install -D @vite-pwa/assets-generator
```

Add `tailwindcss()` from `@tailwindcss/vite` to `vite.config.ts` plugins.

- [ ] **Step 2: Write the design document**

Create `docs/design.md` with the following direction. Do not substitute a generic palette.

**Concept:** *Service Bay Ledger.* A precision workshop instrument, not a SaaS dashboard. Paper, ink, steel, and one safety-orange accent. Condensed industrial type, hard rules, tabular numbers, and work-order layouts.

**Palette**

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F1F2EE` | App background |
| `surface` | `#FFFFFF` | Sheets, inputs, receipt |
| `ink` | `#12181A` | Primary text, primary button text |
| `ink-soft` | `#3A4448` | Secondary text |
| `steel` | `#66727A` | Muted text, icons, meta |
| `line` | `#CDD2CC` | Borders and dividers |
| `line-strong` | `#A9B0A8` | Strong rules |
| `safety` | `#E84E1B` | Single brand accent, focus, primary actions |
| `safety-dark` | `#B83A10` | Pressed primary |
| `blueprint` | `#245B78` | Informational links and in-progress state |
| `ok` | `#2E7D4F` | Ready/success |
| `warn` | `#A66A00` | Verifying/warning |
| `danger` | `#B3261E` | Errors, void, cancel |

Never use gradients, glass, soft grey card shadows, or a second brand accent.

**Type**

- Display and headings: **Barlow Condensed** 600/700.
- UI and body: **Barlow** 400/500/600/700.
- Codes and receipt numbers: **IBM Plex Mono** 500.
- Tabular numerals for every money value: `font-variant-numeric: tabular-nums`.
- Scale: 12 / 14 / 16 / 18 / 20 / 24 / 28 / 36 / 48. Body 16/1.55, display 1.0–1.1.
- Sentence case everywhere except codes and ticket numbers. No all-caps eyebrow labels.

**Layout**

- Mobile: top bar with shop name, connection dot, lock button; bottom tab bar (Bay, Stock, Owner if owner); 48px targets, 56px primary actions.
- Desktop: left rail with brand, nav, staff identity; content max-width 1280px.
- Bay: a dispatch board. On mobile, a vertical list of job rows with a 4px status stripe. On desktop, a 380px queue beside a ticket work-order sheet.
- Ticket: parts/labor tables, sticky summary rail on desktop, sticky total bar on mobile.
- Inventory: dense ledger table; filters above; edit in a sheet, never inline cells.
- Owner: a ledger page with rules, large tabular numbers, no card grid.
- Receipt: a white sheet with a dashed perforation rule, shop header, items, totals, payment, verification code in mono, QR, and a stamped VERIFIED mark.
- Verify: single-purpose page with two large inputs and a result panel.

**Components**

- Radius: 4px for labels/inputs, 8px for buttons/sheets. No pill-everything.
- Borders: 1px `line`; no soft shadows. Primary button uses a 2px hard offset shadow (`safety-dark`) and translates 2px on press.
- Status colors are functional and always paired with a text label.
- Focus: 2px `safety` ring, 2px offset.
- Motion: 120ms queue row slide/fade and status progress; no page-load cascade. Respect `prefers-reduced-motion`.
- Icons: lucide, 20px; 24px in navigation.

**Copy**

- Verbs, sentence case: “New ticket”, “Add part”, “Add labor”, “Verify part”, “Take payment”, “Complete ticket”, “Void sale”, “Day close”.
- Errors say what happened and what to do next. No “Submit”, “OK”, or “An error occurred”.
- Empty states offer the next action.

**Why this is not the default AI look**

No cream-and-terracotta palette, no near-black-and-acid-green, no broadsheet columns, no identical rounded cards with soft shadows, no all-caps eyebrows or monospace labels. The distinctive element is the dispatch-board/work-order structure and the safety-orange industrial accent.

- [ ] **Step 3: Write the failing component tests**

`tests/unit/button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Button } from '@/components/ui/button';

test('touch buttons meet the 48px target', () => {
  render(<Button size="touch">New ticket</Button>);
  expect(screen.getByRole('button', { name: 'New ticket' }).className).toContain('h-12');
});
```

`tests/unit/status-badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { StatusBadge } from '@/components/StatusBadge';

test('in-progress status shows a text label, not only color', () => {
  render(<StatusBadge status="IN_PROGRESS" />);
  expect(screen.getByText('In progress')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the tests and verify they fail**

Run: `npm run test -- tests/unit/button.test.tsx tests/unit/status-badge.test.tsx`
Expected: FAIL because the components do not exist.

- [ ] **Step 5: Initialize shadcn and add primitives**

```bash
npx shadcn@latest init -d -y
npx shadcn@latest add button input label textarea select dialog alert-dialog sheet dropdown-menu table badge tabs tooltip skeleton separator sonner
```

If the CLI creates `src/index.css`, move it to `src/styles/globals.css` and point `components.json` `tailwind.css` at it. Ensure `src/lib/utils.ts` exports:

```ts
export function cn(...inputs: ClassValue[]): string
```

- [ ] **Step 6: Replace `globals.css` with the tokens**

Import Tailwind with `@import "tailwindcss";`. Define the palette in `@theme` as `--color-paper`, `--color-surface`, `--color-ink`, `--color-ink-soft`, `--color-steel`, `--color-line`, `--color-line-strong`, `--color-safety`, `--color-safety-dark`, `--color-blueprint`, `--color-ok`, `--color-warn`, `--color-danger`. Define font families `--font-ui`, `--font-display`, `--font-mono`. Set the body background to `paper`, text to `ink`, font to `font-ui`, and enable tabular numerals on `.tabular`. Add a visible focus ring using `safety`. Import the font CSS in `src/main.tsx`:

```ts
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/globals.css';
```

- [ ] **Step 7: Add the touch size and status badge**

Extend `buttonVariants` with `size: { touch: 'h-12 px-5 text-base min-w-12' }`. Create `StatusBadge` with the statuses `PENDING`, `VERIFYING`, `IN_PROGRESS`, `READY`, `COMPLETED`, `CANCELLED`, `VOIDED`, mapping each to a label and a color pair. Always render the label text.

Create `BrandMark`: a simple SVG hex-bolt with an `M` cut, `aria-hidden` by default, accepting a `className`.

- [ ] **Step 8: Run the tests and the full check**

Run: `npm run test -- tests/unit/button.test.tsx tests/unit/status-badge.test.tsx` — PASS.
Run: `npm run check` — PASS.

- [ ] **Step 9: Commit**

```bash
git add docs/design.md components.json src/components src/lib src/styles src/main.tsx vite.config.ts package.json package-lock.json tests
git commit -m "feat: add workshop design tokens, fonts, and shadcn primitives"
```

---

### Task 3: App shell, routes, guards, and navigation

**Files:**
- Create: `src/types/domain.ts`, `src/app/router.tsx`, `src/app/providers.tsx`, `src/app/guards/RequireStaff.tsx`, `src/app/guards/RequireOwner.tsx`, `src/app/layouts/StaffLayout.tsx`, `src/app/layouts/PublicLayout.tsx`, `src/components/AppNav.tsx`, `src/components/ConnectionStatus.tsx`, `src/components/EmptyState.tsx`, `src/components/PageHeader.tsx`, `src/routes/*.tsx`, `tests/unit/router.test.tsx`, `tests/unit/guards.test.tsx`
- Modify: `src/main.tsx`, `src/app/App.tsx`

**Interfaces:**
- Produces:

```ts
export type Role = 'owner' | 'mechanic';
export type Profile = { id: string; displayName: string; role: Role };

export type AuthState =
  | { status: 'loading'; profile: null }
  | { status: 'signed-out'; profile: null }
  | { status: 'signed-in'; profile: Profile };
```

- `useAuth()` is defined in `src/features/auth/useAuth.ts` in Task 4. For this task, define the context contract in `src/features/auth/auth-context.ts` and export a `useAuth` that throws if used outside a provider. Tests wrap components in a mock provider.

- [ ] **Step 1: Write the failing guard tests**

`tests/unit/guards.test.tsx` must assert:

- signed-out + `/bay` → redirects to `/login`;
- mechanic + `/owner` → redirects to `/bay`;
- owner + `/owner` → renders the owner placeholder;
- mechanic sees Bay and Stock nav items but not Owner;
- owner sees Owner;
- an unknown route renders the not-found page.

Use `createMemoryRouter` with the real route tree, wrapped in a mock `AuthContext.Provider`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- tests/unit/guards.test.tsx`
Expected: FAIL because the router and guards do not exist.

- [ ] **Step 3: Create the route tree and layouts**

Routes: `/login`, `/lock`, `/bay`, `/bay/ticket/:id`, `/inventory`, `/owner`, `/owner/sales`, `/owner/audit`, `/owner/settings`, `/r/:token`, `/verify`, `*`.

- `PublicLayout`: minimal brand header; used by login, receipt, verify.
- `StaffLayout`: desktop left rail + mobile top bar and bottom nav; renders `ConnectionStatus`, `OfflineBanner`, `UpdatePrompt`, and an `<Outlet />`.
- `RequireStaff`: loading → skeleton; signed-out → `<Navigate to="/login" replace />`; signed-in → outlet.
- `RequireOwner`: non-owner → `<Navigate to="/bay" replace />`.
- `AppNav`: Bay, Stock, and Owner (owner only). Use `NavLink`; active state is a safety-orange left bar, not a filled pill.
- Placeholder route components use `PageHeader` and `EmptyState` so every screen has a real empty state.

- [ ] **Step 4: Add long-content protection**

In the job row and page header, use `min-w-0` with `truncate` for shop names, customer names, and bike models. Add a `data-testid="shop-name"` to the header. The guard test includes a 120-character shop name and asserts the header has the `truncate` class.

- [ ] **Step 5: Run the tests and the full check**

Run: `npm run test -- tests/unit/guards.test.tsx` — PASS.
Run: `npm run check` — PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app src/components src/routes src/types tests
git commit -m "feat: add app shell, routes, role guards, and navigation"
```

---

### Task 4: Auth provider, login, PIN lock, and idle lock

**Files:**
- Create: `src/lib/supabase.ts`, `src/features/auth/auth-context.ts`, `AuthProvider.tsx`, `LoginPage.tsx`, `LockPage.tsx`, `PinPad.tsx`, `pin.ts`, `schemas.ts`, `useAuth.ts`, `useIdleLock.ts`, `tests/unit/pin.test.ts`, `tests/unit/login.test.tsx`, `tests/unit/lock.test.tsx`, `tests/unit/idle-lock.test.tsx`, `tests/unit/auth-provider.test.tsx`, `tests/unit/setup-required.test.tsx`
- Modify: `src/app/App.tsx`, `src/app/providers.tsx`, `src/app/router.tsx`, `src/app/layouts/StaffLayout.tsx`

**Interfaces:**
- `createSupabaseClient(): SupabaseClient` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; if missing, `App` renders a setup screen with the variable names.
- `useAuth()` returns `{ status, profile, signIn(email, password), signOut(), refreshProfile() }`.
- `pin.ts` exports:

```ts
export function hashPin(pin: string, salt?: string): Promise<{ salt: string; hash: string }>
export function verifyPin(pin: string, stored: { salt: string; hash: string }): Promise<boolean>
export function getPinRecord(userId: string): { salt: string; hash: string; attempts: number } | null
export function savePin(userId: string, pin: string): Promise<void>
export function clearPin(userId: string): void
export function recordFailedAttempt(userId: string): number
```

- `useIdleLock(timeoutMs: number, onLock: () => void): void`.
- `PinPad` props: `{ onComplete: (pin: string) => void; disabled?: boolean; error?: string }`. Keys are at least 64px.

- [ ] **Step 1: Write the failing PIN tests**

`tests/unit/pin.test.ts`:

- `hashPin('1234')` and `verifyPin('1234', stored)` → true.
- `verifyPin('0000', stored)` → false.
- Hashing the same PIN twice yields different salts and hashes.
- `recordFailedAttempt` returns 1, 2, 3, 4, 5; after 5, the caller clears the PIN.

- [ ] **Step 2: Write the failing auth and lock tests**

- Login form rejects an empty email and shows a validation message.
- Login form rejects a password shorter than 6 characters.
- Lock screen shows the staff display name and a 4-digit keypad.
- Five wrong PINs call `signOut` and clear the PIN.
- Idle lock fires after the timeout and resets on a pointer event.
- A `SIGNED_OUT` auth event while on `/lock` shows “Session expired. Sign in again.” and links to `/login`.
- Missing env vars render the setup screen naming `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 3: Run the tests and verify they fail**

Run: `npm run test -- tests/unit/pin.test.ts tests/unit/login.test.tsx tests/unit/lock.test.tsx tests/unit/idle-lock.test.tsx tests/unit/auth-provider.test.tsx tests/unit/setup-required.test.tsx`
Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement the Supabase client**

```ts
export const isSupabaseConfigured: boolean
export function createSupabaseClient(): SupabaseClient
```

Use `createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })`. Throw a typed `AppError` with code `MISSING_ENV` when variables are absent.

- [ ] **Step 5: Implement the auth provider**

On mount: `getSession`, subscribe to `onAuthStateChange`, fetch `profiles` with `select('id, display_name, role').eq('id', userId).single()`. Map `display_name` to `displayName`. If the profile is missing, sign out and show an error. Expose `signIn`, `signOut`, and `refreshProfile`.

- [ ] **Step 6: Implement the PIN storage and hashing**

Use `crypto.subtle.digest('SHA-256', ...)` over `salt + ':' + pin`. Salt is 16 random bytes as hex. Store in `localStorage` under `pos.pin.<userId>` as JSON. A wrong attempt increments `attempts`; five attempts clear the record and require a full login. The PIN never leaves the browser.

- [ ] **Step 7: Implement the login and lock screens**

- Login: split layout on desktop, compact on mobile. Shop mark, email/password, pending state, inline errors, link to the lock screen if a session exists.
- First sign-in with no PIN: `/lock` shows “Set a 4-digit PIN”, asks twice, then saves and goes to `/bay`.
- Normal lock: staff name, Manila clock, PIN pad, “Sign in with another account”.
- `StaffLayout` calls `useIdleLock(5 * 60_000, () => navigate('/lock'))` while signed in.

- [ ] **Step 8: Run the tests and the full check**

Run: `npm run test -- tests/unit/pin.test.ts tests/unit/login.test.tsx tests/unit/lock.test.tsx tests/unit/idle-lock.test.tsx tests/unit/auth-provider.test.tsx tests/unit/setup-required.test.tsx` — PASS.
Run: `npm run check` — PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase.ts src/features/auth src/app tests
git commit -m "feat: add staff auth, PIN screen lock, and idle lock"
```

---

### Task 5: Supabase baseline migrations, generated types, and database tests

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20261115000100_extensions.sql`, `20261115000200_profiles.sql`, `20261115000300_shop_settings.sql`, `20261115000400_private_helpers.sql`, `20261115000500_ping.sql`, `supabase/seed.sql`, `src/types/database.types.ts`, `tests/setup/db.ts`, `tests/db/profiles.test.ts`, `tests/db/settings.test.ts`, `tests/db/helpers.test.ts`
- Modify: `package.json`, `.env.example` (add test-only variables documented in comments), `docs/spec.md` only if a real ambiguity is found

**Interfaces:**
- `profiles`: `id uuid`, `display_name text`, `role text`, `created_at`, `updated_at`.
- `shop_settings`: single row `id = 1`, shop details, `low_stock_default`, `timezone`, `currency`.
- `private.is_staff(): boolean`, `private.is_owner(): boolean`.
- `public.ping(): boolean` callable by `anon`.
- Generated `Database` type in `src/types/database.types.ts`.

`tests/setup/db.ts` exports:

```ts
export function getServiceClient(): SupabaseClient;
export function getAnonClient(): SupabaseClient;
export async function createStaffUser(input: {
  email: string;
  password: string;
  displayName: string;
  role: 'owner' | 'mechanic';
}): Promise<{ id: string; email: string; password: string }>;
export async function deleteUser(id: string): Promise<void>;
```

The helper uses `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, and `TEST_SUPABASE_SERVICE_ROLE_KEY`. It must refuse to run if the URL contains the production project ref.

- [ ] **Step 1: Write the failing database tests**

`tests/db/helpers.test.ts`:

- `anon` calling `ping()` returns true.
- `anon` reading `profiles` returns an empty array.
- A staff user can read their own profile.
- A mechanic has `is_staff = true` and `is_owner = false`.
- An owner has `is_owner = true`.

`tests/db/profiles.test.ts`:

- Creating an auth user creates a profile with `role = 'mechanic'`.
- The display name comes from `raw_user_meta_data.display_name`, falling back to the email prefix.
- A mechanic cannot update another profile; an owner can change a role.

`tests/db/settings.test.ts`:

- The single settings row exists with `timezone = 'Asia/Manila'`.
- `anon` cannot read settings.
- A staff user can read settings.
- A mechanic cannot update settings (owner settings function is a later phase).

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test:db`
Expected: FAIL because the tables and functions do not exist. If `TEST_SUPABASE_URL` is unset, the suite prints “Skipping database tests — set TEST_SUPABASE_URL” and exits non-zero so CI catches a misconfiguration.

- [ ] **Step 3: Create the extension and profiles migration**

Enable `pgcrypto`. Create `public.profiles` with a `role` check constraint and timestamps. Enable RLS. Add policies:

```sql
create policy "staff can read profiles" on public.profiles
for select to authenticated using (private.is_staff());

create policy "owners can update profiles" on public.profiles
for update to authenticated using (private.is_owner()) with check (private.is_owner());
```

Revoke insert/delete from `authenticated`; grant select and update-only-through-policy. Create `private.handle_new_user()` as `security definer` with `search_path = ''`, inserting `coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))` and the default role, with `on conflict (id) do nothing`. Attach it to `auth.users` after insert. Add the `set_updated_at` trigger.

- [ ] **Step 4: Create the settings migration**

Create the single-row table with `id smallint primary key check (id = 1)`. Insert the default row. Enable RLS with a staff-select policy. No direct writes. Add `updated_at`/`updated_by`.

- [ ] **Step 5: Create the private helpers and ping**

```sql
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = auth.uid()) $$;

create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') $$;
```

Revoke all from `public`; grant execute to `authenticated`. Create `public.ping()` returning `true`, `security invoker`, `stable`; grant execute to `anon` and `authenticated`.

- [ ] **Step 6: Generate the types and push the migrations**

```bash
npm run db:types
```

The script runs `supabase gen types typescript --linked > src/types/database.types.ts`. If the staging project is not linked yet, complete the Setup Checkpoint below first, then rerun.

- [ ] **Step 7: Run the database tests against the staging project**

Set `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, and `TEST_SUPABASE_SERVICE_ROLE_KEY` to the staging project. Run `npm run test:db`. Expected: PASS.

Never point these variables at production.

- [ ] **Step 8: Run the full check and commit**

```bash
npm run check
git add supabase src/types tests package.json
git commit -m "feat: add profiles, settings, RLS helpers, and generated types"
```

#### Setup Checkpoint (human, required before Step 6)

1. Create two Supabase projects: `staging` and `production`.
2. Install and log in to the Supabase CLI: `npx supabase login`.
3. Link staging: `npx supabase link --project-ref <staging-ref>`.
4. Push migrations: `npm run db:push`.
5. Create two auth users in the staging dashboard: Dad (owner) and Uncle (mechanic). Set Dad's `profiles.role` to `owner` in the SQL editor.
6. Copy the staging URL, anon key, and service-role key into `.env.local` and the test environment.

---

### Task 6: PWA baseline — manifest, icons, offline banner, update prompt

**Files:**
- Create: `public/mark.svg`, `pwa-assets.config.ts`, `src/features/pwa/OfflineBanner.tsx`, `src/features/pwa/UpdatePrompt.tsx`, `src/features/pwa/UpdatePromptContainer.tsx`, `src/lib/use-online-status.ts`, `tests/unit/offline-banner.test.tsx`, `tests/unit/update-prompt.test.tsx`
- Modify: `vite.config.ts`, `index.html`, `src/app/layouts/StaffLayout.tsx`, `src/app/layouts/PublicLayout.tsx`
- Generated: PWA icon PNGs in `public/`

**Interfaces:**
- `useOnlineStatus(): boolean` listens to `online` and `offline`.
- `OfflineBanner` renders a fixed banner with the text “Offline — changes are disabled.”
- `UpdatePrompt` is presentational: `{ open: boolean; onRefresh: () => void; onDismiss: () => void }`. `UpdatePromptContainer` uses `useRegisterSW` from `virtual:pwa-register/react`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/offline-banner.test.tsx`:

- Online → no banner.
- Offline event → banner text appears.
- Online event → banner disappears.

`tests/unit/update-prompt.test.tsx`:

- `open=false` → nothing rendered.
- `open=true` → “A new version is ready.” with Refresh and Later.
- Refresh calls `onRefresh`; Later calls `onDismiss`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- tests/unit/offline-banner.test.tsx tests/unit/update-prompt.test.tsx`
Expected: FAIL because the components do not exist.

- [ ] **Step 3: Create the brand mark and icons**

Create `public/mark.svg`: a bold hexagonal bolt head with a slotted `M`, ink on a safety-orange field, viewBox 512. Create `pwa-assets.config.ts`:

```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';
export default defineConfig({ preset: minimal2023Preset, images: ['public/mark.svg'] });
```

Run `npx pwa-assets-generator`. Commit the generated PNGs.

- [ ] **Step 4: Configure the PWA**

Add `VitePWA` to `vite.config.ts`:

```ts
VitePWA({
  registerType: 'prompt',
  includeAssets: ['mark.svg', 'apple-touch-icon-180x180.png'],
  manifest: {
    name: 'Motor Works POS',
    short_name: 'Motor Works',
    description: 'Tickets, stock, and receipts for the shop',
    theme_color: '#12181A',
    background_color: '#F1F2EE',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    navigateFallback: '/index.html',
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/.*/i,
        handler: 'NetworkOnly',
      },
    ],
  },
})
```

Add the manifest and theme meta tags to `index.html`.

- [ ] **Step 5: Implement the offline banner and update prompt**

`useOnlineStatus` uses `useSyncExternalStore` over `navigator.onLine` and the two events. `OfflineBanner` is fixed above the content with a `danger` border. `UpdatePrompt` is a bottom sheet on mobile and a bottom-right panel on desktop. It never auto-reloads.

- [ ] **Step 6: Run the tests and build**

Run: `npm run test -- tests/unit/offline-banner.test.tsx tests/unit/update-prompt.test.tsx` — PASS.
Run: `npm run build`.
Expected: `dist/sw.js` and `dist/manifest.webmanifest` exist.

- [ ] **Step 7: Commit**

```bash
git add public pwa-assets.config.ts src/features/pwa src/lib/use-online-status.ts src/app vite.config.ts index.html tests
git commit -m "feat: add installable PWA, offline banner, and update prompt"
```

---

### Task 7: Install the project-local OpenCode skills

**Files:**
- Create: `.opencode/skills/pos-ui/SKILL.md`, `.opencode/skills/supabase-rpc/SKILL.md`, `.opencode/skills/pwa/SKILL.md`, `.opencode/skills/receipt-integrity/SKILL.md`, `.opencode/skills/playwright-e2e/SKILL.md`, `opencode.jsonc`

**Interfaces:**
- Each skill has frontmatter `name` and `description`; the directory name is the stable ID.
- OpenCode discovers `.opencode/skills/<id>/SKILL.md` automatically.

- [ ] **Step 1: Load the `writing-skills` skill**

Follow it before writing any skill. Do not skip the frontmatter or the description; a skill without a description is not advertised to the model.

- [ ] **Step 2: Create `pos-ui`**

Description: “Use when building or changing any screen in the shop app — bay, inventory, owner, receipts, or auth. Enforces the Service Bay Ledger design system, 48px targets, mobile-first layouts, and the project's copy rules.”

Body: read `docs/design.md` and `AGENTS.md`; use only shadcn primitives; use the palette tokens; no gradients/card soup; every data screen has loading/empty/error states; money uses tabular numerals; status always has a text label; no optimistic writes for stock/money; 360px test; focus rings; reduced motion. Include the exact token names and the status-label mapping.

- [ ] **Step 3: Create `supabase-rpc`**

Description: “Use when adding or changing a database table, migration, RLS policy, PostgreSQL function, or generated type.”

Body: migrations only; RLS on every table; no direct writes; `security definer` + `search_path = ''`; revoke `public`; grant explicitly; stable error codes; lock parts in `part_id` order; ledger + audit in the same transaction; test RPC behavior and permissions; regenerate `database.types.ts`; never point tests at production.

- [ ] **Step 4: Create `pwa`**

Description: “Use when changing the manifest, service worker, install flow, offline behavior, or update prompt.”

Body: `vite-plugin-pwa` with `registerType: 'prompt'`; never cache `*.supabase.co` (NetworkOnly); offline disables writes; update prompt never reloads mid-form; icons 192/512/maskable; test install on Android Chrome and iPhone Safari; HTTPS required; do not add push notifications or background sync in phase 1.

- [ ] **Step 5: Create `receipt-integrity`**

Description: “Use when changing receipt numbering, snapshots, verification codes, the public receipt page, the verify page, or void sales.”

Body: daily sequence in `private.receipt_counters`; immutable snapshot; HMAC-SHA256 over `receipt_no | issued_at | total | sha256(snapshot)`; 16-hex-character display code; 128-bit public token; verify response limited to status/date/total/method; integrity report; void sale restores stock, refunds, marks receipt/ticket VOID; tests for valid, tampered, void, missing number. Never edit a snapshot.

- [ ] **Step 6: Create `playwright-e2e`**

Description: “Use when writing or changing Playwright end-to-end tests for the shop app.”

Body: seed auth users through the service-role admin API; reset data between tests; select by role and accessible name, not CSS; test the critical path (login → ticket → part → labor → verify → pay → receipt → stock down → owner sale → day close → CSV); mock nothing that touches money or stock; run against local Supabase in CI; never production.

- [ ] **Step 7: Add `opencode.jsonc`**

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "watcher": {
    "ignore": ["dist/**", "coverage/**", "playwright-report/**", "test-results/**"]
  }
}
```

- [ ] **Step 8: Verify discovery**

Run: `Get-ChildItem -Recurse .opencode/skills -Filter SKILL.md`
Expected: five files. Each has `name` and `description` frontmatter. Start a new OpenCode session or run `/reload`; the five skills appear in the available list.

- [ ] **Step 9: Commit**

```bash
git add .opencode opencode.jsonc
git commit -m "chore: add project-local OpenCode skills for UI, database, PWA, receipts, and E2E"
```

---

### Task 8: CI, Cloudflare config, backups, and keep-alive

**Files:**
- Create: `wrangler.jsonc`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/backup.yml`, `.github/workflows/keepalive.yml`
- Modify: `docs/runbook.md` with the exact secret names

- [ ] **Step 1: Create the Cloudflare config**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "motor-works-pos",
  "compatibility_date": "2026-11-15",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

No `main` worker; this is static assets only.

- [ ] **Step 2: Create the CI workflow**

`.github/workflows/ci.yml`:

- Trigger on `pull_request` and `push` to `main`.
- `verify` job: checkout, Node 24 with npm cache, `npm ci`, `npm run check`.
- `db` job: checkout, Node 24, `npm ci`, `supabase/setup-cli@v1`, `supabase start`, `supabase db reset`, export `TEST_SUPABASE_*` from `supabase status -o env`, `npm run test:db`.
- `build` job: depends on `verify`, `npm run build`, upload `dist` as an artifact.
- E2E is added in the bay plan; do not create an empty job.

- [ ] **Step 3: Create the deploy workflow**

`.github/workflows/deploy.yml`:

- Trigger on `push` to `main`.
- Needs `verify`, `db`, and `build` to pass.
- `cloudflare/wrangler-action@v3` with `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`, `command: deploy`.
- Document the two secrets in the runbook.

- [ ] **Step 4: Create the backup workflow**

`.github/workflows/backup.yml`:

- Nightly cron.
- `pg_dump "$PROD_DB_URL" --format=custom --no-owner --no-privileges --file=backup.dump`.
- Upload the artifact with 90-day retention.
- On the first of the month, also upload to the private backup location.
- Document `PROD_DB_URL` in the runbook.

- [ ] **Step 5: Create the keep-alive workflow**

`.github/workflows/keepalive.yml`:

- Daily cron.
- `curl -fsS "$SUPABASE_URL/rest/v1/rpc/ping" -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{}'`.
- Document `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the runbook.

- [ ] **Step 6: Verify the build and the dry-run deploy**

Run: `npm run build`.
Run: `npx wrangler deploy --dry-run`.
Expected: both succeed; `dist/sw.js` exists.

- [ ] **Step 7: Commit**

```bash
git add wrangler.jsonc .github docs/runbook.md
git commit -m "chore: add CI, Cloudflare deploy, backups, and keep-alive workflows"
```

#### Setup Checkpoint (human, required for the first deploy)

1. Create a Cloudflare API token with Workers edit permission.
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to GitHub Actions secrets.
3. Add `PROD_DB_URL` for backups.
4. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` for keep-alive.
5. Protect `main` on GitHub as the plan allows; require the CI checks.
6. Run the deploy workflow once and open the `*.workers.dev` URL.

---

### Task 9: Setup guide and first-run documentation

**Files:**
- Create: `docs/setup.md`
- Modify: `README.md`, `docs/runbook.md`

- [ ] **Step 1: Write `docs/setup.md`**

Cover, in order:

1. Install Node 24 and npm 11.
2. `npm install`.
3. Create the staging and production Supabase projects.
4. `npx supabase login`, `npx supabase link --project-ref <ref>`, `npm run db:push`.
5. `npm run db:types`.
6. Create the two auth users; set the owner role.
7. Copy the URL and anon key into `.env.local`.
8. `npm run dev`.
9. Install the PWA on Android and iPhone; test the offline banner.
10. Create the Cloudflare token and the GitHub secrets.
11. Deploy and run the smoke test.
12. Set up UptimeRobot for the app URL and the `ping()` endpoint.

- [ ] **Step 2: Update `README.md`**

Replace the “after scaffolding” wording with the real quickstart. Keep the commands in sync with `package.json`.

- [ ] **Step 3: Update `docs/runbook.md`**

Add the exact GitHub secret names and the first-deploy checklist.

- [ ] **Step 4: Verify the docs**

Run every command in `docs/setup.md` that does not require an external account. Check that all file links resolve.

- [ ] **Step 5: Commit**

```bash
git add docs/setup.md README.md docs/runbook.md
git commit -m "docs: add setup guide and first-run checklist"
```

---

### Task 10: Smoke test, verification, and first release

**Files:**
- Modify: `docs/spec.md` only if a real behavior change was discovered
- Tag: `v0.1.0`

- [ ] **Step 1: Run the full verification**

```bash
npm run check
npm run build
```

Expected: both pass.

- [ ] **Step 2: Run the app at 360px and desktop**

```bash
npm run preview
```

Check:

- The login screen renders; missing env vars show the setup screen.
- The PIN lock renders with 64px keys.
- A mechanic cannot reach `/owner`; an owner can.
- Long shop and customer names truncate without horizontal scrolling.
- The offline banner appears when the network is blocked.
- The update prompt does not auto-reload.
- The app installs as a PWA; the icon and theme color are correct.

- [ ] **Step 3: Run the database tests**

Run `npm run test:db` against staging. Expected: PASS. If Docker is unavailable locally, push a branch and confirm the CI `db` job passes.

- [ ] **Step 4: Check the PWA build artifacts**

Verify `dist/sw.js`, `dist/manifest.webmanifest`, and the three icon files exist.

- [ ] **Step 5: Commit any final fixes and tag**

```bash
git add -A
git commit -m "chore: complete phase 0 foundation"
git tag v0.1.0
```

- [ ] **Step 6: Hand off**

The next plans are, in order: inventory, bay, money and receipts, owner and launch. Each follows the same plan format and the approved spec.

---

## Self-Review

**Spec coverage (Phase 0):**

- Static SPA + Supabase architecture — Tasks 1, 3, 4.
- Design system and PWA look — Tasks 2, 6.
- Auth, roles, PIN — Tasks 3, 4.
- RLS, helpers, baseline tables — Task 5.
- Local skills — Task 7.
- CI, deploy, backups, keep-alive — Task 8.
- Setup and runbook — Task 9.
- Verification and release — Task 10.

Inventory, bay, receipts, owner, and launch are explicitly out of this plan; they are the next four plans in the spec's phase plan.

**Review focus coverage:**

1. Missing env vars — Task 4, `setup-required.test.tsx`.
2. Mechanic at `/owner` — Task 3, `guards.test.tsx`.
3. Stale PWA / no Supabase caching — Task 6, PWA config plus offline/update tests.
4. Long content at 360px — Task 3, long shop-name assertion; Task 2 truncation utility.
5. Session expiry on the lock screen — Task 4, `lock.test.tsx`.

**Type consistency:** `Role`, `Profile`, and `AuthState` are defined in Task 3 and consumed by Task 4. `AuthProvider` is the only producer of `AuthState`. `useAuth` is the only consumer entry point. `Button` `size="touch"` is defined in Task 2 and used by later plans. `StatusBadge` statuses match the spec's statuses.

**Proportion:** This plan is configuration-heavy, so the steps are commands and exact config values, not full implementations. Test steps carry the assertions; code steps carry signatures and the values the spec pins.
