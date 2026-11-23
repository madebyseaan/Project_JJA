import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { staffLabel } from '../staff-label';
import type { DraftOrderChange, DraftOrderPayment, StaffProfile } from '../types';

type OrderPaymentEditorProps = {
  payments: DraftOrderPayment[];
  changes: DraftOrderChange[];
  staff: StaffProfile[];
  defaultRecipientId: string;
  currentUserId: string | null;
  onPaymentsChange: (payments: DraftOrderPayment[]) => void;
  onChangesChange: (changes: DraftOrderChange[]) => void;
};

function newKey() {
  return crypto.randomUUID();
}

function MethodButtons({
  value,
  onChange,
}: {
  value: 'CASH' | 'GCASH';
  onChange: (method: 'CASH' | 'GCASH') => void;
}) {
  return (
    <div className="flex gap-2">
      {(['CASH', 'GCASH'] as const).map((method) => (
        <Button
          key={method}
          type="button"
          variant={value === method ? 'default' : 'outline'}
          size="touch"
          aria-pressed={value === method}
          onClick={() => onChange(method)}
        >
          {method === 'CASH' ? 'Cash' : 'GCash'}
        </Button>
      ))}
    </div>
  );
}

function RecipientButtons({
  value,
  staff,
  currentUserId,
  onChange,
}: {
  value: string;
  staff: StaffProfile[];
  currentUserId: string | null;
  onChange: (userId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {staff.map((person) => (
        <Button
          key={person.id}
          type="button"
          variant={value === person.id ? 'default' : 'outline'}
          size="touch"
          aria-pressed={value === person.id}
          onClick={() => onChange(person.id)}
        >
          {staffLabel(person, currentUserId)}
        </Button>
      ))}
    </div>
  );
}

export function OrderPaymentEditor({
  payments,
  changes,
  staff,
  defaultRecipientId,
  currentUserId,
  onPaymentsChange,
  onChangesChange,
}: OrderPaymentEditorProps) {
  const updatePayment = (key: string, patch: Partial<DraftOrderPayment>) => {
    onPaymentsChange(payments.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const updateChange = (key: string, patch: Partial<DraftOrderChange>) => {
    onChangesChange(changes.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const nextRecipient = defaultRecipientId || staff[0]?.id || '';
  const gcashPayers = staff.filter((person) =>
    payments.some((row) => row.method === 'GCASH' && row.gcashRecipientId === person.id),
  );

  return (
    <section className="border-line bg-surface rounded-lg border">
      <div className="border-line flex items-center justify-between gap-2 border-b p-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Payment</h2>
          <p className="text-steel text-xs">Cash, GCash, or both. Change can be cash or GCash.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="touch"
          onClick={() =>
            onPaymentsChange([
              ...payments,
              { key: newKey(), method: 'CASH', amount: '', gcashRecipientId: '' },
            ])
          }
        >
          <Plus aria-hidden="true" />
          Add payment
        </Button>
      </div>

      {payments.length === 0 ? (
        <p className="text-steel p-4 text-sm">No payments yet.</p>
      ) : (
        <ul className="divide-line divide-y">
          {payments.map((row) => (
            <li key={row.key} className="space-y-3 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <Label>Method</Label>
                  <div className="mt-1">
                    <MethodButtons
                      value={row.method}
                      onChange={(method) =>
                        updatePayment(row.key, {
                          method,
                          gcashRecipientId:
                            method === 'GCASH' ? row.gcashRecipientId || nextRecipient : '',
                        })
                      }
                    />
                  </div>
                </div>
                <div className="w-36">
                  <Label htmlFor={`pay-${row.key}`}>Amount (₱)</Label>
                  <Input
                    id={`pay-${row.key}`}
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(event) => updatePayment(row.key, { amount: event.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="touch"
                  aria-label="Remove payment"
                  onClick={() => onPaymentsChange(payments.filter((item) => item.key !== row.key))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>

              {row.method === 'GCASH' ? (
                <div>
                  <Label>Received by</Label>
                  <div className="mt-1">
                    <RecipientButtons
                      value={row.gcashRecipientId}
                      staff={staff}
                      currentUserId={currentUserId}
                      onChange={(gcashRecipientId) => updatePayment(row.key, { gcashRecipientId })}
                    />
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="border-line border-t p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold">Change</h3>
            <p className="text-steel text-xs">Only if the customer is owed money back.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={() =>
              onChangesChange([
                ...changes,
                {
                  key: newKey(),
                  method: 'CASH',
                  amount: '',
                  gcashRecipientId: '',
                },
              ])
            }
          >
            <Plus aria-hidden="true" />
            Add change
          </Button>
        </div>

        {changes.length === 0 ? (
          <p className="text-steel mt-2 text-sm">No change.</p>
        ) : (
          <ul className="divide-line mt-2 divide-y">
            {changes.map((row) => (
              <li key={row.key} className="space-y-3 py-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <Label>Method</Label>
                    <div className="mt-1">
                      <MethodButtons
                        value={row.method}
                        onChange={(method) =>
                          updateChange(row.key, {
                            method,
                            gcashRecipientId:
                              method === 'GCASH'
                                ? gcashPayers.some((person) => person.id === row.gcashRecipientId)
                                  ? row.gcashRecipientId
                                  : (gcashPayers[0]?.id ?? '')
                                : '',
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="w-36">
                    <Label htmlFor={`change-${row.key}`}>Amount (₱)</Label>
                    <Input
                      id={`change-${row.key}`}
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(event) => updateChange(row.key, { amount: event.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="touch"
                    aria-label="Remove change"
                    onClick={() => onChangesChange(changes.filter((item) => item.key !== row.key))}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>

                {row.method === 'GCASH' ? (
                  <div>
                    <Label>Returned from</Label>
                    <div className="mt-1">
                      {gcashPayers.length === 0 ? (
                        <p className="text-steel text-sm">
                          Add a GCash payment first to return GCash change.
                        </p>
                      ) : (
                        <RecipientButtons
                          value={row.gcashRecipientId}
                          staff={gcashPayers}
                          currentUserId={currentUserId}
                          onChange={(gcashRecipientId) =>
                            updateChange(row.key, { gcashRecipientId })
                          }
                        />
                      )}
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
