import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Button } from '@/components/ui/button';

test('touch buttons meet the 48px target', () => {
  render(<Button size="touch">New ticket</Button>);

  expect(screen.getByRole('button', { name: 'New ticket' }).className).toContain('h-12');
});
