export type OrderMoneyInput = {
  items: { qty: number; unitPriceCentavos: number }[];
  laborTotalCentavos: number;
  extras: { amountCentavos: number }[];
  payments: { method: 'CASH' | 'GCASH'; amountCentavos: number }[];
  changes: { method: 'CASH' | 'GCASH'; amountCentavos: number }[];
};

export type OrderMoney = {
  partsCentavos: number;
  extrasCentavos: number;
  customerTotalCentavos: number;
  paidCentavos: number;
  changeCentavos: number;
  balanceCentavos: number;
  netCashCentavos: number;
  netGcashCentavos: number;
};

export function calculateOrderMoney(input: OrderMoneyInput): OrderMoney {
  const partsCentavos = input.items.reduce(
    (total, item) => total + item.qty * item.unitPriceCentavos,
    0,
  );
  const extrasCentavos = input.extras.reduce((total, extra) => total + extra.amountCentavos, 0);
  const paidCentavos = input.payments.reduce((total, payment) => total + payment.amountCentavos, 0);
  const changeCentavos = input.changes.reduce((total, change) => total + change.amountCentavos, 0);
  const customerTotalCentavos = partsCentavos + input.laborTotalCentavos;
  const balanceCentavos = paidCentavos - customerTotalCentavos - extrasCentavos - changeCentavos;

  const netByMethod = (method: 'CASH' | 'GCASH') =>
    input.payments
      .filter((payment) => payment.method === method)
      .reduce((total, payment) => total + payment.amountCentavos, 0) -
    input.changes
      .filter((change) => change.method === method)
      .reduce((total, change) => total + change.amountCentavos, 0);

  return {
    partsCentavos,
    extrasCentavos,
    customerTotalCentavos,
    paidCentavos,
    changeCentavos,
    balanceCentavos,
    netCashCentavos: netByMethod('CASH'),
    netGcashCentavos: netByMethod('GCASH'),
  };
}

export function mainLaborCentavos(laborTotalCentavos: number, helperLaborCentavos: number): number {
  return Math.max(0, laborTotalCentavos - helperLaborCentavos);
}

export function isBalanced(money: OrderMoney): boolean {
  return money.balanceCentavos === 0;
}
