import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={auth}>
        <PinLockTestProvider value={pin}>
          <RouterProvider router={router} />
        </PinLockTestProvider>
      </AuthTestProvider>
    </QueryClientProvider>,
  );

  return router;
}

test('redirects the root to orders', async () => {
  const router = renderApp('/', signedInValue(ownerProfile));

  expect(await screen.findByRole('heading', { name: 'Orders' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/orders');
});

test('shows the items route', async () => {
  renderApp('/items', signedInValue(ownerProfile));

  expect(await screen.findByRole('heading', { name: 'Items' })).toBeInTheDocument();
});

test('shows reports to the mechanic', async () => {
  const router = renderApp('/reports', signedInValue(mechanicProfile));

  expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/reports');
});

test('shows the GCash route inside reports', async () => {
  renderApp('/reports/gcash', signedInValue(mechanicProfile));

  expect(await screen.findByRole('heading', { name: 'GCash' })).toBeInTheDocument();
});

test('shows settings to either staff member', async () => {
  renderApp('/settings', signedInValue(mechanicProfile));

  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
});

test('sends signed-out staff to login', async () => {
  const router = renderApp('/orders', signedOutValue());

  await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
});

test('sends locked staff to the lock screen', async () => {
  const router = renderApp(
    '/orders',
    signedInValue(ownerProfile),
    pinLockValue({ unlocked: false, hasPin: true }),
  );

  expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/lock');
});
