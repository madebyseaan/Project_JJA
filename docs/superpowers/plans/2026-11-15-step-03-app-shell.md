# Step 03 — App Shell and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-in staff a real app frame: Bay, Stock, and Owner routes, mobile bottom tabs, a desktop left rail, role guards, connection status, an offline banner, and intentional placeholder screens.

**Architecture:** Keep the existing `PinLockProvider` and Supabase auth. Add a `StaffLayout` inside the authenticated, unlocked route tree, with `PublicLayout` around login and lock. Guards sit above the layout so signed-out and locked users never see the shell. Navigation is one `AppNav` component rendered twice: as a desktop rail and as mobile bottom tabs.

**Tech Stack:** React 19, React Router 8, TypeScript strict, Tailwind CSS v4, shadcn/ui primitives, lucide-react, Vitest + Testing Library.

**Spec:** `docs/spec.md` §7 (screens and routes), §9.4 (offline behavior); `docs/design.md` §4 (layout), §5 (components), §7 (copy), §8 (accessibility); `docs/roadmap.md` Step 03.

## Global Constraints

- No server, no new dependencies, no database changes in this step.
- Out of scope: ticket detail, the real bay queue, the inventory table, the owner dashboard, public receipt/verify pages, and PWA work. Those belong to later steps.
- Mobile-first at 360px; minimum touch target 48px; primary action 56px.
- Use design tokens only. No hardcoded hex values.
- Use shadcn/ui primitives from `src/components/ui` for buttons and menus.
- Named exports only. Use the `@/` path alias.
- No `any`, no non-null assertions without a clear comment.
- Every new file stays well under 1,000 lines.
- Tests mirror the source in `tests/unit`.
- `npm run check` must pass before the step is shown to Sean.
- Update `docs/roadmap.md` to **In review** when the build is done. Do not mark Step 03 approved or start Step 04.
- No new Markdown at the repository root.

## Review Focus

- A mechanic typing `/owner` directly must be redirected to `/bay`; hiding the tab is not enough.
- A long staff name at 360px must truncate without pushing the connection dot or Lock button off-screen.
- Going offline and back online must update both the status dot and the banner without a reload.
- Signed-out and locked users must never see a flash of the staff shell.
- Keyboard and screen-reader users must get one visible active nav item with `aria-current="page"` and reachable 48px targets.

---

## Before you start

- [ ] Create the work branch from `main`.

```bash
git switch -c feat/step-03-app-shell main
```

- [ ] Confirm the working tree is clean and `npm run check` is green before changing code.

---

### Task 1: Page header and empty state

**Files:**

- Create: `src/components/PageHeader.tsx`
- Create: `src/components/EmptyState.tsx`
- Test: `tests/unit/page-header.test.tsx`
- Test: `tests/unit/empty-state.test.tsx`

**Interfaces:**

- Produces: `PageHeader({ title, description?, actions? }: PageHeaderProps)`
- Produces: `EmptyState({ title, description?, action? }: EmptyStateProps)`

```ts
type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};
```

- [ ] **Step 1: Write the failing PageHeader test**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { PageHeader } from '@/components/PageHeader';

