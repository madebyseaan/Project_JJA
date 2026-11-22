import { FileUp, Loader2, PackageSearch, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
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
import { Skeleton } from '@/components/ui/skeleton';
import { formatCentavos } from '@/lib/money';

import { parseCatalogCsv, type CatalogImportResult } from './catalog-csv';
import { useCatalog, useImportCatalog } from './hooks/use-sales';

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<CatalogImportResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const importCatalog = useImportCatalog();

  const reset = () => {
    setFileName('');
    setPreview(null);
    setFileError(null);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const close = (next: boolean) => {
    if (!next && importCatalog.isPending) {
      return;
    }

    if (!next) {
      reset();
    }

    onOpenChange(next);
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;

    setFileName(file.name);
    setFileError(null);
    setPreview(null);

    try {
      const text = await file.text();
      setPreview(parseCatalogCsv(text));
    } catch {
      setFileError('Could not read that file. Choose the QuickBooks CSV export.');
    }
  };

  const runImport = async () => {
    if (!preview || preview.items.length === 0) return;

    try {
      const result = await importCatalog.mutateAsync(preview.items);
      toast.success(`Item list imported: ${result.inserted} new, ${result.updated} updated.`);
      close(false);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Could not import the item list.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Import item list</DialogTitle>
          <DialogDescription>
            In QuickBooks, open Lists → Item List → Excel/CSV. Only active Inventory Part rows are
            imported. Stock counts are ignored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="catalog-file">QuickBooks item CSV</Label>
            <input
              ref={inputRef}
              id="catalog-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="touch"
                onClick={() => inputRef.current?.click()}
              >
                <FileUp aria-hidden="true" />
                Choose CSV
              </Button>
              <p className="text-steel min-w-0 truncate text-sm">{fileName || 'No file chosen'}</p>
            </div>
          </div>

          {fileError ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
            >
              {fileError}
            </p>
          ) : null}

          {preview ? (
            <output className="border-line bg-soft block rounded-md border p-3 text-sm">
              <p className="font-medium">
                {preview.items.length} item{preview.items.length === 1 ? '' : 's'} ready to import
              </p>
              <p className="text-steel mt-1">
                {preview.skipped} row{preview.skipped === 1 ? '' : 's'} skipped because they are
                inactive or not inventory parts.
              </p>
              {preview.errors.length > 0 ? (
                <div className="text-danger mt-2">
                  <p className="font-medium">
                    {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} need
                    attention:
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {preview.errors.slice(0, 5).map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                  {preview.errors.length > 5 ? (
                    <p className="mt-1 text-xs">And {preview.errors.length - 5} more.</p>
                  ) : null}
                </div>
              ) : null}
              {preview.items.length === 0 ? (
                <p className="text-danger mt-2">
                  No active inventory parts were found. Check that you exported the Item List, not a
                  sales report.
                </p>
              ) : null}
            </output>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            size="touch"
            disabled={!preview || preview.items.length === 0 || importCatalog.isPending}
            onClick={() => void runImport()}
          >
            {importCatalog.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp aria-hidden="true" />
            )}
            {importCatalog.isPending ? 'Importing…' : 'Import items'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={importCatalog.isPending}
            onClick={() => close(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ItemsPage() {
  const catalog = useCatalog();
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const items = catalog.data;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = items ?? [];

    if (!term) return rows;

    return rows.filter((item) =>
      `${item.name} ${item.sku ?? ''} ${item.description}`.toLowerCase().includes(term),
    );
  }, [items, search]);
  const visible = filtered.slice(0, 200);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Items"
        description="The QuickBooks price list. Prices fill new orders and can be changed per order."
        actions={
          <Button size="touch" onClick={() => setImportOpen(true)}>
            <FileUp aria-hidden="true" />
            Import item list
          </Button>
        }
      />

      <div className="max-w-xl">
        <Label htmlFor="catalog-search">Search items</Label>
        <div className="relative mt-1">
          <Search
            className="text-steel pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="catalog-search"
            className="pl-9"
            placeholder="Name, SKU, or description…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {catalog.isPending ? (
        <output className="block space-y-2" aria-label="Loading items">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="block h-16 w-full" />
          ))}
        </output>
      ) : catalog.isError ? (
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load the item list.</p>
          <p className="text-ink-soft mt-1 text-sm">{catalog.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void catalog.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (items?.length ?? 0) === 0 ? (
        <EmptyState
          title="No items yet"
          description="Import the QuickBooks item list once. New orders will then fill prices automatically."
          action={
            <Button size="touch" onClick={() => setImportOpen(true)}>
              <FileUp aria-hidden="true" />
              Import item list
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="border-line bg-surface rounded-lg border p-6 text-center">
          <PackageSearch className="text-steel mx-auto size-8" aria-hidden="true" />
          <p className="mt-2 font-medium">No item matches “{search.trim()}”.</p>
          <p className="text-steel mt-1 text-sm">
            Change the search, or add the item as a custom line on an order.
          </p>
        </div>
      ) : (
        <>
          <p className="text-steel text-sm" aria-live="polite">
            {filtered.length} of {items?.length ?? 0} item
            {(items?.length ?? 0) === 1 ? '' : 's'}
          </p>
          <ul className="divide-line border-line bg-surface divide-y rounded-lg border">
            {visible.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.description ? (
                    <p className="text-steel mt-0.5 line-clamp-2 text-sm">{item.description}</p>
                  ) : null}
                  <p className="text-steel mt-1 text-xs">
                    {[item.sku, item.preferredVendor].filter(Boolean).join(' · ') || item.itemType}
                  </p>
                </div>
                <p className="font-display shrink-0 text-lg font-semibold tabular-nums">
                  {formatCentavos(item.basePriceCentavos)}
                </p>
              </li>
            ))}
          </ul>
          {filtered.length > visible.length ? (
            <p className="text-steel text-sm">
              Showing the first {visible.length} of {filtered.length} matches. Refine the search to
              narrow the list.
            </p>
          ) : null}
        </>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
