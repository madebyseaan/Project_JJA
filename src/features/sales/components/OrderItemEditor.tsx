import { Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CatalogItem, DraftOrderItem } from '../types';
import { formatCentavos, parsePesoToCentavos } from '@/lib/money';

type OrderItemEditorProps = {
  items: DraftOrderItem[];
  catalog: CatalogItem[];
  onChange: (items: DraftOrderItem[]) => void;
};

function newKey() {
  return crypto.randomUUID();
}

export function OrderItemEditor({ items, catalog, onChange }: OrderItemEditorProps) {
  const [search, setSearch] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];

    return catalog
      .filter((item) => {
        const haystack = `${item.name} ${item.sku ?? ''} ${item.description}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 6);
  }, [catalog, search]);

  const addCatalogItem = (item: CatalogItem) => {
    const existing = items.find((line) => line.catalogItemId === item.id);

    if (existing) {
      onChange(
        items.map((line) =>
          line.catalogItemId === item.id
            ? { ...line, qty: String(Number(line.qty || 0) + 1) }
            : line,
        ),
      );
    } else {
      onChange([
        ...items,
        {
          key: newKey(),
          catalogItemId: item.id,
          name: item.name,
          qty: '1',
          price: (item.basePriceCentavos / 100).toFixed(2),
          isCustom: false,
        },
      ]);
    }

    setSearch('');
  };

  const addCustom = () => {
    const name = customName.trim();
    const price = parsePesoToCentavos(customPrice);

    if (!name) {
      setCustomError('Enter the item name.');
      return;
    }

    if (price === null || price < 0) {
      setCustomError('Enter a valid price.');
      return;
    }

    const qty = Number(customQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setCustomError('Enter a whole quantity.');
      return;
    }

    onChange([
      ...items,
      {
        key: newKey(),
        catalogItemId: null,
        name,
        qty: String(qty),
        price: (price / 100).toFixed(2),
        isCustom: true,
      },
    ]);
    setCustomOpen(false);
    setCustomName('');
    setCustomQty('1');
    setCustomPrice('');
    setCustomError(null);
  };

  const update = (key: string, patch: Partial<DraftOrderItem>) => {
    onChange(items.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const partsTotal = items.reduce((total, line) => {
    const price = parsePesoToCentavos(line.price) ?? 0;
    const qty = Number(line.qty) || 0;
    return total + price * qty;
  }, 0);

  return (
    <section className="border-line bg-surface rounded-lg border">
      <div className="border-line flex items-center justify-between gap-2 border-b p-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Items</h2>
          <p className="text-steel text-xs">Parts only. No stock tracking.</p>
        </div>
        <Button type="button" variant="outline" size="touch" onClick={() => setCustomOpen(true)}>
          <Plus aria-hidden="true" />
          Custom line
        </Button>
      </div>

      <div className="border-line border-b p-4">
        <Label htmlFor="item-search">Search the catalog</Label>
        <div className="relative mt-1">
          <Search
            className="text-steel pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="item-search"
            className="pl-9"
            placeholder="Name, SKU, or description…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {search.trim() ? (
          <ul className="divide-line border-line mt-2 divide-y rounded-md border">
            {results.length === 0 ? (
              <li className="text-steel p-3 text-sm">
                No match. Use “Custom line” if it is missing.
              </li>
            ) : (
              results.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-steel text-xs">
                      {formatCentavos(item.basePriceCentavos)}
                      {item.sku ? ` · ${item.sku}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    onClick={() => addCatalogItem(item)}
                  >
                    Add
                  </Button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-steel p-4 text-sm">
          No items yet. Search the catalog or use a custom line.
        </p>
      ) : (
        <ul className="divide-line divide-y">
          {items.map((line) => (
            <li
              key={line.key}
              className="grid gap-2 p-4 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end"
            >
              <div>
                <p className="font-medium">{line.name}</p>
                <p className="text-steel text-xs">
                  {line.isCustom ? 'Custom · not in QuickBooks' : 'Catalog item'}
                </p>
              </div>
              <div>
                <Label htmlFor={`qty-${line.key}`}>Qty</Label>
                <Input
                  id={`qty-${line.key}`}
                  inputMode="numeric"
                  value={line.qty}
                  onChange={(event) => update(line.key, { qty: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`price-${line.key}`}>Price (₱)</Label>
                <Input
                  id={`price-${line.key}`}
                  inputMode="decimal"
                  value={line.price}
                  onChange={(event) => update(line.key, { price: event.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="touch"
                aria-label={`Remove ${line.name}`}
                onClick={() => onChange(items.filter((item) => item.key !== line.key))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-line flex justify-between border-t p-4 text-sm">
        <span className="text-steel">Parts total</span>
        <span className="font-mono font-semibold tabular-nums">{formatCentavos(partsTotal)}</span>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Custom line</DialogTitle>
            <DialogDescription>
              Use this when the item is missing from the QuickBooks list. It will be flagged for
              export.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="custom-name">Item name</Label>
              <Input
                id="custom-name"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="custom-qty">Quantity</Label>
                <Input
                  id="custom-qty"
                  inputMode="numeric"
                  value={customQty}
                  onChange={(event) => setCustomQty(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="custom-price">Price (₱)</Label>
                <Input
                  id="custom-price"
                  inputMode="decimal"
                  value={customPrice}
                  onChange={(event) => setCustomPrice(event.target.value)}
                />
              </div>
            </div>
            {customError ? (
              <p role="alert" className="text-danger text-sm">
                {customError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" size="touch" onClick={addCustom}>
              Add line
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => setCustomOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
