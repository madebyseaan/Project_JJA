import { describe, expect, test } from 'vitest';

import { calculateOrderMoney, isBalanced, mainLaborCentavos } from '@/features/sales/order-math';

describe('calculateOrderMoney', () => {
  test('balances cash and GCash payments with change', () => {
    const money = calculateOrderMoney({
      items: [
        { qty: 2, unitPriceCentavos: 15000 },
        { qty: 1, unitPriceCentavos: 8500 },
      ],
      laborTotalCentavos: 10000,
      extras: [{ amountCentavos: 2000 }],
      payments: [
        { method: 'CASH', amountCentavos: 30000 },
        { method: 'GCASH', amountCentavos: 22000 },
      ],
      changes: [{ method: 'CASH', amountCentavos: 1500 }],
    });

    expect(money).toEqual({
      partsCentavos: 38500,
      extrasCentavos: 2000,
      customerTotalCentavos: 48500,
      paidCentavos: 52000,
      changeCentavos: 1500,
      balanceCentavos: 0,
      netCashCentavos: 28500,
      netGcashCentavos: 22000,
    });
    expect(isBalanced(money)).toBe(true);
  });

  test('reports a short payment as a negative balance', () => {
    const money = calculateOrderMoney({
      items: [{ qty: 1, unitPriceCentavos: 10000 }],
      laborTotalCentavos: 0,
      extras: [],
      payments: [{ method: 'CASH', amountCentavos: 5000 }],
      changes: [],
    });

    expect(money.balanceCentavos).toBe(-5000);
    expect(isBalanced(money)).toBe(false);
  });

  test('reports change larger than the payment for that method as negative net', () => {
    const money = calculateOrderMoney({
      items: [],
      laborTotalCentavos: 0,
      extras: [],
      payments: [{ method: 'GCASH', amountCentavos: 2000 }],
      changes: [{ method: 'GCASH', amountCentavos: 3000 }],
    });

    expect(money.balanceCentavos).toBe(-1000);
    expect(money.netGcashCentavos).toBe(-1000);
  });
});

describe('mainLaborCentavos', () => {
  test('gives the remainder to the main user', () => {
    expect(mainLaborCentavos(10000, 2000)).toBe(8000);
  });

  test('allows the helper to take the whole labor', () => {
    expect(mainLaborCentavos(10000, 10000)).toBe(0);
  });

  test('never returns a negative share', () => {
    expect(mainLaborCentavos(10000, 12000)).toBe(0);
  });
});
