import { describe, expect, test } from 'vitest';

import {
  ageInHours,
  formatManilaDate,
  formatManilaDateTime,
  formatManilaTime,
  isOlderThan,
  manilaDateKey,
} from '@/lib/dates';

describe('Manila business dates', () => {
  test('rolls the business date at Manila midnight, not UTC', () => {
    expect(manilaDateKey(new Date('2026-11-14T15:59:59Z'))).toBe('2026-11-14');
    expect(manilaDateKey(new Date('2026-11-14T16:00:00Z'))).toBe('2026-11-15');
    expect(manilaDateKey(new Date('2026-11-15T15:59:59Z'))).toBe('2026-11-15');
  });

  test('formats dates and times in Manila', () => {
    const iso = '2026-11-15T08:30:00Z';
    expect(formatManilaDate(iso)).toBe('15 Nov 2026');
    expect(formatManilaDateTime(iso)).toBe('15 Nov 2026, 4:30 PM');
    expect(formatManilaTime(iso)).toBe('4:30 PM');
  });

  test('treats an invalid date as invalid but does not throw', () => {
    expect(() => formatManilaDate('not-a-date')).not.toThrow();
  });
});

describe('ticket age', () => {
  test('measures age in hours without negative values', () => {
    const now = new Date('2026-11-15T10:00:00Z').getTime();
    expect(ageInHours('2026-11-15T08:00:00Z', now)).toBe(2);
    expect(ageInHours('2026-11-15T12:00:00Z', now)).toBe(0);
  });

  test('flags tickets older than the bay threshold', () => {
    const now = new Date('2026-11-17T09:00:00Z').getTime();
    expect(isOlderThan('2026-11-15T08:00:00Z', 48, now)).toBe(true);
    expect(isOlderThan('2026-11-16T09:00:00Z', 48, now)).toBe(false);
  });
});
