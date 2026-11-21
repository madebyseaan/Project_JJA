import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/use-auth';
import { useOnlineStatus } from '@/hooks/use-online-status';

import { PartFormSheet } from './components/PartFormSheet';
import { PartsTable } from './components/PartsTable';
import { StockAdjustDialog } from './components/StockAdjustDialog';
import { StockLedgerSheet } from './components/StockLedgerSheet';
import { useParts } from './hooks/use-parts';
import type { Part } from './types';

type FormState = { open: boolean; part: Part | null };

function LoadingState() {
  return (
    <output className="block space-y-2" aria-label="Loading inventory">
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="block h-16 w-full" />
      ))}
    </output>
  );
}

export function InventoryPage() {
  const auth = useAuth();
  const online = useOnlineStatus();
  const parts = useParts();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [lowOnly, setLowOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState>({ open: false, part: null });
  const [adjusting, setAdjusting] = useState<Part | null>(null);
  const [ledgerPart, setLedgerPart] = useState<Part | null>(null);

  const isOwner = auth.status === 'signed-in' && auth.profile.role === 'owner';

  const categories = useMemo(
    () => Array.from(new Set((parts.data ?? []).map((part) => part.category))).sort(),
    [parts.data],
  );

  const lowCount = useMemo(
    () =>
      (parts.data ?? []).filter(
        (part) => part.isActive && part.availableQty <= part.lowStockThreshold,
      ).length,
    [parts.data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (parts.data ?? []).filter((part) => {
      if (!showInactive && !part.isActive) return false;
      if (lowOnly && !(part.isActive && part.availableQty <= part.lowStockThreshold)) return false;
      if (category !== 'all' && part.category !== category) return false;

      if (!term) return true;

      const haystack = [part.name, part.sku ?? '', part.category, part.compatibleModels.join(' ')]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [category, lowOnly, parts.data, search, showInactive]);

  const hasFilters = search.trim() !== '' || category !== 'all' || lowOnly || showInactive;

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setLowOnly(false);
    setShowInactive(false);
  };

  const description =
    parts.data && parts.data.length > 0
      ? `${parts.data.length} parts · ${lowCount} low on stock`
      : 'Parts, prices, and available stock.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description={description}
        actions={
          isOwner ? (
            <Button
              size="touch"
              disabled={!online}
              onClick={() => setForm({ open: true, part: null })}
            >
              <Plus aria-hidden="true" />
              Add part
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="text-steel pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="Search name, SKU, model…"
              aria-label="Search parts"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select value={category} onValueChange={(value) => setCategory(String(value))}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={lowOnly ? 'default' : 'outline'}
            size="touch"
            aria-pressed={lowOnly}
            onClick={() => setLowOnly((value) => !value)}
          >
            Low stock{lowCount > 0 ? ` (${lowCount})` : ''}
          </Button>
          {isOwner ? (
            <Button
              variant={showInactive ? 'default' : 'outline'}
              size="touch"
              aria-pressed={showInactive}
              onClick={() => setShowInactive((value) => !value)}
            >
              Show inactive
            </Button>
          ) : null}
          {hasFilters ? (
            <Button variant="ghost" size="touch" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {!online ? (
        <output className="border-warn/30 bg-warn/10 text-warn block rounded-md border p-3 text-sm">
          You are offline. Inventory changes are disabled until the connection returns.
        </output>
      ) : null}

      {parts.isPending ? (
        <LoadingState />
      ) : parts.isError ? (
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load the parts catalog.</p>
          <p className="text-ink-soft mt-1 text-sm">{parts.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void parts.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (parts.data ?? []).length === 0 ? (
        <EmptyState
          title="No parts yet"
          description="Add the first part to start tracking prices and stock."
          action={
            isOwner ? (
              <Button
                size="touch"
                disabled={!online}
                onClick={() => setForm({ open: true, part: null })}
              >
                <Plus aria-hidden="true" />
                Add part
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No parts match these filters"
          description="Try a different search or clear the filters."
          action={
            <Button variant="outline" size="touch" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <PartsTable
          parts={filtered}
          isOwner={isOwner}
          isOnline={online}
          onEdit={(part) => setForm({ open: true, part })}
          onAdjust={(part) => setAdjusting(part)}
          onLedger={(part) => setLedgerPart(part)}
        />
      )}

      {form.open ? (
        <PartFormSheet
          key={form.part?.id ?? 'new'}
          open={form.open}
          part={form.part}
          isOnline={online}
          onOpenChange={(open) => setForm((state) => ({ ...state, open }))}
        />
      ) : null}

      {adjusting ? (
        <StockAdjustDialog
          key={adjusting.id}
          part={adjusting}
          open
          isOnline={online}
          onOpenChange={(open) => {
            if (!open) setAdjusting(null);
          }}
        />
      ) : null}

      {ledgerPart ? (
        <StockLedgerSheet
          key={ledgerPart.id}
          part={ledgerPart}
          open
          onOpenChange={(open) => {
            if (!open) setLedgerPart(null);
          }}
        />
      ) : null}
    </div>
  );
}
