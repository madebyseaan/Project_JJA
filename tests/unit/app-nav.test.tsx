import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { AppNav } from '@/app/AppNav';

function renderNav(initialEntries = ['/orders'], variant: 'rail' | 'tabs' = 'rail') {
  const router = createMemoryRouter([{ path: '*', element: <AppNav variant={variant} /> }], {
    initialEntries,
  });

  render(<RouterProvider router={router} />);
}

test('shows every staff link with the same access', () => {
  renderNav();

  expect(screen.getByRole('link', { name: 'Orders' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Items' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
});

test('marks the current route', () => {
  renderNav(['/items']);

  expect(screen.getByRole('link', { name: 'Items' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveAttribute('aria-current');
});

test('keeps Orders active on an order detail route', () => {
  renderNav(['/orders/abc']);

  expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
});

test('renders the bottom tabs with the same links and active state', () => {
  renderNav(['/reports'], 'tabs');

  expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
});
