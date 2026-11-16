import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

import type { AuthContextValue } from '@/features/auth/auth-context';
import { LockPage } from '@/features/auth/LockPage';
import { savePin } from '@/features/auth/pin';
import type { PinLockContextValue, UnlockResult } from '@/features/auth/pin-lock-context';
import { PinLockProvider } from '@/features/auth/PinLockProvider';

import {
  AuthTestProvider,
  PinLockTestProvider,
  pinLockValue,
  signedInValue,
  signedOutValue,
  ownerProfile,
} from '../setup/auth-test-utils';

beforeEach(() => {
  localStorage.clear();
});

type RenderOptions = {
  auth?: AuthContextValue;
  pin?: PinLockContextValue;
};

function renderLockPage({ auth = signedInValue(ownerProfile), pin }: RenderOptions = {}) {
  const pinValue =
    pin ??
    pinLockValue({
      unlocked: false,
      hasPin: true,
    });

  const router = createMemoryRouter(
    [
      { path: '/lock', element: <LockPage /> },
      { path: '/', element: <div>Staff home</div> },
      { path: '/login', element: <div>Login screen</div> },
    ],
    { initialEntries: ['/lock'] },
  );

  render(
    <AuthTestProvider value={auth}>
      <PinLockTestProvider value={pinValue}>
        <RouterProvider router={router} />
      </PinLockTestProvider>
    </AuthTestProvider>,
  );

  return { pinValue };
}

async function enterPin(pin: string) {
  const user = userEvent.setup();

  for (const digit of pin) {
    await user.click(screen.getByRole('button', { name: digit }));
  }
}

test('sets and confirms a new PIN', async () => {
  const setPin = vi.fn(async () => {});
  const pin = pinLockValue({ unlocked: false, hasPin: false, setPin });

  renderLockPage({ pin });

  expect(screen.getByText('Set your PIN')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in as someone else' })).toBeInTheDocument();

  await enterPin('1234');

  expect(await screen.findByText('Confirm your PIN')).toBeInTheDocument();

  await enterPin('1234');

  expect(setPin).toHaveBeenCalledWith('1234');
  expect(await screen.findByText('Staff home')).toBeInTheDocument();
});

test('rejects a confirmation that does not match', async () => {
  const setPin = vi.fn(async () => {});
  const pin = pinLockValue({ unlocked: false, hasPin: false, setPin });

  renderLockPage({ pin });

  await enterPin('1234');
  await enterPin('1111');

  expect(await screen.findByText('PINs do not match. Start again.')).toBeInTheDocument();
  expect(setPin).not.toHaveBeenCalled();
});

test('shows the remaining attempts after a wrong PIN', async () => {
  const unlock = vi.fn(async (): Promise<UnlockResult> => ({
    ok: false,
    attemptsLeft: 4,
    lockedOut: false,
  }));
  const pin = pinLockValue({ unlocked: false, hasPin: true, unlock });

  renderLockPage({ pin });

  await enterPin('0000');

  expect(await screen.findByText('Incorrect PIN. 4 attempts left.')).toBeInTheDocument();
});

test('unlocks with the correct PIN', async () => {
  const unlock = vi.fn(async (): Promise<UnlockResult> => ({ ok: true }));
  const pin = pinLockValue({ unlocked: false, hasPin: true, unlock });

  renderLockPage({ pin });

  await enterPin('1234');

  expect(await screen.findByText('Staff home')).toBeInTheDocument();
});

test('signs in as someone else without clearing the PIN', async () => {
  const user = userEvent.setup();
  const signOut = vi.fn(async () => {});
  const clearPinAndSignOut = vi.fn(async () => {});
  const auth = { ...signedInValue(ownerProfile), signOut };
  const pin = pinLockValue({ unlocked: false, hasPin: true, clearPinAndSignOut });

  renderLockPage({ auth, pin });

  await user.click(screen.getByRole('button', { name: 'Sign in as someone else' }));

  expect(signOut).toHaveBeenCalledTimes(1);
  expect(clearPinAndSignOut).not.toHaveBeenCalled();
});

test('offers a password sign-in when the PIN is forgotten', async () => {
  const user = userEvent.setup();
  const clearPinAndSignOut = vi.fn(async () => {});
  const pin = pinLockValue({ unlocked: false, hasPin: true, clearPinAndSignOut });

  renderLockPage({ pin });

  await user.click(screen.getByRole('button', { name: /forgot pin/i }));

  expect(clearPinAndSignOut).toHaveBeenCalledTimes(1);
});

test('redirects signed-out staff to login', async () => {
  renderLockPage({ auth: signedOutValue() });

  expect(await screen.findByText('Login screen')).toBeInTheDocument();
});

test('redirects an already-unlocked user home', async () => {
  renderLockPage({ pin: pinLockValue({ unlocked: true, hasPin: true }) });

  expect(await screen.findByText('Staff home')).toBeInTheDocument();
});

test('a wrong PIN never reaches the staff home', async () => {
  await savePin(ownerProfile.id, '1234');

  const router = createMemoryRouter(
    [
      {
        element: <PinLockProvider />,
        children: [
          { path: '/lock', element: <LockPage /> },
          { path: '/', element: <div>Staff home</div> },
          { path: '/login', element: <div>Login screen</div> },
        ],
      },
    ],
    { initialEntries: ['/lock'] },
  );

  render(
    <AuthTestProvider value={signedInValue(ownerProfile)}>
      <RouterProvider router={router} />
    </AuthTestProvider>,
  );

  await screen.findByText('Welcome back');
  await enterPin('0000');

  expect(await screen.findByText('Incorrect PIN. 4 attempts left.')).toBeInTheDocument();
  expect(screen.queryByText('Staff home')).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/lock');
});
