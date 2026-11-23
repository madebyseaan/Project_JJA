import { Banknote, Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCentavos, formatPesoInput } from '@/lib/money';

import { staffLabel } from '../staff-label';
import type { QuickSalePaymentValue, StaffProfile } from '../types';

type QuickSalePaymentProps = {
  value: QuickSalePaymentValue;
  totalCentavos: number;
  changeCentavos: number;
  shortfallCentavos: number;
  staff: StaffProfile[];
  currentUserId: string | null;
  defaultRecipientId: string;
  disabled?: boolean;
  onChange: (value: QuickSalePaymentValue) => void;
};

export function QuickSalePayment({
  value,
  totalCentavos,
  changeCentavos,
  shortfallCentavos,
  staff,
  currentUserId,
  defaultRecipientId,
  disabled = false,
  onChange,
}: QuickSalePaymentProps) {
  const update = (patch: Partial<QuickSalePaymentValue>) => onChange({ ...value, ...patch });
  const amountValue = value.amountTouched ? value.amount : formatPesoInput(totalCentavos);
  const recipientId = value.gcashRecipientId || defaultRecipientId;

  return (
    <section
      className="border-line bg-surface rounded-lg border p-4"
      aria-labelledby="quick-sale-payment"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="quick-sale-payment" className="font-display text-xl font-semibold">
            Payment now
          </h2>
          <p className="text-steel text-xs">
            No labor on this sale. Collect payment now, or save it as an open job.
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Payment timing">
          <Button
            type="button"
            size="touch"
            variant={value.payNow ? 'default' : 'outline'}
            aria-pressed={value.payNow}
            disabled={disabled}
            onClick={() => update({ payNow: true })}
          >
            Pay now
          </Button>
          <Button
            type="button"
            size="touch"
            variant={!value.payNow ? 'default' : 'outline'}
            aria-pressed={!value.payNow}
            disabled={disabled}
            onClick={() => update({ payNow: false })}
          >
            Pay later
          </Button>
        </div>
      </div>

      {value.payNow ? (
        <div className="mt-4 space-y-3">
          <div>
            <Label>Method</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                size="touch"
                variant={value.method === 'CASH' ? 'default' : 'outline'}
                aria-pressed={value.method === 'CASH'}
                disabled={disabled}
                onClick={() => update({ method: 'CASH', gcashRecipientId: '' })}
              >
                <Banknote aria-hidden="true" />
                Cash
              </Button>
              <Button
                type="button"
                size="touch"
                variant={value.method === 'GCASH' ? 'default' : 'outline'}
                aria-pressed={value.method === 'GCASH'}
                disabled={disabled}
                onClick={() =>
                  update({
                    method: 'GCASH',
                    gcashRecipientId: value.gcashRecipientId || defaultRecipientId,
                  })
                }
              >
                <Smartphone aria-hidden="true" />
                GCash
              </Button>
            </div>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="quick-sale-amount">Amount received (₱)</Label>
            <Input
              id="quick-sale-amount"
              inputMode="decimal"
              value={amountValue}
              disabled={disabled}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => update({ amount: event.target.value, amountTouched: true })}
            />
          </div>

          {value.method === 'GCASH' ? (
            <div>
              <Label>Received by</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {staff.map((person) => (
                  <Button
                    key={person.id}
                    type="button"
                    size="touch"
                    variant={recipientId === person.id ? 'default' : 'outline'}
                    aria-pressed={recipientId === person.id}
                    disabled={disabled}
                    onClick={() => update({ gcashRecipientId: person.id })}
                  >
                    {staffLabel(person, currentUserId)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <p
            className={
              shortfallCentavos > 0
                ? 'text-danger text-sm font-medium'
                : 'text-ink-soft text-sm font-medium'
            }
            aria-live="polite"
          >
            {shortfallCentavos > 0
              ? `Short by ${formatCentavos(shortfallCentavos)}`
              : changeCentavos > 0
                ? `Change ${formatCentavos(changeCentavos)}`
                : 'Exact payment.'}
          </p>
        </div>
      ) : (
        <p className="text-steel mt-4 text-sm">
          This will be saved as an Open job. Use Take payment when the customer pays.
        </p>
      )}
    </section>
  );
}
