import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

import type { AuthContextValue } from '@/features/auth/auth-context';
import { getPinRecord, recordFailedAttempt, savePin } from '@/features/auth/pin';
import type { PinLockContextValue, UnlockResult } from '@/features/auth/pin-lock-context';
import { PinLockProvider } from '@/features/auth/PinLockProvider';
import { usePinLock } from '@/features/auth/use-pin-lock';

import { AuthTestProvider, ownerProfile, signedInValue } from '../setup/auth-test-utils';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
});

function Capture({ onValue }: { onValue: (value: PinLockContextValue) => void }) {
  const value = usePinLock();

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

function renderProvider(overrides: Partial<AuthContextValue> = {}) {
  const latest = { current: null as PinLockContextValue | null };
  const onValue = (value: PinLockContextValue) => {
    latest.current = value;
  };
  const auth = { ...signedInValue(ownerProfile), ...overrides } as AuthContextValue;

  const router = createMemoryRouter(
    [
      {
        element: <PinLockProvider />,
        children: [
          { path: '/', element: <Capture onValue={onValue} /> },
          { path: '/lock', element: <div>Lock screen</div> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  );

  render(
    <AuthTestProvider value={auth}>
      <RouterProvider router={router} />
    </AuthTestProvider>,
  );

  return { auth, latest, router };
}

test('sets a PIN and unlocks', async () => {
  const { latest } = renderProvider();

  await waitFor(() => expect(latest.current).not.toBeNull());

  await act(async () => {
    await latest.current?.setPin('1234');
  });

  expect(getPinRecord(ownerProfile.id)).not.toBeNull();
  await waitFor(() => expect(latest.current?.unlocked).toBe(true));
  expect(latest.current?.hasPin).toBe(true);
});

test('resets attempts after a correct PIN', async () => {
  await savePin(ownerProfile.id, '1234');
  recordFailedAttempt(ownerProfile.id);
  recordFailedAttempt(ownerProfile.id);

  const { latest } = renderProvider();

  await waitFor(() => expect(latest.current?.hasPin).toBe(true));

  let result: UnlockResult | undefined;

  await act(async () => {
    result = await latest.current?.unlock('1234');
  });

  expect(result?.ok).toBe(true);
  expect(getPinRecord(ownerProfile.id)?.attempts).toBe(0);
  await waitFor(() => expect(latest.current?.unlocked).toBe(true));
});

test('signs out after five wrong PINs', async () => {
  await savePin(ownerProfile.id, '1234');

  const signOut = vi.fn(async () => {});
  const { latest } = renderProvider({ signOut });

  await waitFor(() => expect(latest.current?.hasPin).toBe(true));

  await act(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await latest.current?.unlock('0000');
    }
  });

  expect(signOut).toHaveBeenCalledTimes(1);
  expect(getPinRecord(ownerProfile.id)).toBeNull();
  await waitFor(() => expect(latest.current?.hasPin).toBe(false));
});

test('locks and navigates to the lock screen', async () => {
  const { latest, router } = renderProvider();

  await waitFor(() => expect(latest.current).not.toBeNull());

  act(() => {
    latest.current?.lock();
  });

  await waitFor(() => expect(router.state.location.pathname).toBe('/lock'));
});
