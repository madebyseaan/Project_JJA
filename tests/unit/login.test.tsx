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

test('shows validation messages on an empty submit', async () => {
  const user = userEvent.setup();
  renderLogin(signedOutValue());

  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
  expect(await screen.findByText('Enter your password.')).toBeInTheDocument();
});

test('rejects an invalid email', async () => {
  const user = userEvent.setup();
  renderLogin(signedOutValue());

  await user.type(screen.getByLabelText('Email'), 'not-an-email');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
});

test('shows the credentials error from the provider', async () => {
  const user = userEvent.setup();
  const value = signedOutValue();
  value.signIn = vi.fn(async () => {
    throw new AppError('AUTH_INVALID', 'The email or password is incorrect.');
  });

  renderLogin(value);

  await user.type(screen.getByLabelText('Email'), 'dad@example.com');
  await user.type(screen.getByLabelText('Password'), 'wrong-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('The email or password is incorrect.')).toBeInTheDocument();
});

test('calls signIn with the entered values', async () => {
  const user = userEvent.setup();
  const signIn = vi.fn(async () => {});
  const value = signedOutValue();
  value.signIn = signIn;

  renderLogin(value);

  await user.type(screen.getByLabelText('Email'), 'dad@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(signIn).toHaveBeenCalledWith('dad@example.com', 'secret');
  });
});
