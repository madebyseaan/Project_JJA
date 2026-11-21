import { act, render, screen } from '@testing-library/react';
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
  signedOutValue,
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

test('applies truncation classes to a long staff name', () => {
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

test('updates the status and banner when the connection returns', () => {
  renderLayout();

  expect(screen.getAllByText('Online').length).toBeGreaterThan(0);
  expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument();

  act(() => {
    setOnline(false);
    window.dispatchEvent(new Event('offline'));
  });

  expect(screen.getAllByText('Offline').length).toBeGreaterThan(0);
  expect(screen.getAllByText(/you are offline/i).length).toBeGreaterThan(0);

  act(() => {
    setOnline(true);
    window.dispatchEvent(new Event('online'));
  });

  expect(screen.getAllByText('Online').length).toBeGreaterThan(0);
  expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument();
});

test('shows a loading frame instead of a blank screen without a signed-in session', () => {
  renderLayout({ auth: signedOutValue() });

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText('Bay content')).not.toBeInTheDocument();
});
