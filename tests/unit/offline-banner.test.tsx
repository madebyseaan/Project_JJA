import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { OfflineBanner } from '@/components/OfflineBanner';

test('renders nothing while online', () => {
  render(<OfflineBanner online />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('warns that changes are disabled while offline', () => {
  render(<OfflineBanner online={false} />);
  expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  expect(screen.getByRole('status')).toHaveTextContent(/disabled/i);
});
