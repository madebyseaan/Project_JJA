import { ClipboardCheck, History, ReceiptText, Settings, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatManilaDate, formatManilaDateTime, manilaDateKey } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { CloseDayDialog } from './components/CloseDayDialog';
import { useDailySummary } from './hooks/use-owner';

function DashboardSkeleton() {
  return (
    <output className="block space-y-4" aria-label="Loading today's summary">
      <Skeleton className="block h-32 w-full" />
      <Skeleton className="block h-48 w-full" />
      <Skeleton className="block h-40 w-full" />
    </output>
  );
}

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-ink-soft text-sm">{label}</dt>
      <dd className="font-mono text-base font-semibold tabular-nums">{formatCentavos(value)}</dd>
    </div>
  );
}

export function OwnerDashboardPage() {
  const [date, setDate] = useState(manilaDateKey());
  const [closeOpen, setCloseOpen] = useState(false);
  const summary = useDailySummary(date);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner"
        description="Today's sales, cash, and low stock."
        actions={
          <>
            <Button
              variant="outline"
              size="touch"
              nativeButton={false}
              render={<Link to="/sales" />}
            >
              <ReceiptText aria-hidden="true" />
              Sales
            </Button>
            <Button
              variant="outline"
              size="touch"
              nativeButton={false}
              render={<Link to="/owner/audit" />}
            >
              <History aria-hidden="true" />
              Audit
            </Button>
            <Button
              variant="outline"
              size="touch"
              nativeButton={false}
              render={<Link to="/owner/settings" />}
            >
              <Settings aria-hidden="true" />
              Settings
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs">
          <Label htmlFor="summary-date">Business date</Label>
          <Input
            id="summary-date"
            type="date"
            value={date}
            max={manilaDateKey()}
            onChange={(event) => setDate(event.target.value || manilaDateKey())}
          />
        </div>
        {summary.data ? (
          <p className="text-steel text-sm">{formatManilaDate(`${date}T12:00:00+08:00`)}</p>
        ) : null}
      </div>

      {summary.isPending ? (
        <DashboardSkeleton />
      ) : summary.isError ? (
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load the owner summary.</p>
          <p className="text-ink-soft mt-1 text-sm">{summary.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void summary.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <section className="border-line bg-surface rounded-lg border p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-steel text-xs font-semibold tracking-wide uppercase">
                  Sales issued
                </p>
                <p className="font-display mt-1 text-4xl font-bold tabular-nums">
                  {formatCentavos(summary.data.sales.totalCentavos)}
                </p>
                <p className="text-steel mt-1 text-sm">
                  {summary.data.sales.receiptCount} receipt
                  {summary.data.sales.receiptCount === 1 ? '' : 's'}
                </p>
              </div>
              <TrendingUp className="text-ok size-6" aria-hidden="true" />
            </div>

            <dl className="border-line mt-4 grid gap-x-8 border-t pt-3 sm:grid-cols-2">
              <MoneyRow label="Parts" value={summary.data.sales.partsCentavos} />
              <MoneyRow label="Labor" value={summary.data.sales.laborCentavos} />
            </dl>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="border-line bg-surface rounded-lg border p-4 sm:p-5">
              <h2 className="font-display text-xl font-semibold">Payments</h2>
              <dl className="mt-2 divide-y divide-dashed">
                <MoneyRow label="Cash" value={summary.data.payments.cashCentavos} />
                <MoneyRow label="GCash" value={summary.data.payments.gcashCentavos} />
                <MoneyRow label="Maya" value={summary.data.payments.mayaCentavos} />
                <MoneyRow label="Other" value={summary.data.payments.otherCentavos} />
                <MoneyRow label="Total received" value={summary.data.payments.totalCentavos} />
              </dl>
            </section>

            <section className="border-line bg-surface rounded-lg border p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-semibold">Day close</h2>
                  <p className="text-steel text-sm">
                    Expected cash {formatCentavos(summary.data.expectedCashCentavos)}
                  </p>
                </div>
                <ClipboardCheck className="text-steel size-5" aria-hidden="true" />
              </div>

              {summary.data.dayClose ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-steel">Counted</span>
                    <span className="font-mono tabular-nums">
                      {formatCentavos(summary.data.dayClose.countedCashCentavos)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-steel">Variance</span>
                    <span
                      className={
                        summary.data.dayClose.varianceCentavos === 0
                          ? 'text-ok font-mono font-semibold tabular-nums'
                          : 'text-danger font-mono font-semibold tabular-nums'
                      }
                    >
                      {formatCentavos(summary.data.dayClose.varianceCentavos)}
                    </span>
                  </div>
                  {summary.data.dayClose.notes ? (
                    <p className="text-ink-soft">{summary.data.dayClose.notes}</p>
                  ) : null}
                  <p className="text-steel text-xs">
                    Closed {formatManilaDateTime(summary.data.dayClose.closedAt)}
                  </p>
                </div>
              ) : (
                <p className="text-steel mt-3 text-sm">The day is not closed yet.</p>
              )}

              <Button size="touch" className="mt-4 w-full" onClick={() => setCloseOpen(true)}>
                {summary.data.dayClose ? 'Correct day close' : 'Close the day'}
              </Button>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="border-line bg-surface rounded-lg border">
              <div className="border-line border-b p-4">
                <h2 className="font-display text-xl font-semibold">Low / out of stock</h2>
                <p className="text-steel text-sm">
                  {summary.data.lowStock.length} part
                  {summary.data.lowStock.length === 1 ? '' : 's'} at or below the threshold
                </p>
              </div>
              {summary.data.lowStock.length === 0 ? (
                <p className="text-steel p-4 text-sm">Nothing needs restocking.</p>
              ) : (
                <ul className="divide-line divide-y">
                  {summary.data.lowStock.map((part) => (
                    <li key={part.id} className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-medium">{part.name}</p>
                        <p className="text-steel text-xs">{part.sku ?? 'No SKU'}</p>
                      </div>
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {part.availableQty} / {part.lowStockThreshold}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border-line bg-surface rounded-lg border">
              <div className="border-line border-b p-4">
                <h2 className="font-display text-xl font-semibold">Voids today</h2>
                <p className="text-steel text-sm">
                  {summary.data.voids.length} voided sale
                  {summary.data.voids.length === 1 ? '' : 's'}
                </p>
              </div>
              {summary.data.voids.length === 0 ? (
                <p className="text-steel p-4 text-sm">No voided sales on this date.</p>
              ) : (
                <ul className="divide-line divide-y">
                  {summary.data.voids.map((voidRow) => (
                    <li key={voidRow.receiptNo} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-sm font-semibold">{voidRow.receiptNo}</p>
                        <p className="font-mono text-sm tabular-nums">
                          {formatCentavos(voidRow.totalCentavos)}
                        </p>
                      </div>
                      <p className="text-steel mt-1 text-xs">
                        {voidRow.voidReason ?? 'No reason recorded'} ·{' '}
                        {voidRow.voidedAt ? formatManilaDateTime(voidRow.voidedAt) : '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {summary.data.sales.receiptCount === 0 ? (
            <EmptyState
              title="No sales on this date"
              description="Completed tickets will appear here with their receipts."
              action={
                <Button
                  variant="outline"
                  size="touch"
                  nativeButton={false}
                  render={<Link to="/bay" />}
                >
                  Open the bay
                </Button>
              }
            />
          ) : null}

          {closeOpen ? (
            <CloseDayDialog
              key={`${date}-${summary.data.dayClose?.closedAt ?? 'new'}`}
              summary={summary.data}
              open={closeOpen}
              onOpenChange={setCloseOpen}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
