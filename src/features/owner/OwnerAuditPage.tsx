import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatManilaDateTime } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { useAuditEvents, useReceiptIntegrity } from './hooks/use-owner';

function AuditSkeleton() {
  return (
    <output className="block space-y-2" aria-label="Loading audit log">
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="block h-14 w-full" />
      ))}
    </output>
  );
}

export function OwnerAuditPage() {
  const audit = useAuditEvents();
  const integrity = useReceiptIntegrity();
  const queryClient = useQueryClient();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['owner', 'audit'] });
    void queryClient.invalidateQueries({ queryKey: ['owner', 'integrity'] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit"
        description="Receipt integrity and the append-only action log."
        actions={
          <Button variant="outline" size="touch" onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <section className="border-line bg-surface rounded-lg border">
        <div className="border-line flex items-center gap-2 border-b p-4">
          {integrity.data &&
          integrity.data.mismatches.length === 0 &&
          integrity.data.missingNumbers.length === 0 ? (
            <ShieldCheck className="text-ok size-5" aria-hidden="true" />
          ) : (
            <ShieldAlert className="text-warn size-5" aria-hidden="true" />
          )}
          <div>
            <h2 className="font-display text-xl font-semibold">Receipt integrity</h2>
            {integrity.data ? (
              <p className="text-steel text-xs">
                {integrity.data.receiptCount} receipts checked{' '}
                {integrity.data.checkedAt
                  ? `· ${formatManilaDateTime(integrity.data.checkedAt)}`
                  : ''}
              </p>
            ) : null}
          </div>
        </div>

        {integrity.isPending ? (
          <div className="p-4">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : integrity.isError ? (
          <div role="alert" className="p-4">
            <p className="text-danger font-medium">Could not run the integrity check.</p>
            <p className="text-ink-soft mt-1 text-sm">{integrity.error.message}</p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border-line rounded-md border p-3">
                <p className="text-steel text-xs">Hash mismatches</p>
                <p
                  className={
                    integrity.data.mismatches.length === 0
                      ? 'text-ok font-display text-2xl font-bold'
                      : 'text-danger font-display text-2xl font-bold'
                  }
                >
                  {integrity.data.mismatches.length}
                </p>
              </div>
              <div className="border-line rounded-md border p-3">
                <p className="text-steel text-xs">Missing numbers</p>
                <p
                  className={
                    integrity.data.missingNumbers.length === 0
                      ? 'text-ok font-display text-2xl font-bold'
                      : 'text-danger font-display text-2xl font-bold'
                  }
                >
                  {integrity.data.missingNumbers.length}
                </p>
              </div>
              <div className="border-line rounded-md border p-3">
                <p className="text-steel text-xs">Voided receipts</p>
                <p className="font-display text-2xl font-bold">{integrity.data.voided.length}</p>
              </div>
            </div>

            {integrity.data.mismatches.length > 0 ? (
              <div>
                <h3 className="text-danger text-sm font-semibold">Tampered snapshots</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {integrity.data.mismatches.map((row) => (
                    <li key={row.receiptNo} className="font-mono">
                      {row.receiptNo} · {formatCentavos(row.totalCentavos)} ·{' '}
                      {formatManilaDateTime(row.issuedAt)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {integrity.data.missingNumbers.length > 0 ? (
              <div>
                <h3 className="text-danger text-sm font-semibold">Missing numbers</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {integrity.data.missingNumbers.map((row) => (
                    <li key={`${row.businessDate}-${row.receiptNo}`} className="font-mono">
                      {row.receiptNo} ({row.businessDate})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {integrity.data.voided.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold">Voided receipts</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {integrity.data.voided.map((row) => (
                    <li key={row.receiptNo}>
                      <span className="font-mono">{row.receiptNo}</span> ·{' '}
                      {formatCentavos(row.totalCentavos)} · {row.voidReason ?? 'No reason'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="border-line bg-surface rounded-lg border">
        <div className="border-line border-b p-4">
          <h2 className="font-display text-xl font-semibold">Audit log</h2>
          <p className="text-steel text-sm">The latest 100 actions. This log is append-only.</p>
        </div>

        {audit.isPending ? (
          <div className="p-4">
            <AuditSkeleton />
          </div>
        ) : audit.isError ? (
          <div role="alert" className="p-4">
            <p className="text-danger font-medium">Could not load the audit log.</p>
            <p className="text-ink-soft mt-1 text-sm">{audit.error.message}</p>
          </div>
        ) : audit.data.length === 0 ? (
          <p className="text-steel p-4 text-sm">No audit events yet.</p>
        ) : (
          <ul className="divide-line divide-y">
            {audit.data.map((event) => (
              <li key={event.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold">{event.action}</p>
                  <p className="text-steel text-xs">{formatManilaDateTime(event.createdAt)}</p>
                </div>
                <p className="text-steel mt-1 text-xs">
                  {event.actorName ?? 'System'} · {event.entityType}
                  {event.entityId ? ` · ${event.entityId}` : ''}
                </p>
                {event.before || event.after ? (
                  <details className="mt-2">
                    <summary className="text-blueprint cursor-pointer text-xs underline underline-offset-4">
                      Before and after
                    </summary>
                    <pre className="bg-paper text-ink-soft mt-2 max-h-48 overflow-auto rounded-md p-2 text-xs">
                      {JSON.stringify({ before: event.before, after: event.after }, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="ghost" size="touch" render={<Link to="/owner" />}>
        Back to the owner dashboard
      </Button>
    </div>
  );
}
