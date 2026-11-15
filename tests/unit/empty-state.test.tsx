import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { EmptyState } from '@/components/EmptyState';

test('renders the message and next action', () => {
  render(
    <EmptyState
      title="No tickets in the bay"
      description="Walk-in tickets will appear here."
      action={<button type="button">New ticket</button>}
    />,
  );

  expect(screen.getByText('No tickets in the bay')).toBeInTheDocument();
  expect(screen.getByText('Walk-in tickets will appear here.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New ticket' })).toBeInTheDocument();
});

test('renders without an action', () => {
  render(<EmptyState title="No parts yet" />);

  expect(screen.getByText('No parts yet')).toBeInTheDocument();
});
