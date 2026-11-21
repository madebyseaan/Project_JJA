import { Download, ReceiptText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatManilaDate, formatManilaDateTime, manilaDateKey } from '@/lib/dates';
import { toCsv } from '@/lib/csv';
import { formatCentavos } from '@/lib/money';

import { useSales } from './hooks/use-owner';
import type { SalesReceipt } from './types';

type StatusFilter = 'ALL' | 'ISSUED' | 'VOID';

function paymentMethods(receipt: SalesReceipt): string {
  const methods = Array.from(new Set(receipt.snapshot.payments.map((payment) => payment.method)));
  return methods.join(' + ');
}

function exportCsv(date: string, rows: SalesReceipt[]) {
  const csv = toCsv(
    rows.map((receipt) => ({
      receiptNo: receipt.receiptNo,
      issuedAt: formatManilaDateTime(receipt.issuedAt),
      ticketNo: receipt.snapshot.ticket.no,
      customer: receipt.snapshot.ticket.customer_name,
      bike: receipt.snapshot.ticket.bike_model,
      parts: receipt.snapshot.totals.parts_centavos,
      labor: receipt.snapshot.totals.labor_centavos,
      total: receipt.totalCentavos,
      status: receipt.status,
      paymentMethods: paymentMethods(receipt),
    })),
    [
      { key: 'receiptNo', label: 'Receipt' },
      { key: 'issuedAt', label: 'Issued at' },
      { key: 'ticketNo', label: 'Ticket' },
      { key: 'customer', label: 'Customer' },
      { key: 'bike', label: 'Bike' },
      { key: 'parts', label: 'Parts (centavos)' },
      { key: 'labor', label: 'Labor (centavos)' },
      { key: 'total', label: 'Total (centavos)' },
      { key: 'status', label: 'Status' },
      { key: 'paymentMethods', label: 'Payment methods' },
    ],
  );

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `jja-sales-${date}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast.success('CSV exported.');
}

export function OwnerSalesPage() {
  const [date, setDate] = useState(manilaDateKey());
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const sales = useSales(date);

  const filtered = useMemo(
    () => (sales.data ?? []).filter((receipt) => status === 'ALL' || receipt.status === status),
    [sales.data, status],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Receipts issued on the selected business date."
        actions={
          <Button
            variant="outline"
            size="touch"
            disabled={filtered.length === 0}
            onClick={() => exportCsv(date, filtered)}
          >
            <Download aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs">
          <Label htmlFor="sales-date">Business date</Label>
          <Input
            id="sales-date"
            type="date"
            value={date}
            max={manilaDateKey()}
            onChange={(event) => setDate(event.target.value || manilaDateKey())}
          />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'ISSUED', 'VOID'] as StatusFilter[]).map((option) => (
            <Button
              key={option}
              variant={status === option ? 'default' : 'outline'}
              size="touch"
              aria-pressed={status === option}
              onClick={() => setStatus(option)}
            >
              {option === 'ALL' ? 'All' : option === 'ISSUED' ? 'Issued' : 'Void'}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-steel text-sm">{formatManilaDate(`${date}T12:00:00+08:00`)}</p>

      {sales.isPending ? (
        <output className="block space-y-2" aria-label="Loading sales">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="block h-16 w-full" />
          ))}
        </output>
      ) : sales.isError ? (
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load sales.</p>
          <p className="text-ink-soft mt-1 text-sm">{sales.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void sales.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No receipts on this date"
          description="Completed sales appear here with their receipt number and total."
          action={
            <Button variant="outline" size="touch" render={<Link to="/bay" />}>
              Open the bay
            </Button>
          }
        />
      ) : (
        <>
          <div className="border-line bg-surface hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead className="hidden lg:table-cell">Customer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <Link
                        to={`/r/${receipt.publicToken}`}
                        className="text-blueprint font-mono text-sm font-semibold underline underline-offset-4"
                      >
                        {receipt.receiptNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-ink-soft text-sm">
                      {formatManilaDateTime(receipt.issuedAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {receipt.snapshot.ticket.no}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {receipt.snapshot.ticket.customer_name || 'Walk-in'}
                    </TableCell>
                    <TableCell className="text-sm">{paymentMethods(receipt)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {formatCentavos(receipt.totalCentavos)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          receipt.status === 'VOID'
                            ? 'border-danger/40 bg-danger/10 text-danger inline-flex rounded-sm border px-1.5 py-0.5 text-xs font-medium'
                            : 'border-ok/40 bg-ok/10 text-ok inline-flex rounded-sm border px-1.5 py-0.5 text-xs font-medium'
                        }
                      >
                        {receipt.status === 'VOID' ? 'Void' : 'Issued'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-2 md:hidden">
            {filtered.map((receipt) => (
              <li key={receipt.id} className="border-line bg-surface rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/r/${receipt.publicToken}`}
                      className="text-blueprint font-mono text-sm font-semibold underline underline-offset-4"
                    >
                      {receipt.receiptNo}
                    </Link>
                    <p className="text-steel mt-1 text-xs">
                      {formatManilaDateTime(receipt.issuedAt)}
                    </p>
                  </div>
                  <p className="font-display text-xl font-bold tabular-nums">
                    {formatCentavos(receipt.totalCentavos)}
                  </p>
                </div>
                <div className="text-ink-soft mt-2 flex items-center justify-between text-sm">
                  <span>{receipt.snapshot.ticket.customer_name || 'Walk-in'}</span>
                  <span className={receipt.status === 'VOID' ? 'text-danger' : 'text-ok'}>
                    {receipt.status === 'VOID' ? 'Void' : 'Issued'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Button variant="ghost" size="touch" render={<Link to="/owner" />}>
        <ReceiptText aria-hidden="true" />
        Back to the owner dashboard
      </Button>
    </div>
  );
}
