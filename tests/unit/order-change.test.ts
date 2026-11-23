import { describe, expect, test } from 'vitest';

import { calculateAutoChanges } from '@/features/sales/order-change';

function cash(amountCentavos: number) {
  return { method: 'CASH' as const, amountCentavos, gcashRecipientId: null };
}

function gcash(amountCentavos: number, gcashRecipientId: string) {
  return { method: 'GCASH' as const, amountCentavos, gcashRecipientId };
}

describe('calculateAutoChanges', () => {
  test('returns cash change automatically', () => {
    const result = calculateAutoChanges([cash(30000)], 25000);

    expect(result.changes).toEqual([
      { method: 'CASH', amountCentavos: 5000, gcashRecipientId: null },
    ]);
    expect(result.changeCentavos).toBe(5000);
    expect(result.netCashCentavos).toBe(25000);
    expect(result.shortfallCentavos).toBe(0);
  });

  test('returns GCash change from the person who received it', () => {
    const result = calculateAutoChanges([gcash(30000, 'aldwin')], 25000);

    expect(result.changes).toEqual([
      { method: 'GCASH', amountCentavos: 5000, gcashRecipientId: 'aldwin' },
    ]);
    expect(result.netGcashCentavos).toBe(25000);
  });

  test('splits change across cash and GCash when cash alone is not enough', () => {
    const result = calculateAutoChanges([cash(1000), gcash(30000, 'aldwin')], 25000);

    expect(result.changes).toEqual([
      { method: 'CASH', amountCentavos: 1000, gcashRecipientId: null },
      { method: 'GCASH', amountCentavos: 5000, gcashRecipientId: 'aldwin' },
    ]);
    expect(result.netCashCentavos).toBe(0);
    expect(result.netGcashCentavos).toBe(25000);
  });

  test('splits across multiple GCash recipients without overdrawing one', () => {
    const result = calculateAutoChanges([gcash(10000, 'aldwin'), gcash(10000, 'magma')], 15000);

    expect(result.changes).toEqual([
      { method: 'GCASH', amountCentavos: 5000, gcashRecipientId: 'aldwin' },
    ]);
  });

  test('reports a shortfall without inventing change', () => {
    const result = calculateAutoChanges([cash(20000)], 25000);

    expect(result.changes).toEqual([]);
    expect(result.changeCentavos).toBe(0);
    expect(result.shortfallCentavos).toBe(5000);
  });
});
