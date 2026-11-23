import { describe, expect, test } from 'vitest';

import {
  buildMonthlyRows,
  monthRange,
  sumLaborByPerson,
  sumMonthlyRows,
} from '@/features/sales/report-math';
import type { DailyReport, LaborReport, PaymentsReport } from '@/features/sales/types';

describe('monthRange', () => {
  test('returns the first and last day of a month', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  test('rejects an invalid month', () => {
    expect(monthRange('2026-13')).toBeNull();
    expect(monthRange('November')).toBeNull();
    expect(monthRange('2026-1')).toBeNull();
  });
});

const daily: DailyReport[] = [
  {
    paidOn: '2026-11-02',
    orderCount: 2,
    partsTotalCentavos: 30000,
    laborTotalCentavos: 10000,
    totalCentavos: 40000,
    extrasTotalCentavos: 2000,
  },
  {
    paidOn: '2026-11-01',
    orderCount: 1,
    partsTotalCentavos: 5000,
    laborTotalCentavos: 0,
    totalCentavos: 5000,
    extrasTotalCentavos: 0,
  },
];

const payments: PaymentsReport[] = [
  {
    paidOn: '2026-11-02',
    method: 'CASH',
    receivedCentavos: 45000,
    changeCentavos: 5000,
    netCentavos: 40000,
  },
  {
    paidOn: '2026-11-02',
    method: 'GCASH',
    receivedCentavos: 5000,
    changeCentavos: 0,
    netCentavos: 5000,
  },
  {
    paidOn: '2026-11-01',
    method: 'CASH',
    receivedCentavos: 5000,
    changeCentavos: 0,
    netCentavos: 5000,
  },
];

describe('buildMonthlyRows', () => {
  test('combines daily sales with payment methods in date order', () => {
    const rows = buildMonthlyRows(daily, payments);

    expect(rows.map((row) => row.paidOn)).toEqual(['2026-11-01', '2026-11-02']);
    expect(rows[1]).toMatchObject({
      orderCount: 2,
      partsCentavos: 30000,
      laborCentavos: 10000,
      totalCentavos: 40000,
      cashCentavos: 40000,
      gcashCentavos: 5000,
    });
    expect(rows[0]?.gcashCentavos).toBe(0);
  });

  test('sums the month totals', () => {
    const totals = sumMonthlyRows(buildMonthlyRows(daily, payments));

    expect(totals).toEqual({
      orderCount: 3,
      partsCentavos: 35000,
      laborCentavos: 10000,
      extrasCentavos: 2000,
      totalCentavos: 45000,
      cashCentavos: 45000,
      gcashCentavos: 5000,
    });
  });
});

describe('sumLaborByPerson', () => {
  test('sums base labor, extras, and payout for each person', () => {
    const rows: LaborReport[] = [
      {
        paidOn: '2026-11-01',
        userId: 'Aldwin',
        displayName: 'Aldwin',
        baseLaborCentavos: 1000,
        extrasCentavos: 100,
        laborPayoutCentavos: 1100,
      },
      {
        paidOn: '2026-11-02',
        userId: 'Aldwin',
        displayName: 'Aldwin',
        baseLaborCentavos: 2000,
        extrasCentavos: 0,
        laborPayoutCentavos: 2000,
      },
      {
        paidOn: '2026-11-02',
        userId: 'Magma',
        displayName: 'Magma',
        baseLaborCentavos: 500,
        extrasCentavos: 50,
        laborPayoutCentavos: 550,
      },
    ];

    expect(sumLaborByPerson(rows)).toEqual([
      {
        userId: 'Aldwin',
        displayName: 'Aldwin',
        baseLaborCentavos: 3000,
        extrasCentavos: 100,
        payoutCentavos: 3100,
      },
      {
        userId: 'Magma',
        displayName: 'Magma',
        baseLaborCentavos: 500,
        extrasCentavos: 50,
        payoutCentavos: 550,
      },
    ]);
  });
});
