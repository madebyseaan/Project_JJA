import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { StatusBadge } from '@/components/StatusBadge';

test('in-progress status shows a text label, not only color', () => {
  render(<StatusBadge status="IN_PROGRESS" />);

  expect(screen.getByText('In progress')).toBeInTheDocument();
});
