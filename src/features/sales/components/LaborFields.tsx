import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCentavos } from '@/lib/money';

import { staffLabel } from '../staff-label';
import type { StaffProfile } from '../types';

type LaborFieldsProps = {
  staff: StaffProfile[];
  mainUserId: string;
  helperUserId: string;
  currentUserId: string | null;
  labor: string;
  helperLabor: string;
  mainLaborCentavos: number;
  onLaborChange: (value: string) => void;
  onHelperLaborChange: (value: string) => void;
  onChooseMain: (userId: string) => void;
  onChooseHelper: (userId: string | null) => void;
};

export function LaborFields({
  staff,
  mainUserId,
  helperUserId,
  currentUserId,
  labor,
  helperLabor,
  mainLaborCentavos,
  onLaborChange,
  onHelperLaborChange,
  onChooseMain,
  onChooseHelper,
}: LaborFieldsProps) {
  const mainUser = staff.find((person) => person.id === mainUserId);
  const helperOptions = staff.filter((person) => person.id !== mainUserId);

  return (
    <section className="border-line bg-surface rounded-lg border p-4">
      <h2 className="font-display text-xl font-semibold">Labor</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Main worker</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {staff.map((person) => (
              <Button
                key={person.id}
                type="button"
                variant={mainUserId === person.id ? 'default' : 'outline'}
                size="touch"
                aria-pressed={mainUserId === person.id}
                onClick={() => onChooseMain(person.id)}
              >
                {staffLabel(person, currentUserId)}
              </Button>
            ))}
          </div>
          <p className="text-steel mt-1 text-xs">
            Gets the rest of the labor after the helper’s share.
          </p>
        </div>

        <div>
          <Label htmlFor="labor-total">Total labor (₱)</Label>
          <Input
            id="labor-total"
            inputMode="decimal"
            value={labor}
            onChange={(event) => onLaborChange(event.target.value)}
          />
        </div>

        <div>
          <Label>Helper</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={!helperUserId ? 'default' : 'outline'}
              size="touch"
              aria-pressed={!helperUserId}
              onClick={() => onChooseHelper(null)}
            >
              No helper
            </Button>
            {helperOptions.map((person) => (
              <Button
                key={person.id}
                type="button"
                variant={helperUserId === person.id ? 'default' : 'outline'}
                size="touch"
                aria-pressed={helperUserId === person.id}
                onClick={() => onChooseHelper(person.id)}
              >
                {staffLabel(person, currentUserId)}
              </Button>
            ))}
          </div>
        </div>

        {helperUserId ? (
          <div>
            <Label htmlFor="helper-labor">Helper’s share (₱)</Label>
            <Input
              id="helper-labor"
              inputMode="decimal"
              value={helperLabor}
              onChange={(event) => onHelperLaborChange(event.target.value)}
            />
          </div>
        ) : null}

        <div>
          <Label>{mainUser ? `${staffLabel(mainUser, currentUserId)} share` : 'Main share'}</Label>
          <p className="font-mono text-lg font-semibold tabular-nums">
            {formatCentavos(mainLaborCentavos)}
          </p>
        </div>
      </div>
    </section>
  );
}
