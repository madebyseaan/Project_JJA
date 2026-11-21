import { Loader2 } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatManilaDateTime } from '@/lib/dates';

import { useStockMovements } from '../hooks/use-parts';
import type { Part, StockMovement } from '../types';

type StockLedgerSheetProps = {
  part: Part;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const REASON_LABELS: Record<StockMovement['reason'], string> = {
  INITIAL: 'Opening stock',
  RESTOCK: 'Restock',
  ADJUSTMENT: 'Adjustment',
  SALE: 'Sale',
  RETURN: 'Return',
};

export function StockLedgerSheet({ part, open, onOpenChange }: StockLedgerSheetProps) {
  const movements = useStockMovements(open ? part.id : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Stock ledger</SheetTitle>
          <SheetDescription>
            {part.name} · every change is recorded and cannot be edited.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {movements.isPending ? (
            <output className="text-steel flex items-center gap-2 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading stock movements…
            </output>
          ) : movements.isError ? (
            <div
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
            >
              <p>{movements.error.message}</p>
              <p className="mt-2">Check the connection and try again.</p>
            </div>
          ) : movements.data.length === 0 ? (
            <p className="text-steel py-6 text-sm">No stock movements yet.</p>
          ) : (
            <ul className="divide-line divide-y">
              {movements.data.map((movement) => (
                <li key={movement.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{REASON_LABELS[movement.reason]}</p>
                      <p className="text-steel text-xs">
                        {formatManilaDateTime(movement.createdAt)}
                        {movement.actorName ? ` · ${movement.actorName}` : ''}
                      </p>
                    </div>
                    <p
                      className={
                        movement.delta > 0
                          ? 'text-ok font-mono font-semibold tabular-nums'
                          : 'text-danger font-mono font-semibold tabular-nums'
                      }
                    >
                      {movement.delta > 0 ? '+' : ''}
                      {movement.delta}
                    </p>
                  </div>
                  {movement.note ? (
                    <p className="text-ink-soft mt-1 text-sm">{movement.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
