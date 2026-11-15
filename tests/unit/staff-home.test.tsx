import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { StaffHomePage } from '@/app/StaffHomePage';

import { AuthTestProvider, ownerProfile, signedInValue } from '../setup/auth-test-utils';

test('shows the signed-in staff name and role', () => {
  render(
    <AuthTestProvider value={signedInValue(ownerProfile)}>
      <StaffHomePage />
    </AuthTestProvider>,
  );

  expect(screen.getByRole('heading', { name: 'Dad' })).toBeInTheDocument();
  expect(screen.getByText('Owner')).toBeInTheDocument();
});

test('signs out from the header', async () => {
  const user = userEvent.setup();
  const signOut = vi.fn(async () => {});
  const value = { ...signedInValue(ownerProfile), signOut };

  render(
    <AuthTestProvider value={value}>
      <StaffHomePage />
    </AuthTestProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'Sign out' }));

  expect(signOut).toHaveBeenCalledTimes(1);
});
