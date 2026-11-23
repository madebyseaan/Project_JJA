import type { OrderChangeInput, OrderPaymentInput } from './types';

export type AutoChangeResult = {
  changes: OrderChangeInput[];
  paidCentavos: number;
  changeCentavos: number;
  shortfallCentavos: number;
  netCashCentavos: number;
  netGcashCentavos: number;
};

/**
 * Change is never typed. Cash is returned first, then GCash from the people
 * who received it. A tip/extra reduces the change because it is part of the
 * total to pay.
 */
export function calculateAutoChanges(
  payments: OrderPaymentInput[],
  totalToPayCentavos: number,
): AutoChangeResult {
  let cashPaid = 0;
  let gcashPaid = 0;
  const gcashByRecipient = new Map<string, number>();

  for (const payment of payments) {
    if (payment.method === 'CASH') {
      cashPaid += payment.amountCentavos;
      continue;
    }

    gcashPaid += payment.amountCentavos;
    const recipient = payment.gcashRecipientId;

    if (recipient) {
      gcashByRecipient.set(
        recipient,
        (gcashByRecipient.get(recipient) ?? 0) + payment.amountCentavos,
      );
    }
  }

  const paidCentavos = cashPaid + gcashPaid;
  const overpayment = Math.max(0, paidCentavos - totalToPayCentavos);
  const changes: OrderChangeInput[] = [];

  const cashChange = Math.min(overpayment, cashPaid);

  if (cashChange > 0) {
    changes.push({ method: 'CASH', amountCentavos: cashChange, gcashRecipientId: null });
  }

  let remaining = overpayment - cashChange;

  for (const [recipient, amount] of gcashByRecipient) {
    if (remaining <= 0) break;

    const change = Math.min(remaining, amount);

    if (change > 0) {
      changes.push({
        method: 'GCASH',
        amountCentavos: change,
        gcashRecipientId: recipient,
      });
      remaining -= change;
    }
  }

  const changeCentavos = overpayment - remaining;
  const gcashChange = changeCentavos - cashChange;

  return {
    changes,
    paidCentavos,
    changeCentavos,
    shortfallCentavos: Math.max(0, totalToPayCentavos - paidCentavos),
    netCashCentavos: cashPaid - cashChange,
    netGcashCentavos: gcashPaid - gcashChange,
  };
}
