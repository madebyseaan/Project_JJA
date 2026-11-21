import { Loader2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParts } from '@/features/inventory/hooks/use-parts';
import type { Part } from '@/features/inventory/types';
import { formatCentavos } from '@/lib/money';

type PartPickerProps = {
  isOnline: boolean;
  pendingPartId?: string | null;
  onPick: (part: Part, qty: number) => void;
};

export function PartPicker({ isOnline, pendingPartId, onPick }: PartPickerProps) {
  const parts = useParts();
  const [search, setSearch] = useState('');

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (parts.data ?? []).filter((part) => {
      if (!part.isActive || part.availableQty <= 0) return false;
      if (!term) return true;
      return [part.name, part.sku ?? '', part.category, part.compatibleModels.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [parts.data, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="text-steel pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Search parts by name, SKU, or model…"
          aria-label="Search parts to add"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {parts.isPending ? (
        <output className="text-steel flex items-center gap-2 py-4 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading parts…
        </output>
      ) : parts.isError ? (
        <p role="alert" className="text-danger text-sm">
          {parts.error.message}
        </p>
      ) : results.length === 0 ? (
        <p className="text-steel py-4 text-sm">
          {search ? 'No parts match that search.' : 'No parts have available stock.'}
        </p>
      ) : (
        <ul className="divide-line border-line max-h-72 divide-y overflow-y-auto rounded-md border">
          {results.map((part) => (
            <li key={part.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{part.name}</p>
                <p className="text-steel text-xs">
                  {part.sku ? `${part.sku} · ` : ''}
                  {part.availableQty} available · {formatCentavos(part.unitPriceCentavos)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!isOnline || pendingPartId === part.id}
                onClick={() => onPick(part, 1)}
                aria-label={`Add ${part.name}`}
              >
                {pendingPartId === part.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
