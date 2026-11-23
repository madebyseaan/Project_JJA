import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/use-auth';
import { formatManilaDate, manilaDateKey } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { DeleteJobDialog } from './components/DeleteJobDialog';
import {
  useDailyReport,
  useDeleteOrder,
  useLaborReport,
  useOpenOrders,
  usePaidOrders,
  usePaymentsReport,
} from './hooks/use-sales';
import { staffLabel } from './staff-label';
import type { SalesOrder } from './types';

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

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function Workers({ order, currentUserId }: { order: SalesOrder; currentUserId: string | null }) {
  const mainName = order.mainUserName ?? 'Staff';
  const main = staffLabel({ id: order.mainUserId, displayName: mainName }, currentUserId);

  if (!order.helperUserId) {
    return <>{main}</>;
  }

  const helperName = order.helperUserName ?? 'Staff';
  const helper = staffLabel({ id: order.helperUserId, displayName: helperName }, currentUserId);

  return (
    <>
      {main} + {helper}
    </>
  );
}

function OpenJobRow({
  order,
  currentUserId,
  onDelete,
}: {
  order: SalesOrder;
  currentUserId: string | null;
  onDelete: (order: SalesOrder) => void;
}) {
  return (
    <li className="border-line bg-surface rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link to={`/orders/${order.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold">{order.orderNo}</p>
            <span className="border-warn/40 bg-warn/10 text-warn rounded-sm border px-1.5 py-0.5 text-xs font-semibold">
              Unpaid
            </span>
          </div>
          <p className="mt-1 truncate font-medium">
            {order.customerName || 'Walk-in'}
            {order.bikeModel ? ` · ${order.bikeModel}` : ''}
          </p>
          <p className="text-steel mt-0.5 text-xs">
            Job date {formatManilaDate(`${order.businessDate}T12:00:00+08:00`)} ·{' '}
            <Workers order={order} currentUserId={currentUserId} />
          </p>
        </Link>
        <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto">
          <p className="font-display text-xl font-bold tabular-nums">
            {formatCentavos(order.totalCentavos)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="touch"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/orders/${order.id}?tab=payment`} />}
            >
              Take payment
            </Button>
            <Button
              variant="ghost"
              size="touch"
              className="text-danger"
              aria-label={`Delete job ${order.orderNo}`}
              onClick={() => onDelete(order)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function PaidOrderRow({
  order,
  currentUserId,
}: {
  order: SalesOrder;
  currentUserId: string | null;
}) {
  return (
    <li>
      <Link
        to={`/orders/${order.id}`}
        className="border-line bg-surface hover:bg-soft block rounded-lg border p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-semibold">{order.orderNo}</p>
              <span className="border-ok/40 bg-ok/10 text-ok rounded-sm border px-1.5 py-0.5 text-xs font-semibold">
                {order.status === 'EXPORTED' ? 'Exported' : 'Paid'}
              </span>
            </div>
            <p className="mt-1 truncate font-medium">
              {order.customerName || 'Walk-in'}
              {order.bikeModel ? ` · ${order.bikeModel}` : ''}
            </p>
            <p className="text-steel mt-0.5 text-xs">
              <Workers order={order} currentUserId={currentUserId} />
              {order.paidOn ? ` · paid ${formatManilaDate(`${order.paidOn}T12:00:00+08:00`)}` : ''}
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
  );
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const auth = useAuth();
  const currentUserId = auth.status === 'signed-in' ? auth.profile.id : null;
  const today = manilaDateKey();
  const requested = params.get('date') ?? '';
  const date = isValidDate(requested) && requested <= today ? requested : today;

  const openOrders = useOpenOrders();
  const paidOrders = usePaidOrders(date);
  const daily = useDailyReport(date, date);
  const labor = useLaborReport(date, date);
  const payments = usePaymentsReport(date, date);
  const deleteOrder = useDeleteOrder();
  const [orderToDelete, setOrderToDelete] = useState<SalesOrder | null>(null);

  const report = daily.data?.[0];
  const cash = useMemo(
    () => payments.data?.find((row) => row.method === 'CASH')?.netCentavos ?? 0,
    [payments.data],
  );
  const gcash = useMemo(
    () => payments.data?.find((row) => row.method === 'GCASH')?.netCentavos ?? 0,
    [payments.data],
  );
  const openTotal = useMemo(
    () => (openOrders.data ?? []).reduce((total, order) => total + order.totalCentavos, 0),
    [openOrders.data],
  );

  const changeDate = (next: string) => {
    const value = next || today;
    setParams(value === today ? {} : { date: value }, { replace: true });
  };

  const paidPending =
    paidOrders.isPending || daily.isPending || labor.isPending || payments.isPending;
  const paidFailed = paidOrders.isError || daily.isError || labor.isError || payments.isError;
  const paidError = paidOrders.error ?? daily.error ?? labor.error ?? payments.error;

  const retryPaid = () => {
    void paidOrders.refetch();
    void daily.refetch();
    void labor.refetch();
    void payments.refetch();
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;

    try {
      await deleteOrder.mutateAsync(orderToDelete.id);
      toast.success('Open job deleted.');
      setOrderToDelete(null);
    } catch {
      // The dialog renders the mutation error.
    }
  };

  const requestDelete = (order: SalesOrder) => {
    deleteOrder.reset();
    setOrderToDelete(order);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description="Jobs waiting for payment, and sales already paid."
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

      <section className="space-y-2" aria-labelledby="open-jobs">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="open-jobs" className="font-display text-xl font-semibold">
              Open jobs
            </h2>
            <p className="text-steel text-xs">Jobs saved, not paid yet. Any date.</p>
          </div>
          <p className="text-sm">
            <span className="text-steel">
              {openOrders.data?.length ?? 0} job{(openOrders.data?.length ?? 0) === 1 ? '' : 's'}
              {' · '}
              Unpaid total
            </span>{' '}
            <span className="font-display text-lg font-bold tabular-nums">
              {formatCentavos(openTotal)}
            </span>
          </p>
        </div>

        {openOrders.isPending ? (
          <output className="block space-y-2" aria-label="Loading open jobs">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="block h-24 w-full" />
            ))}
          </output>
        ) : openOrders.isError ? (
          <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
            <p className="text-danger font-medium">Could not load open jobs.</p>
            <p className="text-ink-soft mt-1 text-sm">{openOrders.error.message}</p>
            <Button
              variant="outline"
              size="touch"
              className="mt-3"
              onClick={() => void openOrders.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (openOrders.data ?? []).length === 0 ? (
          <div className="border-line bg-surface rounded-lg border p-4">
            <p className="font-medium">No jobs waiting for payment.</p>
            <p className="text-steel mt-1 text-sm">Saved jobs stay here until you take payment.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {openOrders.data?.map((order) => (
              <OpenJobRow
                key={order.id}
                order={order}
                currentUserId={currentUserId}
                onDelete={requestDelete}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="paid-sales">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="paid-sales" className="font-display text-xl font-semibold">
              Paid sales
            </h2>
            <p className="text-steel text-xs">{formatManilaDate(`${date}T12:00:00+08:00`)}</p>
          </div>
          <div className="w-full max-w-xs">
            <Label htmlFor="orders-date">Sales paid on</Label>
            <Input
              id="orders-date"
              type="date"
              value={date}
              max={today}
              onChange={(event) => changeDate(event.target.value)}
            />
          </div>
        </div>

        {paidPending ? (
          <output className="block space-y-2" aria-label="Loading paid sales">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((card) => (
                <Skeleton key={card} className="block h-20 w-full" />
              ))}
            </div>
            <Skeleton className="block h-24 w-full" />
          </output>
        ) : paidFailed ? (
          <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
            <p className="text-danger font-medium">Could not load paid sales.</p>
            <p className="text-ink-soft mt-1 text-sm">{paidError?.message}</p>
            <Button variant="outline" size="touch" className="mt-3" onClick={retryPaid}>
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
                          <span className="font-medium">
                            {staffLabel(
                              { id: row.userId, displayName: row.displayName },
                              currentUserId,
                            )}
                          </span>{' '}
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

            {(paidOrders.data ?? []).length === 0 ? (
              <EmptyState
                title="No paid sales on this date"
                description="Take payment on an open job, then it appears here."
                action={
                  <Button size="touch" nativeButton={false} render={<Link to="/orders/new" />}>
                    <Plus aria-hidden="true" />
                    New order
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {paidOrders.data?.map((order) => (
                  <PaidOrderRow key={order.id} order={order} currentUserId={currentUserId} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <DeleteJobDialog
        open={orderToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteOrder.isPending) {
            setOrderToDelete(null);
            deleteOrder.reset();
          }
        }}
        orderNo={orderToDelete?.orderNo ?? ''}
        pending={deleteOrder.isPending}
        error={deleteOrder.error?.message ?? null}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
