import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { staffLabel } from '../staff-label';
import type { DraftOrderExtra, StaffProfile } from '../types';

type ExtrasFieldsProps = {
  extras: DraftOrderExtra[];
  staff: StaffProfile[];
  mainUserId: string;
  helperUserId: string;
  currentUserId: string | null;
  onChange: (extras: DraftOrderExtra[]) => void;
};

function newKey() {
  return crypto.randomUUID();
}

export function ExtrasFields({
  extras,
  staff,
  mainUserId,
  helperUserId,
  currentUserId,
  onChange,
}: ExtrasFieldsProps) {
  const recipients = staff.filter(
    (person) => person.id === mainUserId || person.id === helperUserId,
  );

  const update = (key: string, patch: Partial<DraftOrderExtra>) => {
    onChange(extras.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <section className="border-line bg-surface rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Extras</h2>
          <p className="text-steel text-xs">
            Optional. Only if the customer wants to give part of the change. Defaults to the main
            worker.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="touch"
          onClick={() =>
            onChange([...extras, { key: newKey(), userId: mainUserId, amount: '', note: '' }])
          }
        >
          <Plus aria-hidden="true" />
          Add extra
        </Button>
      </div>

      {extras.length === 0 ? (
        <p className="text-steel mt-2 text-sm">No extra.</p>
      ) : (
        <ul className="divide-line mt-2 divide-y">
          {extras.map((extra) => (
            <li
              key={extra.key}
              className="grid gap-2 py-3 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end"
            >
              <div>
                <Label>Recipient</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {recipients.map((person) => (
                    <Button
                      key={person.id}
                      type="button"
                      variant={extra.userId === person.id ? 'default' : 'outline'}
                      size="touch"
                      aria-pressed={extra.userId === person.id}
                      onClick={() => update(extra.key, { userId: person.id })}
                    >
                      {staffLabel(person, currentUserId)}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor={`extra-${extra.key}`}>Amount (₱)</Label>
                <Input
                  id={`extra-${extra.key}`}
                  inputMode="decimal"
                  value={extra.amount}
                  onChange={(event) => update(extra.key, { amount: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`extra-note-${extra.key}`}>Note</Label>
                <Input
                  id={`extra-note-${extra.key}`}
                  placeholder="Optional"
                  value={extra.note}
                  onChange={(event) => update(extra.key, { note: event.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="touch"
                aria-label="Remove extra"
                onClick={() => onChange(extras.filter((row) => row.key !== extra.key))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
