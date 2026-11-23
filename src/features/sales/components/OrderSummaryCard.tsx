import type { ReactNode } from 'react';

import { formatCentavos } from '@/lib/money';

type OrderSummaryCardProps = {
  mode: 'job' | 'payment';
  partsCentavos: number;
  laborCentavos: number;
  extrasCentavos?: number;
  paidCentavos?: number;
  changeCentavos?: number;
  balanceCentavos?: number;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  note?: string;
};

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-steel">{label}</dt>
      <dd className="font-mono tabular-nums">{formatCentavos(value)}</dd>
    </div>
  );
}

export function OrderSummaryCard({
  mode,
  partsCentavos,
  laborCentavos,
  extrasCentavos = 0,
  paidCentavos = 0,
  changeCentavos = 0,
  balanceCentavos = 0,
  primaryAction,
  secondaryAction,
  note,
}: OrderSummaryCardProps) {
  const jobTotal = partsCentavos + laborCentavos;
  const totalToPay = mode === 'job' ? jobTotal : jobTotal + extrasCentavos;
  const balanced = balanceCentavos === 0;

  return (
    <section className="border-line bg-surface rounded-lg border p-4" aria-labelledby="order-total">
      <h2 id="order-total" className="font-display text-xl font-semibold">
        {mode === 'job' ? 'Job total' : 'Payment total'}
      </h2>

      <dl className="mt-3 space-y-1 text-sm">
        <Row label="Parts" value={partsCentavos} />
        <Row label="Labor" value={laborCentavos} />
        {mode === 'payment' ? <Row label="Extras / tip" value={extrasCentavos} /> : null}

        <div className="border-line mt-3 flex items-baseline justify-between gap-2 border-t pt-3">
          <dt className="text-base font-semibold">
            {mode === 'job' ? 'Job total' : 'Total to pay'}
          </dt>
          <dd className="font-display text-2xl font-bold tabular-nums" aria-live="polite">
            {formatCentavos(totalToPay)}
          </dd>
        </div>

        {mode === 'payment' ? (
          <>
            <div className="border-line mt-2 border-t pt-2">
              <Row label="Payments" value={paidCentavos} />
              <Row label="Change" value={changeCentavos} />
            </div>
            <div className="flex justify-between gap-2 font-semibold">
              <dt className={balanced ? 'text-ok' : 'text-danger'}>Balance</dt>
              <dd
                className={
                  balanced ? 'text-ok font-mono tabular-nums' : 'text-danger font-mono tabular-nums'
                }
              >
                {formatCentavos(balanceCentavos)}
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      {note ? <p className="text-steel mt-3 text-xs">{note}</p> : null}

      {primaryAction || secondaryAction ? (
        <div className="mt-4 space-y-2">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </section>
  );
}
