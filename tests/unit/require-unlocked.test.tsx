import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { RequireUnlocked } from '@/app/RequireUnlocked';
import type { AuthContextValue } from '@/features/auth/auth-context';
import type { PinLockContextValue } from '@/features/auth/pin-lock-context';

import {
  AuthTestProvider,
  PinLockTestProvider,
  pinLockValue,
  signedInValue,
  signedOutValue,
} from '../setup/auth-test-utils';

function renderGuard(auth: AuthContextValue, pin: PinLockContextValue) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <div>Login screen</div> },
      { path: '/lock', element: <div>Lock screen</div> },
      {
        element: <RequireUnlocked />,
        children: [{ path: '/', element: <div>Staff home</div> }],
      },
    ],
    { initialEntries: ['/'] },
  );

  render(
    <AuthTestProvider value={auth}>
      <PinLockTestProvider value={pin}>
        <RouterProvider router={router} />
      </PinLockTestProvider>
    </AuthTestProvider>,
  );
}

test('redirects a locked staff member to the lock screen', async () => {
  renderGuard(signedInValue(), pinLockValue({ unlocked: false, hasPin: true }));

  expect(await screen.findByText('Lock screen')).toBeInTheDocument();
});

test('renders the protected page when unlocked', async () => {
  renderGuard(signedInValue(), pinLockValue({ unlocked: true, hasPin: true }));

  expect(await screen.findByText('Staff home')).toBeInTheDocument();
});

test('redirects signed-out staff to login', async () => {
  renderGuard(signedOutValue(), pinLockValue({ unlocked: false, hasPin: false }));

  expect(await screen.findByText('Login screen')).toBeInTheDocument();
});
