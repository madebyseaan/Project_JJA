import { CheckCircle2, Copy, Printer, ShieldAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatManilaDateTime } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { getPublicReceipt } from './api';
import type { PublicReceipt } from './types';

function ReceiptSkeleton() {
  return (
    <output className="mx-auto block max-w-2xl space-y-4" aria-label="Loading receipt">
      <Skeleton className="block h-12 w-2/3" />
      <Skeleton className="block h-4 w-1/2" />
      <Skeleton className="block h-64 w-full" />
    </output>
  );
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Receipt link copied.');
  } catch {
    toast.error('Could not copy the link. Select the address bar and copy it manually.');
  }
}

function ReceiptSheet({ receipt }: { receipt: PublicReceipt }) {
  const { snapshot } = receipt;
  const isVoid = receipt.status === 'VOID';

  return (
    <article className="mx-auto max-w-2xl print:max-w-none">
      <div className="border-line bg-surface rounded-lg border p-5 sm:p-8 print:border-0 print:shadow-none">
        <header className="border-line border-b pb-5 text-center">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{snapshot.shop.name}</h1>
          {snapshot.shop.address ? (
            <p className="text-ink-soft mt-1 text-sm">{snapshot.shop.address}</p>
          ) : null}
          {snapshot.shop.contact ? (
            <p className="text-steel mt-0.5 text-sm">{snapshot.shop.contact}</p>
          ) : null}
          <p className="text-steel mt-3 text-xs font-semibold tracking-wide uppercase">
            Sales receipt
          </p>
        </header>

        {isVoid ? (
          <div className="border-danger bg-danger/10 text-danger mt-5 rounded-md border p-4">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-5" aria-hidden="true" />
              This receipt is void
            </p>
            {receipt.voidReason ? <p className="mt-1 text-sm">{receipt.voidReason}</p> : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-steel text-xs">Receipt number</p>
            <p className="font-mono text-lg font-semibold">{receipt.receiptNo}</p>
            <p className="text-steel mt-1 text-xs">{formatManilaDateTime(receipt.issuedAt)}</p>
          </div>
          <div className="text-right">
            <p className="text-steel text-xs">Ticket</p>
            <p className="font-mono text-sm">{snapshot.ticket.no}</p>
          </div>
        </div>

        {snapshot.ticket.customer_name || snapshot.ticket.bike_model ? (
          <p className="text-ink-soft mt-3 text-sm">
            {snapshot.ticket.customer_name || 'Walk-in'}
            {snapshot.ticket.bike_model ? ` · ${snapshot.ticket.bike_model}` : ''}
          </p>
        ) : null}

        <div className="border-line mt-5 border-t border-dashed pt-5">
          <h2 className="text-steel text-xs font-semibold tracking-wide uppercase">Items</h2>
          <ul className="mt-2 divide-y divide-dashed">
            {snapshot.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-steel text-xs">
                    {item.qty} × {formatCentavos(item.unit_price_centavos)}
                  </p>
                </div>
                <p className="font-mono tabular-nums">{formatCentavos(item.line_total_centavos)}</p>
              </li>
            ))}
          </ul>

          {snapshot.labor.length > 0 ? (
            <>
              <h2 className="text-steel mt-4 text-xs font-semibold tracking-wide uppercase">
                Labor
              </h2>
              <ul className="mt-2 divide-y divide-dashed">
                {snapshot.labor.map((line, index) => (
                  <li
                    key={`${line.description}-${index}`}
                    className="flex justify-between gap-3 py-2 text-sm"
                  >
                    <p>{line.description}</p>
                    <p className="font-mono tabular-nums">{formatCentavos(line.amount_centavos)}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <dl className="border-line mt-5 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-steel">Parts</dt>
            <dd className="font-mono tabular-nums">
              {formatCentavos(snapshot.totals.parts_centavos)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-steel">Labor</dt>
            <dd className="font-mono tabular-nums">
              {formatCentavos(snapshot.totals.labor_centavos)}
            </dd>
          </div>
          <div className="border-line flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="font-mono tabular-nums">
              {formatCentavos(snapshot.totals.total_centavos)}
            </dd>
          </div>
        </dl>

        <div className="border-line mt-4 border-t pt-4">
          <h2 className="text-steel text-xs font-semibold tracking-wide uppercase">Payments</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {snapshot.payments.map((payment, index) => (
              <li key={`${payment.method}-${index}`} className="flex justify-between gap-3">
                <span>
                  {payment.method} · {payment.received_by}
                </span>
                <span className="font-mono tabular-nums">
                  {formatCentavos(payment.amount_centavos)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-line mt-6 flex flex-col items-center gap-3 border-t border-dashed pt-5 sm:flex-row sm:justify-between">
          <div>
            <p className="text-steel text-xs">Verification code</p>
            <p className="font-mono text-lg font-semibold tracking-wide">
              {receipt.verificationCode}
            </p>
            <p className="text-steel mt-1 max-w-xs text-xs">
              Check this code on the shop&apos;s verification page. An edited screenshot will not
              match the live record.
            </p>
          </div>
          <QRCodeSVG
            value={window.location.href}
            size={112}
            bgColor="#ffffff"
            fgColor="#12181a"
            aria-label="QR code for this receipt"
          />
        </div>

        {snapshot.shop.footer ? (
          <p className="border-line text-steel mt-5 border-t pt-4 text-center text-xs">
            {snapshot.shop.footer}
          </p>
        ) : null}

        <p className="text-steel mt-4 text-center text-xs">
          This is a sales receipt, not a BIR Official Receipt.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Button size="touch" onClick={() => void copyLink()}>
          <Copy aria-hidden="true" />
          Copy link
        </Button>
        <Button variant="outline" size="touch" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Save as PDF
        </Button>
        <Button variant="outline" size="touch" nativeButton={false} render={<Link to="/verify" />}>
          Verify another receipt
        </Button>
      </div>
    </article>
  );
}

export function ReceiptPage() {
  const { token } = useParams();
  const receipt = useQuery({
    queryKey: ['public-receipt', token],
    queryFn: () => getPublicReceipt(token as string),
    enabled: Boolean(token),
    retry: 0,
  });

  if (!token) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p role="alert" className="text-danger">
          This receipt link is incomplete.
        </p>
      </main>
    );
  }

  return (
    <main className="bg-paper min-h-screen px-4 py-8 sm:py-12 print:bg-white print:p-0">
      {receipt.isPending ? (
        <ReceiptSkeleton />
      ) : receipt.isError ? (
        <div
          role="alert"
          className="border-danger/30 bg-danger/10 mx-auto max-w-xl rounded-lg border p-4"
        >
          <p className="text-danger font-medium">Could not load this receipt.</p>
          <p className="text-ink-soft mt-1 text-sm">{receipt.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void receipt.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : receipt.data === null ? (
        <div className="border-line bg-surface mx-auto max-w-xl rounded-lg border p-6 text-center">
          <p className="font-display text-2xl font-bold">Receipt not found</p>
          <p className="text-ink-soft mt-2 text-sm">
            This link is incorrect or the receipt is no longer available. Ask the shop to verify the
            receipt number.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="outline"
              size="touch"
              nativeButton={false}
              render={<Link to="/verify" />}
            >
              <CheckCircle2 aria-hidden="true" />
              Verify a receipt
            </Button>
          </div>
        </div>
      ) : (
        <ReceiptSheet receipt={receipt.data} />
      )}
    </main>
  );
}
