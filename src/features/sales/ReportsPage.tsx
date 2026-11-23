import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { formatManilaDate, manilaDateKey, MANILA_TIME_ZONE } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { useDailyReport, useLaborReport, usePaymentsReport } from './hooks/use-sales';
import { buildMonthlyRows, monthRange, sumLaborByPerson, sumMonthlyRows } from './report-math';
import { staffLabel } from './staff-label';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-line bg-surface rounded-lg border p-3">
      <p className="text-steel text-xs">{label}</p>
      <p className="font-display mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {hint ? <p className="text-steel mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T12:00:00+08:00`);

  if (Number.isNaN(date.getTime())) return month;

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function ReportsPage() {
  const auth = useAuth();
  const currentUserId = auth.status === 'signed-in' ? auth.profile.id : null;
  const [month, setMonth] = useState(manilaDateKey().slice(0, 7));
  const [showLabor, setShowLabor] = useState(false);

  const range = monthRange(month) ?? monthRange(manilaDateKey().slice(0, 7));
  const from = range?.from ?? `${month}-01`;
  const to = range?.to ?? `${month}-31`;

  const daily = useDailyReport(from, to);
  const labor = useLaborReport(from, to);
  const payments = usePaymentsReport(from, to);

  const rows = useMemo(
    () => buildMonthlyRows(daily.data ?? [], payments.data ?? []),
    [daily.data, payments.data],
  );
  const totals = useMemo(() => sumMonthlyRows(rows), [rows]);
  const people = useMemo(() => sumLaborByPerson(labor.data ?? []), [labor.data]);

  const pending = daily.isPending || labor.isPending || payments.isPending;
  const failed = daily.isError || labor.isError || payments.isError;
  const error = daily.error ?? labor.error ?? payments.error;

  const retry = () => {
    void daily.refetch();
    void labor.refetch();
    void payments.refetch();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Paid sales, labor per person, cash, and GCash."
        actions={
          <Button
            variant="outline"
            size="touch"
            nativeButton={false}
            render={<Link to="/reports/gcash" />}
          >
            GCash
            <ChevronRight aria-hidden="true" />
          </Button>
        }
      />

      <div className="max-w-xs">
        <Label htmlFor="report-month">Month</Label>
        <Input
          id="report-month"
          type="month"
          value={month}
          max={manilaDateKey().slice(0, 7)}
          onChange={(event) => setMonth(event.target.value || manilaDateKey().slice(0, 7))}
        />
      </div>

      {pending ? (
        <output className="block space-y-2" aria-label="Loading reports">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <Skeleton key={card} className="block h-20 w-full" />
            ))}
          </div>
          <Skeleton className="block h-64 w-full" />
        </output>
      ) : failed ? (
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load the report.</p>
          <p className="text-ink-soft mt-1 text-sm">{error?.message}</p>
          <Button variant="outline" size="touch" className="mt-3" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No paid sales in ${monthLabel(month)}`}
          description="Paid orders appear here automatically on their payment date."
          action={
            <Button size="touch" nativeButton={false} render={<Link to="/orders/new" />}>
              New order
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="month-summary">
            <h2 id="month-summary" className="sr-only">
              {monthLabel(month)} summary
            </h2>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <Stat
                label="Paid sales"
                value={formatCentavos(totals.totalCentavos)}
                hint={`${totals.orderCount} paid order${totals.orderCount === 1 ? '' : 's'}`}
              />
              <Stat label="Parts" value={formatCentavos(totals.partsCentavos)} />
              <Stat label="Labor" value={formatCentavos(totals.laborCentavos)} />
              <Stat label="Cash net" value={formatCentavos(totals.cashCentavos)} />
              <Stat label="GCash net" value={formatCentavos(totals.gcashCentavos)} />
              <Stat
                label="Extras"
                value={formatCentavos(totals.extrasCentavos)}
                hint="Tips kept by staff"
              />
            </div>
          </section>

          <section className="space-y-2" aria-labelledby="daily-report">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="daily-report" className="font-display text-xl font-semibold">
                  Paid sales by day
                </h2>
                <p className="text-steel text-xs">
                  Tap a payment date to open that day’s paid sales.
                </p>
              </div>
              <Button
                variant={showLabor ? 'default' : 'outline'}
                size="touch"
                aria-pressed={showLabor}
                onClick={() => setShowLabor((value) => !value)}
              >
                Full breakdown
              </Button>
            </div>

            <div className="border-line bg-surface overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paid on</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Parts</TableHead>
                    <TableHead className="text-right">Labor</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">GCash</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.paidOn}>
                      <TableCell>
                        <Link
                          to={`/orders?date=${row.paidOn}`}
                          className="text-safety-dark font-medium underline-offset-4 hover:underline"
                        >
                          {formatManilaDate(`${row.paidOn}T12:00:00+08:00`)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCentavos(row.partsCentavos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCentavos(row.laborCentavos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCentavos(row.cashCentavos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCentavos(row.gcashCentavos)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCentavos(row.totalCentavos)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Month total</TableCell>
                    <TableCell className="text-right tabular-nums">{totals.orderCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentavos(totals.partsCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentavos(totals.laborCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentavos(totals.cashCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentavos(totals.gcashCentavos)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCentavos(totals.totalCentavos)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <p className="text-steel text-xs">
              Sales is parts + labor. Cash and GCash are net of change and include extras.
            </p>
          </section>

          {showLabor ? (
            <section className="space-y-2" aria-labelledby="labor-report">
              <div>
                <h2 id="labor-report" className="font-display text-xl font-semibold">
                  Labor by person
                </h2>
                <p className="text-steel text-xs">
                  Base labor plus extras for {monthLabel(month)}.
                </p>
              </div>

              {people.length === 0 ? (
                <p className="border-line bg-surface text-steel rounded-lg border p-4 text-sm">
                  No labor recorded this month.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {people.map((person) => (
                    <div
                      key={person.userId}
                      className="border-line bg-surface rounded-lg border p-4"
                    >
                      <p className="font-display text-lg font-semibold">
                        {staffLabel(
                          { id: person.userId, displayName: person.displayName },
                          currentUserId,
                        )}
                      </p>
                      <dl className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-steel">Base labor</dt>
                          <dd className="tabular-nums">
                            {formatCentavos(person.baseLaborCentavos)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-steel">Extras</dt>
                          <dd className="tabular-nums">{formatCentavos(person.extrasCentavos)}</dd>
                        </div>
                        <div className="border-line flex justify-between border-t pt-1 font-semibold">
                          <dt>Payout</dt>
                          <dd className="tabular-nums">{formatCentavos(person.payoutCentavos)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
