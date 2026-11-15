import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { AppNav } from '@/app/AppNav';
import type { Role } from '@/types/domain';

function renderNav(role: Role, initialEntries = ['/bay']) {
  const router = createMemoryRouter(
    [{ path: '*', element: <AppNav role={role} variant="rail" /> }],
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
