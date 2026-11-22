import { ChevronRight, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatManilaDate, manilaDateKey } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { useDailyReport, useLaborReport, useOrders, usePaymentsReport } from './hooks/use-sales';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-line bg-surface rounded-lg border p-3">
      <p className="text-steel text-xs">{label}</p>
      <p className="font-display mt-1 text-xl font-bold tabular-nums sm:text-2xl">
        {formatCentavos(value)}
      </p>
    </div>
  );
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const today = manilaDateKey();
  const requested = params.get('date') ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;

  const orders = useOrders(date);
  const daily = useDailyReport(date, date);
  const labor = useLaborReport(date, date);
  const payments = usePaymentsReport(date, date);

  const report = daily.data?.[0];
  const cash = useMemo(
    () => payments.data?.find((row) => row.method === 'CASH')?.netCentavos ?? 0,
    [payments.data],
  );
  const gcash = useMemo(
    () => payments.data?.find((row) => row.method === 'GCASH')?.netCentavos ?? 0,
    [payments.data],
  );

  const changeDate = (next: string) => {
    const value = next || today;
    setParams(value === today ? {} : { date: value }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description={formatManilaDate(`${date}T12:00:00+08:00`)}
        actions={
          <>
            <Button
              variant="outline"
              size="touch"
              nativeButton={false}
              render={<Link to="/reports" />}
            >
              Reports
            </Button>
            <Button size="touch" nativeButton={false} render={<Link to="/orders/new" />}>
              <Plus aria-hidden="true" />
              New order
            </Button>
          </>
        }
      />

      <div className="max-w-xs">
        <Label htmlFor="orders-date">Date</Label>
        <Input
          id="orders-date"
          type="date"
          value={date}
          max={today}
          onChange={(event) => changeDate(event.target.value)}
        />
      </div>

      {orders.isPending ? (
        <output className="block space-y-2" aria-label="Loading orders">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="block h-20 w-full" />
          ))}
        </output>
      ) : orders.isError ? (
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load orders.</p>
          <p className="text-ink-soft mt-1 text-sm">{orders.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void orders.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat label="Parts sales" value={report?.partsTotalCentavos ?? 0} />
            <Stat label="Labor" value={report?.laborTotalCentavos ?? 0} />
            <Stat label="Cash net" value={cash} />
            <Stat label="GCash net" value={gcash} />
          </div>

          <div className="border-line bg-surface rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-steel text-xs">Labor per person</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {(labor.data ?? []).length === 0 ? (
                    <p className="text-steel text-sm">No labor recorded.</p>
                  ) : (
                    labor.data?.map((row) => (
                      <p key={row.userId} className="text-sm">
                        <span className="font-medium">{row.displayName}</span>{' '}
                        <span className="font-mono tabular-nums">
                          {formatCentavos(row.laborPayoutCentavos)}
                        </span>
                      </p>
                    ))
                  )}
                </div>
                <p className="text-steel mt-1 text-xs">
                  Payout includes extras. The Labor card above is base labor only.
                </p>
              </div>
              <p className="text-steel text-sm">
                {report?.orderCount ?? 0} order{(report?.orderCount ?? 0) === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Orders on this date</h2>
            <p className="text-steel text-xs">Tap an order to edit or share its receipt.</p>
          </div>

          {(orders.data ?? []).length === 0 ? (
            <EmptyState
              title="No orders on this date"
              description="Start a new order for the first customer."
              action={
                <Button size="touch" nativeButton={false} render={<Link to="/orders/new" />}>
                  <Plus aria-hidden="true" />
                  New order
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {orders.data?.map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/orders/${order.id}`}
                    className="border-line bg-surface hover:bg-soft block rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-semibold">{order.orderNo}</p>
                          <span className="border-line text-steel rounded-sm border px-1.5 py-0.5 text-xs">
                            {order.status === 'OPEN' ? 'Open' : 'Exported'}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-medium">
                          {order.customerName || 'Walk-in'}
                          {order.bikeModel ? ` · ${order.bikeModel}` : ''}
                        </p>
                        <p className="text-steel mt-0.5 text-xs">
                          {order.mainUserName ?? 'Staff'}
                          {order.helperUserName ? ` + ${order.helperUserName}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="font-display text-xl font-bold tabular-nums">
                          {formatCentavos(order.totalCentavos)}
                        </p>
                        <ChevronRight className="text-steel size-5" aria-hidden="true" />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
