import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ConnectionStatus } from '@/components/ConnectionStatus';

test('shows the online state as text', () => {
  render(<ConnectionStatus online />);
  expect(screen.getByRole('status')).toHaveTextContent('Online');
});

test('shows the offline state as text', () => {
  render(<ConnectionStatus online={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('Offline');
});
