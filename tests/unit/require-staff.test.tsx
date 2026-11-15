import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { RequireStaff } from '@/app/guards/RequireStaff';
import type { AuthContextValue } from '@/features/auth/auth-context';

import {
  AuthTestProvider,
  loadingValue,
  signedInValue,
  signedOutValue,
} from '../setup/auth-test-utils';

function renderGuard(value: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <div>Login screen</div> },
      {
        element: <RequireStaff />,
        children: [{ path: '/', element: <div>Staff home</div> }],
      },
    ],
    { initialEntries: ['/'] },
  );

  render(
    <AuthTestProvider value={value}>
      <RouterProvider router={router} />
    </AuthTestProvider>,
  );
}

test('redirects signed-out staff to login', async () => {
  renderGuard(signedOutValue());

  expect(await screen.findByText('Login screen')).toBeInTheDocument();
});

test('renders the protected page for signed-in staff', async () => {
  renderGuard(signedInValue());

  expect(await screen.findByText('Staff home')).toBeInTheDocument();
});

test('shows the loading state while the session is checked', () => {
  renderGuard(loadingValue());

  expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
});
