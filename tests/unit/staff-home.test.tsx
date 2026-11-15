import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { StaffHomePage } from '@/app/StaffHomePage';

import {
  AuthTestProvider,
  ownerProfile,
  PinLockTestProvider,
  pinLockValue,
  signedInValue,
} from '../setup/auth-test-utils';

function renderStaffHome(pinValue = pinLockValue()) {
  render(
    <AuthTestProvider value={signedInValue(ownerProfile)}>
      <PinLockTestProvider value={pinValue}>
        <StaffHomePage />
      </PinLockTestProvider>
    </AuthTestProvider>,
  );

  return { pinValue };
}

test('shows the signed-in staff name, role, and employee ID', () => {
  renderStaffHome();

  expect(screen.getByRole('heading', { name: 'Dad' })).toBeInTheDocument();
  expect(screen.getByText('Owner')).toBeInTheDocument();
  expect(screen.getByText('JJA-001')).toBeInTheDocument();
});

test('signs out from the header', async () => {
  const user = userEvent.setup();
  const signOut = vi.fn(async () => {});
  const value = { ...signedInValue(ownerProfile), signOut };

  render(
    <AuthTestProvider value={value}>
      <PinLockTestProvider value={pinLockValue()}>
        <StaffHomePage />
      </PinLockTestProvider>
    </AuthTestProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'Sign out' }));

  expect(signOut).toHaveBeenCalledTimes(1);
});

test('locks from the header', async () => {
  const user = userEvent.setup();
  const lock = vi.fn();
  const pinValue = pinLockValue({ lock });

  renderStaffHome(pinValue);

  await user.click(screen.getByRole('button', { name: 'Lock' }));

  expect(lock).toHaveBeenCalledTimes(1);
});
