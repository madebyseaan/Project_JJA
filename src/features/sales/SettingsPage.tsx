import { FileUp, ReceiptText, Settings, Store } from 'lucide-react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useShopSettings } from './hooks/use-sales';

export function SettingsPage() {
  const shop = useShopSettings();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Shop details used on digital receipts. QuickBooks mapping arrives with the export step."
      />

      <section className="border-line bg-surface rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Store className="text-safety size-5" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold">Shop</h2>
        </div>

        {shop.isPending ? (
          <div className="mt-3 space-y-2" aria-label="Loading shop settings">
            <Skeleton className="block h-5 w-2/3" />
            <Skeleton className="block h-4 w-1/2" />
            <Skeleton className="block h-4 w-1/3" />
          </div>
        ) : shop.isError ? (
          <div role="alert" className="mt-3">
            <p className="text-danger text-sm">Could not load shop details: {shop.error.message}</p>
            <Button
              variant="outline"
              size="touch"
              className="mt-2"
              onClick={() => void shop.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-steel text-xs">Shop name</dt>
              <dd className="font-medium">{shop.data?.shopName}</dd>
            </div>
            <div>
              <dt className="text-steel text-xs">Address</dt>
              <dd>{shop.data?.address || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-steel text-xs">Contact</dt>
              <dd>{shop.data?.contact || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-steel text-xs">Receipt footer</dt>
              <dd>{shop.data?.receiptFooter || 'Not set'}</dd>
            </div>
          </dl>
        )}

        <p className="text-steel mt-3 text-xs">
          These details also appear on the public digital receipt. Editing shop details is not
          enabled in this step.
        </p>
      </section>

      <section className="border-line bg-surface rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <FileUp className="text-safety size-5" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold">QuickBooks item list</h2>
        </div>
        <p className="text-ink-soft mt-2 text-sm">
          The catalog comes from the QuickBooks Item List. Re-import it whenever prices or item
          names change in QuickBooks.
        </p>
        <Button
          variant="outline"
          size="touch"
          className="mt-3"
          nativeButton={false}
          render={<Link to="/items" />}
        >
          <FileUp aria-hidden="true" />
          Open items
        </Button>
      </section>

      <section className="border-line bg-surface rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <ReceiptText className="text-safety size-5" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold">Coming next</h2>
        </div>
        <ul className="text-ink-soft mt-2 list-inside list-disc space-y-1 text-sm">
          <li>QuickBooks month close and IIF export of parts sales.</li>
          <li>Month lock after export, with corrections made in QuickBooks.</li>
          <li>Manual reconciliation against QuickBooks totals.</li>
          <li>QuickBooks cash, GCash, and sales tax mapping.</li>
        </ul>
      </section>

      <section className="border-line bg-surface rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Settings className="text-steel size-5" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold">Access</h2>
        </div>
        <p className="text-ink-soft mt-2 text-sm">
          Both staff accounts have the same access: orders, items, reports, GCash, and settings.
          There is no owner-only screen in the sales log.
        </p>
      </section>
    </div>
  );
}