test('renders the title, description, and action', () => {
  render(
    <PageHeader
      title="Bay"
      description="Today's walk-in jobs."
      actions={<button type="button">New ticket</button>}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Bay' })).toBeInTheDocument();
  expect(screen.getByText("Today's walk-in jobs.")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New ticket' })).toBeInTheDocument();
});

test('renders without a description or action', () => {
  render(<PageHeader title="Stock" />);

  expect(screen.getByRole('heading', { name: 'Stock' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/page-header.test.tsx`

Expected: FAIL because `@/components/PageHeader` does not exist.

- [ ] **Step 3: Implement PageHeader**

`PageHeader` renders one `h1`, an optional description, and optional actions. Use `font-display`, `text-3xl md:text-4xl`, `border-line border-b pb-4`, and a `sm:flex-row` layout so actions wrap below the title at 360px.

- [ ] **Step 4: Write the failing EmptyState test**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { EmptyState } from '@/components/EmptyState';

test('renders the message and next action', () => {
  render(
    <EmptyState
      title="No tickets in the bay"
      description="Walk-in tickets will appear here."
      action={<button type="button">New ticket</button>}
    />,
  );

  expect(screen.getByText('No tickets in the bay')).toBeInTheDocument();
  expect(screen.getByText('Walk-in tickets will appear here.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New ticket' })).toBeInTheDocument();
});

test('renders without an action', () => {
  render(<EmptyState title="No parts yet" />);

  expect(screen.getByText('No parts yet')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npx vitest run tests/unit/empty-state.test.tsx`

Expected: FAIL because `@/components/EmptyState` does not exist.

- [ ] **Step 6: Implement EmptyState**

Use a bordered `bg-surface` block with `p-6 sm:p-10`, short copy, and an optional action centered below. No illustration, no decorative image. The action is optional because Step 03 placeholders have no action yet.

- [ ] **Step 7: Run both tests and confirm they pass**

Run: `npx vitest run tests/unit/page-header.test.tsx tests/unit/empty-state.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/PageHeader.tsx src/components/EmptyState.tsx tests/unit/page-header.test.tsx tests/unit/empty-state.test.tsx
git commit -m "feat: add page header and empty state"
```

---

### Task 2: Connection status and offline banner

**Files:**

- Create: `src/hooks/use-online-status.ts`
- Create: `src/components/ConnectionStatus.tsx`
- Create: `src/components/OfflineBanner.tsx`
- Test: `tests/unit/online-status.test.ts`
- Test: `tests/unit/connection-status.test.tsx`
- Test: `tests/unit/offline-banner.test.tsx`

**Interfaces:**

- Produces: `useOnlineStatus(): boolean`
- Produces: `ConnectionStatus({ online, className? }: ConnectionStatusProps)`
- Produces: `OfflineBanner({ online }: OfflineBannerProps)`

```ts
type ConnectionStatusProps = { online: boolean; className?: string };
type OfflineBannerProps = { online: boolean };
```

- [ ] **Step 1: Write the failing hook test**

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { useOnlineStatus } from '@/hooks/use-online-status';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

afterEach(() => setOnline(true));

test('tracks the browser online state', () => {
  setOnline(true);

  const { result } = renderHook(() => useOnlineStatus());

  expect(result.current).toBe(true);

  setOnline(false);
  act(() => window.dispatchEvent(new Event('offline')));
  expect(result.current).toBe(false);

  setOnline(true);
  act(() => window.dispatchEvent(new Event('online')));
  expect(result.current).toBe(true);
});

test('starts offline when the browser is offline', () => {
  setOnline(false);

  const { result } = renderHook(() => useOnlineStatus());

  expect(result.current).toBe(false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/online-status.test.ts`

Expected: FAIL because `@/hooks/use-online-status` does not exist.

- [ ] **Step 3: Implement useOnlineStatus**

Use `useSyncExternalStore`:

- subscribe to `window` `online` and `offline`,
- snapshot `navigator.onLine`,
- server snapshot `true`.

- [ ] **Step 4: Write the failing ConnectionStatus tests**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ConnectionStatus } from '@/components/ConnectionStatus';

test('shows the online state as text', () => {
  render(<ConnectionStatus online />);
  expect(screen.getByRole('status')).toHaveTextContent('Online');
});

test('shows the offline state as text', () => {
  render(<ConnectionStatus online={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('Offline');
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npx vitest run tests/unit/connection-status.test.tsx`

Expected: FAIL because `@/components/ConnectionStatus` does not exist.

- [ ] **Step 6: Implement ConnectionStatus**

Render a `role="status"`, `aria-live="polite"` inline status with a 2px dot (`bg-ok` online, `bg-danger` offline) and the text `Online` or `Offline`. Status is never color-only.

- [ ] **Step 7: Write the failing OfflineBanner tests**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { OfflineBanner } from '@/components/OfflineBanner';

test('renders nothing while online', () => {
  render(<OfflineBanner online />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('warns that changes are disabled while offline', () => {
  render(<OfflineBanner online={false} />);
  expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  expect(screen.getByRole('status')).toHaveTextContent(/disabled/i);
});
```

- [ ] **Step 8: Run it and confirm it fails**

Run: `npx vitest run tests/unit/offline-banner.test.tsx`

Expected: FAIL because `@/components/OfflineBanner` does not exist.

- [ ] **Step 9: Implement OfflineBanner**

Return `null` when online. When offline, render a `role="status"` bar with the exact copy: `You are offline. Changes are disabled until the connection returns.` Use `border-danger/30 bg-danger/10 text-danger`.

- [ ] **Step 10: Run all three test files**

Run: `npx vitest run tests/unit/online-status.test.ts tests/unit/connection-status.test.tsx tests/unit/offline-banner.test.tsx`

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/hooks/use-online-status.ts src/components/ConnectionStatus.tsx src/components/OfflineBanner.tsx tests/unit/online-status.test.ts tests/unit/connection-status.test.tsx tests/unit/offline-banner.test.tsx
git commit -m "feat: add connection status and offline banner"
```

---

### Task 3: App navigation

**Files:**

- Create: `src/app/AppNav.tsx`
- Test: `tests/unit/app-nav.test.tsx`

**Interfaces:**

- Produces: `AppNav({ role, variant, className? }: AppNavProps)`
- `variant` is `'rail' | 'tabs'`.
- Consumes: `Role` from `@/types/domain`.

```ts
type AppNavProps = {
  role: Role;
  variant: 'rail' | 'tabs';
  className?: string;
};
```

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { AppNav } from '@/app/AppNav';
import type { Role } from '@/types/domain';

function renderNav(role: Role, initialEntries = ['/bay']) {
  const router = createMemoryRouter(
    [{ path: '*', element: <AppNav role={role} variant="rail" /> }],
    { initialEntries },
  );

  render(<RouterProvider router={router} />);
}

test('owner sees Bay, Stock, and Owner', () => {
  renderNav('owner');

  expect(screen.getByRole('link', { name: 'Bay' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Stock' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Owner' })).toBeInTheDocument();
});

test('mechanic does not see the Owner link', () => {
  renderNav('mechanic');

  expect(screen.getByRole('link', { name: 'Bay' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Stock' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Owner' })).not.toBeInTheDocument();
});

test('marks the current route', () => {
  renderNav('owner', ['/inventory']);

  expect(screen.getByRole('link', { name: 'Stock' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Bay' })).not.toHaveAttribute('aria-current');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/app-nav.test.tsx`

Expected: FAIL because `@/app/AppNav` does not exist.

- [ ] **Step 3: Implement AppNav**

Use `NavLink` from `react-router`. Define these items:

```ts
const ITEMS = [
  { label: 'Bay', to: '/bay', Icon: Wrench },
  { label: 'Stock', to: '/inventory', Icon: Package },
  { label: 'Owner', to: '/owner', Icon: ChartNoAxesCombined, ownerOnly: true },
] as const;
```

Filter `Owner` out unless `role === 'owner'`. Do not use `end` on the links: `/bay` must stay active on a future `/bay/ticket/:id`, and `/owner` must stay active on future `/owner/*` screens.

Rail variant: vertical list, `min-h-12`, active state uses `bg-soft text-ink` with a safety-orange left border. Tabs variant: fixed bottom bar, `min-h-16`, equal-width links, icon above label, active state uses `text-safety` and a safety top border. Icons are `size-5` and `aria-hidden="true"`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/unit/app-nav.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/AppNav.tsx tests/unit/app-nav.test.tsx
git commit -m "feat: add staff navigation"
```

---

### Task 4: Staff, owner, and unlocked guards

**Files:**

- Move: `src/app/RequireUnlocked.tsx` → `src/app/guards/RequireUnlocked.tsx`
- Create: `src/app/guards/RequireStaff.tsx`
- Create: `src/app/guards/RequireOwner.tsx`
- Delete: `src/app/RequireAuth.tsx`
- Move and edit: `tests/unit/require-auth.test.tsx` → `tests/unit/require-staff.test.tsx`
- Move and edit: `tests/unit/require-unlocked.test.tsx` import path
- Create: `tests/unit/require-owner.test.tsx`

**Interfaces:**

- Produces: `RequireStaff(): ReactElement`
- Produces: `RequireOwner(): ReactElement`
- Produces: `RequireUnlocked(): ReactElement`

Behavior:

- `RequireStaff`: loading → `FullPageLoading`; signed-out → `Navigate to="/login" replace`; signed-in → `Outlet`.
- `RequireOwner`: loading → `FullPageLoading`; signed-out → `Navigate to="/login" replace`; role is not `owner` → `Navigate to="/bay" replace`; owner → `Outlet`.
- `RequireUnlocked` keeps its current logic; only its path changes.

- [ ] **Step 1: Move RequireUnlocked**

Move the file and update its imports in `tests/unit/require-unlocked.test.tsx`. Keep the three existing tests unchanged.

- [ ] **Step 2: Write the failing RequireStaff tests**

Move `tests/unit/require-auth.test.tsx` to `tests/unit/require-staff.test.tsx`, change the import to `@/app/guards/RequireStaff`, and rename the component in the route tree. Keep the three existing assertions: signed-out redirects to login, signed-in renders the protected page, loading shows the status.

Run: `npx vitest run tests/unit/require-staff.test.tsx`

Expected: FAIL because `@/app/guards/RequireStaff` does not exist.

- [ ] **Step 3: Implement RequireStaff**

Copy the current `RequireAuth` behavior. Delete `src/app/RequireAuth.tsx` after the new guard passes.

- [ ] **Step 4: Write the failing RequireOwner tests**

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { RequireOwner } from '@/app/guards/RequireOwner';
import type { AuthContextValue } from '@/features/auth/auth-context';

import {
  AuthTestProvider,
  loadingValue,
  mechanicProfile,
  ownerProfile,
  signedInValue,
  signedOutValue,
} from '../setup/auth-test-utils';

function renderGuard(value: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <div>Login screen</div> },
      { path: '/bay', element: <div>Bay screen</div> },
      {
        element: <RequireOwner />,
        children: [{ path: '/owner', element: <div>Owner screen</div> }],
      },
    ],
    { initialEntries: ['/owner'] },
  );

  render(
    <AuthTestProvider value={value}>
      <RouterProvider router={router} />
    </AuthTestProvider>,
  );

  return router;
}

test('renders the owner route for the owner', async () => {
  renderGuard(signedInValue(ownerProfile));
  expect(await screen.findByText('Owner screen')).toBeInTheDocument();
});

test('redirects a mechanic to the bay', async () => {
  const router = renderGuard(signedInValue(mechanicProfile));
  expect(await screen.findByText('Bay screen')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/bay');
});

test('redirects signed-out staff to login', async () => {
  renderGuard(signedOutValue());
  expect(await screen.findByText('Login screen')).toBeInTheDocument();
});

test('shows loading while the session is checked', () => {
  renderGuard(loadingValue());
  expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npx vitest run tests/unit/require-owner.test.tsx`

Expected: FAIL because `@/app/guards/RequireOwner` does not exist.

- [ ] **Step 6: Implement RequireOwner**

Use `useAuth` and handle loading, signed-out, and non-owner as defined above.

- [ ] **Step 7: Run all guard tests**

Run: `npx vitest run tests/unit/require-staff.test.tsx tests/unit/require-owner.test.tsx tests/unit/require-unlocked.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A src/app tests/unit/require-staff.test.tsx tests/unit/require-owner.test.tsx tests/unit/require-unlocked.test.tsx tests/unit/require-auth.test.tsx
git commit -m "feat: add staff and owner route guards"
```

---

### Task 5: Layouts, placeholder routes, and the router

**Files:**

- Create: `src/app/layouts/PublicLayout.tsx`
- Create: `src/app/layouts/StaffLayout.tsx`
- Create: `src/routes/BayPage.tsx`
- Create: `src/routes/StockPage.tsx`
- Create: `src/routes/OwnerPage.tsx`
- Modify: `src/app/router.tsx`
- Delete: `src/app/StaffHomePage.tsx`
- Delete: `tests/unit/staff-home.test.tsx`
- Delete: `src/routes/.gitkeep`
- Test: `tests/unit/staff-layout.test.tsx`
- Test: `tests/unit/routes.test.tsx`

**Interfaces:**

- Produces: `PublicLayout()`, `StaffLayout()`, `BayPage()`, `StockPage()`, `OwnerPage()`.
- Consumes: `AppNav`, `ConnectionStatus`, `OfflineBanner`, `PageHeader`, `EmptyState`, `RequireStaff`, `RequireOwner`, `RequireUnlocked`.

Router shape:

```tsx
<PinLockProvider>
  <PublicLayout>
    /login
    /lock
  </PublicLayout>
  <RequireStaff>
    <RequireUnlocked>
      <StaffLayout>
        / → Navigate to /bay
        /bay → BayPage
        /inventory → StockPage
        <RequireOwner>
          /owner → OwnerPage
        </RequireOwner>
      </StaffLayout>
    </RequireUnlocked>
  </RequireStaff>
  * → Navigate to /
</PinLockProvider>
```

- [ ] **Step 1: Write the failing StaffLayout test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';

import { StaffLayout } from '@/app/layouts/StaffLayout';
import type { AuthContextValue } from '@/features/auth/auth-context';
import type { PinLockContextValue } from '@/features/auth/pin-lock-context';
import type { Profile } from '@/types/domain';

import {
  AuthTestProvider,
  ownerProfile,
  PinLockTestProvider,
  pinLockValue,
  signedInValue,
} from '../setup/auth-test-utils';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

afterEach(() => setOnline(true));

function renderLayout({
  profile = ownerProfile,
  auth = signedInValue(profile),
  pin = pinLockValue(),
}: {
  profile?: Profile;
  auth?: AuthContextValue;
  pin?: PinLockContextValue;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        element: <StaffLayout />,
        children: [{ path: '/bay', element: <div>Bay content</div> }],
      },
    ],
    { initialEntries: ['/bay'] },
  );

  render(
    <AuthTestProvider value={auth}>
      <PinLockTestProvider value={pin}>
        <RouterProvider router={router} />
      </PinLockTestProvider>
    </AuthTestProvider>,
  );
}

test('shows the shop, staff identity, navigation, and page content', () => {
  renderLayout();

  expect(screen.getAllByText('J.J.A').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Dad').length).toBeGreaterThan(0);
  expect(screen.getAllByText('JJA-001').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: 'Bay' }).length).toBeGreaterThan(0);
  expect(screen.getByText('Bay content')).toBeInTheDocument();
});

test('locks from the shell', async () => {
  const user = userEvent.setup();
  const lock = vi.fn();

  renderLayout({ pin: pinLockValue({ lock }) });

  const lockButtons = screen.getAllByRole('button', { name: 'Lock' });

  expect(lockButtons.length).toBeGreaterThan(0);
  await user.click(lockButtons[0] as HTMLElement);
  expect(lock).toHaveBeenCalledTimes(1);
});

test('signs out from the desktop rail', async () => {
  const user = userEvent.setup();
  const signOut = vi.fn(async () => {});

  renderLayout({ auth: { ...signedInValue(ownerProfile), signOut } });

  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(signOut).toHaveBeenCalledTimes(1);
});

test('truncates a long staff name', () => {
  const longName = 'Alexandria Cassandra Dela Cruz-Montenegro';

  renderLayout({ profile: { ...ownerProfile, displayName: longName } });

  const names = screen.getAllByTitle(longName);

  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => name.className.includes('truncate'))).toBe(true);
});

test('shows the offline banner when the browser is offline', () => {
  setOnline(false);

  renderLayout();

  expect(screen.getAllByText(/you are offline/i).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/staff-layout.test.tsx`

Expected: FAIL because `@/app/layouts/StaffLayout` does not exist.

- [ ] **Step 3: Implement PublicLayout**

```tsx
import { Outlet } from 'react-router';

export function PublicLayout() {
  return (
    <div className="bg-paper min-h-screen">
      <Outlet />
    </div>
  );
}
```

- [ ] **Step 4: Implement StaffLayout**

Use `useAuth`, `usePinLock`, and `useOnlineStatus`. Return `null` if `profile` is missing; the guards handle the real states.

Structure:

- Desktop left rail, `md:grid-cols-[220px_minmax(0,1fr)]`, 220px wide, sticky, `md:h-screen`.
  - Brand and shop name.
  - `<AppNav role={profile.role} variant="rail" />`.
  - Footer with `profile.displayName` (truncated, `title` attribute), `profile.employeeId`, `ConnectionStatus`, a 48px Lock button, and a 48px Sign out button.
- Mobile top bar, `md:hidden`, sticky:
  - Brand and `J.J.A`.
  - Staff display name on the second line, truncated with a `title` attribute.
  - `ConnectionStatus`.
  - 48px Lock button with visible text.
- `<OfflineBanner online={online} />` under the header.
- `<main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-8"><Outlet /></main>`.
- `<AppNav role={profile.role} variant="tabs" className="md:hidden" />`.

Mobile sign-out stays one tap away through **Lock → Sign in as someone else**. The desktop rail has the explicit Sign out button.

- [ ] **Step 5: Run the StaffLayout test**

Run: `npx vitest run tests/unit/staff-layout.test.tsx`

Expected: PASS.

- [ ] **Step 6: Create the placeholder pages**

Use `PageHeader` and `EmptyState`:

- `BayPage`: title `Bay`, description `Today's walk-in jobs and their status.`, empty title `No tickets in the bay`, empty description `Walk-in tickets will appear here.`
- `StockPage`: title `Stock`, description `Parts, prices, and available stock.`, empty title `No parts yet`, empty description `The parts catalog will appear here.`
- `OwnerPage`: title `Owner`, description `Today's sales, cash, and low stock.`, empty title `No sales yet`, empty description `Completed sales and the day close will appear here.`

No fake buttons in the placeholders. The empty-state action slot stays available for later steps.

- [ ] **Step 7: Rewrite the router**

Use the router shape above. Import the new guards from `src/app/guards`, the layouts from `src/app/layouts`, and the pages from `src/routes`. Remove `RequireAuth` and `StaffHomePage` imports. Delete `src/app/StaffHomePage.tsx` and `tests/unit/staff-home.test.tsx`.

- [ ] **Step 8: Write the failing route test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';

import { routes } from '@/app/router';
import type { AuthContextValue } from '@/features/auth/auth-context';
import type { PinLockContextValue } from '@/features/auth/pin-lock-context';

import {
  AuthTestProvider,
  mechanicProfile,
  ownerProfile,
  PinLockTestProvider,
  pinLockValue,
  signedInValue,
  signedOutValue,
} from '../setup/auth-test-utils';

vi.mock('@/features/auth/PinLockProvider', async () => {
  const { Outlet: RouterOutlet } = await import('react-router');
  return { PinLockProvider: RouterOutlet };
});

function renderApp(
  path: string,
  auth: AuthContextValue,
  pin: PinLockContextValue = pinLockValue({ unlocked: true, hasPin: true }),
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(
    <AuthTestProvider value={auth}>
      <PinLockTestProvider value={pin}>
        <RouterProvider router={router} />
      </PinLockTestProvider>
    </AuthTestProvider>,
  );

  return router;
}

test('redirects the root to the bay', async () => {
  const router = renderApp('/', signedInValue(ownerProfile));

  expect(await screen.findByRole('heading', { name: 'Bay' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/bay');
});

test('shows the stock route', async () => {
  renderApp('/inventory', signedInValue(ownerProfile));

  expect(await screen.findByRole('heading', { name: 'Stock' })).toBeInTheDocument();
});

test('shows the owner route to the owner', async () => {
  renderApp('/owner', signedInValue(ownerProfile));

  expect(await screen.findByRole('heading', { name: 'Owner' })).toBeInTheDocument();
});

test('keeps a mechanic out of the owner route', async () => {
  const router = renderApp('/owner', signedInValue(mechanicProfile));

  expect(await screen.findByRole('heading', { name: 'Bay' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/bay');
});

test('sends signed-out staff to login', async () => {
  const router = renderApp('/bay', signedOutValue());

  await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
});

test('sends locked staff to the lock screen', async () => {
  const router = renderApp(
    '/bay',
    signedInValue(ownerProfile),
    pinLockValue({ unlocked: false, hasPin: true }),
  );

  expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/lock');
});
```

- [ ] **Step 9: Run it and confirm it fails**

Run: `npx vitest run tests/unit/routes.test.tsx`

Expected: FAIL because the new routes and pages are not wired yet.

- [ ] **Step 10: Run both new tests and confirm they pass**

Run: `npx vitest run tests/unit/staff-layout.test.tsx tests/unit/routes.test.tsx`

Expected: PASS.

- [ ] **Step 11: Run the full unit suite**

Run: `npm run test`

Expected: PASS. The removed `staff-home.test.tsx` and renamed guard tests must not leave stale imports.

- [ ] **Step 12: Commit**

```bash
git add src/app/layouts src/app/router.tsx src/routes tests/unit/staff-layout.test.tsx tests/unit/routes.test.tsx
git add -A src/app/StaffHomePage.tsx tests/unit/staff-home.test.tsx src/routes/.gitkeep
git commit -m "feat: add staff shell and placeholder routes"
```

---

### Task 6: Docs, screenshots, and review handoff

**Files:**

- Modify: `docs/design.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Update the design doc**

In `docs/design.md` §4 Mobile, change the top bar description to:

`Top bar: shop name, signed-in staff name (truncated), connection dot, lock.`

In §4 Desktop, change the left rail description to:

`Left rail: brand mark, nav, staff name, connection status, lock, sign out. Width 220px.`

This documents the shell as built. No token changes.

- [ ] **Step 2: Update the roadmap to In review**

In `docs/roadmap.md`:

- Change the Step 03 overview status to `In review — built; awaiting approval`.
- Change the current-step section to Step 03 with the same status.
- Mark the Step 03 **AI builds** checkboxes complete.
- Leave the **Human checkpoints** unchecked.
- Add the screenshot filenames below the Step 03 demo script.
- Keep the gate: do not start Step 04 until Sean says approved.

- [ ] **Step 3: Run the full check**

Run: `npm run check`

Expected: PASS for typecheck, lint, format, file size, unit tests, and build.

- [ ] **Step 4: Capture screenshots at 360px and desktop**

Start `npm run dev` and sign in. Save these files:

- `docs/screenshots/step-03-shell-bay-desktop.png`
- `docs/screenshots/step-03-shell-bay-mobile.png`
- `docs/screenshots/step-03-shell-owner-desktop.png`
- `docs/screenshots/step-03-shell-mechanic-desktop.png`

If the browser session is signed out, ask Sean to sign in; never ask for the password. Confirm:

- no horizontal scroll at 360px,
- the bottom tabs are all reachable with one thumb,
- the desktop rail is balanced at 1440px,
- the Owner tab is absent for the mechanic,
- the connection dot and offline banner change when the network is toggled.

- [ ] **Step 5: Commit the docs and screenshots**

```bash
git add docs/design.md docs/roadmap.md docs/screenshots/step-03-shell-*.png
git commit -m "docs: mark step 03 in review"
```

- [ ] **Step 6: Push the branch**

```bash
git push -u origin feat/step-03-app-shell
```

Open the PR to `main` using the compare URL Git prints. The PR description must list what changed, the exact commands run, the screenshots, and the mechanic/owner checks.

- [ ] **Step 7: Stop for review**

Give Sean the demo script below. Do not mark Step 03 done, do not merge, and do not start Step 04 until he says **approved**.

---

## Demo script

1. Sign in as Dad (`JJA-001`) and set or enter the PIN.
2. Open `/`. Confirm it redirects to `/bay` and the Bay tab is active.
3. At 360px, confirm the mobile top bar, bottom tabs, and Lock button fit without horizontal scrolling.
4. Open Stock. Confirm the Stock tab is active and the placeholder empty state is clear.
5. Open Owner as Dad. Confirm today's placeholder is visible.
6. Sign out and sign in as Uncle (`JJA-002`). Confirm the Owner tab is gone.
7. Type `/owner` directly as Uncle. Confirm the app returns to `/bay`.
8. Toggle the network offline. Confirm the dot says Offline and the banner says changes are disabled. Toggle it back and confirm both recover.
9. Tap Lock. Confirm the lock screen appears; unlock with the PIN. On mobile, sign out through **Sign in as someone else**.

## Gate

Step 03 is **In review**. Sean must test at 360px and desktop and say **approved** before Step 04 begins.
