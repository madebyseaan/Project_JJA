import { describe, expect, test, vi } from 'vitest';

import { collectPages } from '@/features/sales/pagination';

describe('collectPages', () => {
  test('keeps fetching until a short page arrives', async () => {
    const fetchPage = vi
      .fn<(from: number, to: number) => Promise<number[]>>()
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, index) => index))
      .mockResolvedValueOnce(Array.from({ length: 53 }, (_, index) => 1000 + index));

    const rows = await collectPages(fetchPage, 1000);

    expect(rows).toHaveLength(1053);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  test('stops after an exact full page when the next page is empty', async () => {
    const fetchPage = vi
      .fn<(from: number, to: number) => Promise<number[]>>()
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, index) => index))
      .mockResolvedValueOnce([]);

    const rows = await collectPages(fetchPage, 1000);

    expect(rows).toHaveLength(1000);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  test('returns a single short page without a second request', async () => {
    const fetchPage = vi.fn(async () => [1, 2, 3]);

    await expect(collectPages(fetchPage, 1000)).resolves.toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
