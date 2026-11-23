import { describe, expect, test } from 'vitest';

import { staffLabel } from '@/features/sales/staff-label';

describe('staffLabel', () => {
  test('shows You for the signed-in user', () => {
    expect(staffLabel({ id: 'aldwin', displayName: 'Aldwin' }, 'aldwin')).toBe('You');
  });

  test('shows the other person’s name', () => {
    expect(staffLabel({ id: 'magma', displayName: 'Magma' }, 'aldwin')).toBe('Magma');
  });

  test('falls back to the real name when there is no current user', () => {
    expect(staffLabel({ id: 'aldwin', displayName: 'Aldwin' }, null)).toBe('Aldwin');
  });
});
