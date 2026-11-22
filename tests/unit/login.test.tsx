import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';

import { AppError } from '@/lib/errors';
import { LoginPage } from '@/features/auth/LoginPage';
import type { AuthContextValue } from '@/features/auth/auth-context';

import { AuthTestProvider, signedOutValue } from '../setup/auth-test-utils';

function renderLogin(value: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <div>Staff home</div> },
    ],
    { initialEntries: ['/login'] },
  );

  render(
    <AuthTestProvider value={value}>
      <RouterProvider router={router} />
    </AuthTestProvider>,
  );
}

test('shows the shop capabilities and the Manila clock', () => {
  renderLogin(signedOutValue());

  expect(screen.getByText('Orders')).toBeInTheDocument();
  expect(screen.getByText('Items')).toBeInTheDocument();
  expect(screen.getByText('Reports')).toBeInTheDocument();
  expect(screen.getAllByText(/Manila/).length).toBeGreaterThan(0);
  expect(
    screen.getAllByAltText('J.J.A Motor Accessories and Motorcycle Repair').length,
  ).toBeGreaterThan(0);
});

test('toggles password visibility', async () => {
  const user = userEvent.setup();
  renderLogin(signedOutValue());

  const password = screen.getByLabelText('Password');

  expect(password).toHaveAttribute('type', 'password');

  await user.click(screen.getByRole('button', { name: 'Show password' }));

  expect(password).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
});

test('shows validation messages on an empty submit', async () => {
  const user = userEvent.setup();
  renderLogin(signedOutValue());

  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Enter your employee ID.')).toBeInTheDocument();
  expect(await screen.findByText('Enter your password.')).toBeInTheDocument();
});

test('rejects an invalid employee ID', async () => {
  const user = userEvent.setup();
  renderLogin(signedOutValue());

  await user.type(screen.getByLabelText('Employee ID'), 'not an id');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Enter a valid employee ID (e.g., JJA-001).')).toBeInTheDocument();
});

test('shows the credentials error from the provider', async () => {
  const user = userEvent.setup();
  const value = signedOutValue();
  value.signIn = vi.fn(async () => {
    throw new AppError('AUTH_INVALID', 'The employee ID or password is incorrect.');
  });

  renderLogin(value);

  await user.type(screen.getByLabelText('Employee ID'), 'JJA-001');
  await user.type(screen.getByLabelText('Password'), 'wrong-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('The employee ID or password is incorrect.')).toBeInTheDocument();
});

test('calls signIn with the entered values', async () => {
  const user = userEvent.setup();
  const signIn = vi.fn(async () => {});
  const value = signedOutValue();
  value.signIn = signIn;

  renderLogin(value);

  await user.type(screen.getByLabelText('Employee ID'), 'JJA-001');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(signIn).toHaveBeenCalledWith('JJA-001', 'secret');
  });
});

test('uppercases and inserts the hyphen while typing an employee ID', async () => {
  const user = userEvent.setup();
  const signIn = vi.fn(async () => {});
  const value = signedOutValue();
  value.signIn = signIn;

  renderLogin(value);

  const employeeId = screen.getByLabelText('Employee ID');
  await user.type(employeeId, 'jja001');

  expect(employeeId).toHaveValue('JJA-001');

  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(signIn).toHaveBeenCalledWith('JJA-001', 'secret');
  });
});

test('pads a short employee number on blur', async () => {
  const user = userEvent.setup();
  const signIn = vi.fn(async () => {});
  const value = signedOutValue();
  value.signIn = signIn;

  renderLogin(value);

  const employeeId = screen.getByLabelText('Employee ID');
  await user.type(employeeId, 'jja01');
  await user.type(screen.getByLabelText('Password'), 'secret');

  expect(employeeId).toHaveValue('JJA-001');

  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(signIn).toHaveBeenCalledWith('JJA-001', 'secret');
  });
});
