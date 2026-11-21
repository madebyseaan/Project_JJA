import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { PageHeader } from '@/components/PageHeader';

test('renders the title, description, and action', () => {
  render(
    <PageHeader
      title="Bay"
      description="Today's walk-in jobs."
      actions={<button type="button">New ticket</button>}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Bay' })).toBeInTheDocument();
  expect(screen.getByText("Today's walk-in jobs.")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New ticket' })).toBeInTheDocument();
});

test('renders without a description or action', () => {
  render(<PageHeader title="Stock" />);

  expect(screen.getByRole('heading', { name: 'Stock' })).toBeInTheDocument();
});
