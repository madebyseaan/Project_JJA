import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { AppNav } from '@/app/AppNav';
import type { Role } from '@/types/domain';

function renderNav(role: Role, initialEntries = ['/bay'], variant: 'rail' | 'tabs' = 'rail') {
  const router = createMemoryRouter(
    [{ path: '*', element: <AppNav role={role} variant={variant} /> }],
    { initialEntries },
  );

  render(<RouterProvider router={router} />);
}

test('owner sees Bay, Stock, and Owner', () => {
  renderNav('owner');

  expect(screen.getByRole('link', { name: 'Bay' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Stock' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Owner' })).toBeInTheDocument();
});

test('mechanic does not see the Owner link', () => {
  renderNav('mechanic');

  expect(screen.getByRole('link', { name: 'Bay' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Stock' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Owner' })).not.toBeInTheDocument();
});

test('marks the current route', () => {
  renderNav('owner', ['/inventory']);

  expect(screen.getByRole('link', { name: 'Stock' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Bay' })).not.toHaveAttribute('aria-current');
});

test('renders the bottom tabs with the same filtering and active state', () => {
  renderNav('mechanic', ['/bay'], 'tabs');

  expect(screen.getByRole('link', { name: 'Bay' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Stock' })).not.toHaveAttribute('aria-current');
  expect(screen.queryByRole('link', { name: 'Owner' })).not.toBeInTheDocument();
});
