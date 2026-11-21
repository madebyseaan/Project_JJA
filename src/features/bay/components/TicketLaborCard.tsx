import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatCentavos } from '@/lib/money';

import { useRemoveTicketLabor } from '../hooks/use-tickets';
import type { TicketLabor } from '../types';

type TicketLaborCardProps = {
  labor: TicketLabor[];
  editable: boolean;
  isOnline: boolean;
  onAddLabor: () => void;
};

export function TicketLaborCard({ labor, editable, isOnline, onAddLabor }: TicketLaborCardProps) {
  const removeLabor = useRemoveTicketLabor();

  const handleRemove = async (line: TicketLabor) => {
    try {
      await removeLabor.mutateAsync(line.id);
      toast.success('Labor removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the labor.');
    }
  };

  return (
    <section className="border-line bg-surface rounded-lg border">
      <div className="border-line flex items-center justify-between gap-2 border-b p-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Labor</h2>
          <p className="text-steel text-xs">{labor.length} lines</p>
        </div>
        {editable ? (
          <Button size="touch" disabled={!isOnline} onClick={onAddLabor}>
            <Plus aria-hidden="true" />
            Add labor
          </Button>
        ) : null}
      </div>

      {labor.length === 0 ? (
        <p className="text-steel p-4 text-sm">
          No labor yet.{editable ? ' Add the work performed.' : ''}
        </p>
      ) : (
        <ul className="divide-line divide-y">
          {labor.map((line) => (
            <li key={line.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{line.description}</p>
              </div>
              <p className="font-mono font-semibold tabular-nums">
                {formatCentavos(line.amountCentavos)}
              </p>
              {editable ? (
                <Button
                  variant="ghost"
                  size="touch"
                  aria-label={`Remove labor ${line.description}`}
                  disabled={!isOnline || removeLabor.isPending}
                  onClick={() => void handleRemove(line)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
