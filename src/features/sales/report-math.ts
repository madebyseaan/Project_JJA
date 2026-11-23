import type { DailyReport, LaborReport, PaymentsReport } from './types';

export type MonthlyRow = {
  paidOn: string;
  orderCount: number;
  partsCentavos: number;
  laborCentavos: number;
  extrasCentavos: number;
  totalCentavos: number;
  cashCentavos: number;
  gcashCentavos: number;
};

export type MonthlyTotals = {
  orderCount: number;
  partsCentavos: number;
  laborCentavos: number;
  extrasCentavos: number;
  totalCentavos: number;
  cashCentavos: number;
  gcashCentavos: number;
};

export type PersonLabor = {
  userId: string;
  displayName: string;
  baseLaborCentavos: number;
  extrasCentavos: number;
  payoutCentavos: number;
};

/** Validate a YYYY-MM month and return its first and last business dates. */
export function monthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return null;
  }

  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function buildMonthlyRows(daily: DailyReport[], payments: PaymentsReport[]): MonthlyRow[] {
  const dates = new Set<string>();

  for (const row of daily) dates.add(row.paidOn);
  for (const row of payments) dates.add(row.paidOn);

  return [...dates]
    .sort((left, right) => left.localeCompare(right))
    .map((paidOn) => {
      const day = daily.find((row) => row.paidOn === paidOn);
      const cash = payments.find((row) => row.paidOn === paidOn && row.method === 'CASH');
      const gcash = payments.find((row) => row.paidOn === paidOn && row.method === 'GCASH');

      return {
        paidOn,
        orderCount: day?.orderCount ?? 0,
        partsCentavos: day?.partsTotalCentavos ?? 0,
        laborCentavos: day?.laborTotalCentavos ?? 0,
        extrasCentavos: day?.extrasTotalCentavos ?? 0,
        totalCentavos: day?.totalCentavos ?? 0,
        cashCentavos: cash?.netCentavos ?? 0,
        gcashCentavos: gcash?.netCentavos ?? 0,
      };
    });
}

export function sumMonthlyRows(rows: MonthlyRow[]): MonthlyTotals {
  return rows.reduce<MonthlyTotals>(
    (totals, row) => ({
      orderCount: totals.orderCount + row.orderCount,
      partsCentavos: totals.partsCentavos + row.partsCentavos,
      laborCentavos: totals.laborCentavos + row.laborCentavos,
      extrasCentavos: totals.extrasCentavos + row.extrasCentavos,
      totalCentavos: totals.totalCentavos + row.totalCentavos,
      cashCentavos: totals.cashCentavos + row.cashCentavos,
      gcashCentavos: totals.gcashCentavos + row.gcashCentavos,
    }),
    {
      orderCount: 0,
      partsCentavos: 0,
      laborCentavos: 0,
      extrasCentavos: 0,
      totalCentavos: 0,
      cashCentavos: 0,
      gcashCentavos: 0,
    },
  );
}

export function sumLaborByPerson(rows: LaborReport[]): PersonLabor[] {
  const people = new Map<string, PersonLabor>();

  for (const row of rows) {
    const current = people.get(row.userId) ?? {
      userId: row.userId,
      displayName: row.displayName,
      baseLaborCentavos: 0,
      extrasCentavos: 0,
      payoutCentavos: 0,
    };

    current.baseLaborCentavos += row.baseLaborCentavos;
    current.extrasCentavos += row.extrasCentavos;
    current.payoutCentavos += row.laborPayoutCentavos;
    people.set(row.userId, current);
  }

  return [...people.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}
