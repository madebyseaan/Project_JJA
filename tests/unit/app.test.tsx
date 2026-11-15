import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  getSupabaseClient: vi.fn(),
}));

import { App } from '@/app/App';

test('shows the setup screen when Supabase is not configured', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /almost ready/i })).toBeInTheDocument();
  expect(screen.getAllByText(/VITE_SUPABASE_ANON_KEY/).length).toBeGreaterThan(0);
});
