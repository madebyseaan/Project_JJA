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
