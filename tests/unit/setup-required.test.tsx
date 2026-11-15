import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { SetupRequiredPage } from '@/features/auth/SetupRequiredPage';

test('names the missing environment variables', () => {
  render(<SetupRequiredPage missing={['VITE_SUPABASE_URL']} />);

  expect(screen.getByRole('heading', { name: /almost ready/i })).toBeInTheDocument();
  expect(screen.getByText('Missing: VITE_SUPABASE_URL')).toBeInTheDocument();
});
