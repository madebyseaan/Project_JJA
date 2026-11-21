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
