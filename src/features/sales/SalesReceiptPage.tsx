import { Copy, Printer, ReceiptText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatManilaDate } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { usePublicReceipt } from './hooks/use-sales';
import type { PublicSalesReceipt } from './types';

async function copyReceiptLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Receipt link copied.');
  } catch {
    toast.error('Could not copy the link. Select the address bar and copy it manually.');
  }
}

function ReceiptSheet({ receipt }: { receipt: PublicSalesReceipt }) {
  const partsTotalCentavos = receipt.items.reduce(
    (total, item) => total + item.lineTotalCentavos,
    0,
  );
  const chargedTotalCentavos = receipt.totalCentavos + receipt.extrasTotalCentavos;
  const paidTotalCentavos =
    receipt.payments.reduce((total, payment) => total + payment.amountCentavos, 0) -
    receipt.changes.reduce((total, change) => total + change.amountCentavos, 0);

  return (
    <article className="mx-auto max-w-2xl print:max-w-none">
      <div className="border-line bg-surface rounded-lg border p-5 sm:p-8 print:border-0 print:shadow-none">
        <header className="border-line border-b pb-5 text-center">
          <div className="mb-3 flex justify-center">
            <ReceiptText className="text-safety size-8" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{receipt.shop.name}</h1>
          {receipt.shop.address ? (
            <p className="text-ink-soft mt-1 text-sm">{receipt.shop.address}</p>
          ) : null}
          {receipt.shop.contact ? (
            <p className="text-steel mt-0.5 text-sm">{receipt.shop.contact}</p>
          ) : null}
          <p className="text-steel mt-3 text-xs font-semibold tracking-wide uppercase">
            Sales receipt
          </p>
        </header>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-steel text-xs">Order number</p>
            <p className="font-mono text-lg font-semibold">{receipt.orderNo}</p>
            <p className="text-steel mt-1 text-xs">
              Job date {formatManilaDate(`${receipt.businessDate}T12:00:00+08:00`)}
            </p>
            <p className="text-steel text-xs">
              Paid on {formatManilaDate(`${receipt.paidOn}T12:00:00+08:00`)}
            </p>
          </div>
          {receipt.customerName || receipt.bikeModel ? (
            <div className="text-right">
              {receipt.customerName ? (
                <>
                  <p className="text-steel text-xs">Customer</p>
                  <p className="font-medium">{receipt.customerName}</p>
                </>
              ) : null}
              {receipt.bikeModel ? (
                <p className="text-steel mt-1 text-xs">{receipt.bikeModel}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {receipt.items.length > 0 ? (
          <div className="border-line mt-5 border-t border-dashed pt-5">
            <h2 className="text-steel text-xs font-semibold tracking-wide uppercase">Items</h2>
            <ul className="mt-2 divide-y divide-dashed">
              {receipt.items.map((item, index) => (
                <li
                  key={`${item.name}-${index}`}
                  className="flex justify-between gap-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-steel text-xs">
                      {item.qty} × {formatCentavos(item.unitPriceCentavos)}
                    </p>
                  </div>
                  <p className="font-mono tabular-nums">{formatCentavos(item.lineTotalCentavos)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <dl className="border-line mt-5 space-y-1 border-t pt-4 text-sm">
          {receipt.items.length > 0 ? (
            <div className="flex justify-between">
              <dt className="text-steel">Parts</dt>
              <dd className="font-mono tabular-nums">{formatCentavos(partsTotalCentavos)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-steel">Labor</dt>
            <dd className="font-mono tabular-nums">{formatCentavos(receipt.laborTotalCentavos)}</dd>
          </div>
          {receipt.extrasTotalCentavos > 0 ? (
            <div className="flex justify-between">
              <dt className="text-steel">Extra / tip</dt>
              <dd className="font-mono tabular-nums">
                {formatCentavos(receipt.extrasTotalCentavos)}
              </dd>
            </div>
          ) : null}
          <div className="border-line flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total charged</dt>
            <dd className="font-mono tabular-nums">{formatCentavos(chargedTotalCentavos)}</dd>
          </div>
        </dl>

        {receipt.payments.length > 0 ? (
          <div className="border-line mt-4 border-t pt-4">
            <h2 className="text-steel text-xs font-semibold tracking-wide uppercase">
              Payments received
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {receipt.payments.map((payment, index) => (
                <li key={`${payment.method}-${index}`} className="flex justify-between gap-3">
                  <span>{payment.method === 'CASH' ? 'Cash' : 'GCash'}</span>
                  <span className="font-mono tabular-nums">
                    {formatCentavos(payment.amountCentavos)}
                  </span>
                </li>
              ))}
            </ul>

            {receipt.changes.length > 0 ? (
              <>
                <h3 className="text-steel mt-3 text-xs font-semibold tracking-wide uppercase">
                  Change returned
                </h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {receipt.changes.map((change, index) => (
                    <li key={`${change.method}-${index}`} className="flex justify-between gap-3">
                      <span>{change.method === 'CASH' ? 'Cash' : 'GCash'}</span>
                      <span className="font-mono tabular-nums">
                        − {formatCentavos(change.amountCentavos)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="border-line mt-3 flex justify-between border-t pt-2 font-semibold">
              <span>Net paid</span>
              <span className="font-mono tabular-nums">{formatCentavos(paidTotalCentavos)}</span>
            </div>
          </div>
        ) : null}

        <div className="border-line mt-6 flex flex-col items-center gap-3 border-t border-dashed pt-5 sm:flex-row sm:justify-between">
          <div>
            <p className="text-steel text-xs">Keep this link</p>
            <p className="text-ink-soft mt-1 max-w-xs text-xs">
              This digital receipt stays available at the same link. It is not a BIR Official
              Receipt.
            </p>
          </div>
          <QRCodeSVG
            value={window.location.href}
            size={104}
            bgColor="#ffffff"
            fgColor="#12181a"
            aria-label="QR code for this receipt"
          />
        </div>

        {receipt.shop.footer ? (
          <p className="border-line text-steel mt-5 border-t pt-4 text-center text-xs">
            {receipt.shop.footer}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Button size="touch" onClick={() => void copyReceiptLink()}>
          <Copy aria-hidden="true" />
          Copy link
        </Button>
        <Button variant="outline" size="touch" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Save as PDF
        </Button>
      </div>
    </article>
  );
}

export function SalesReceiptPage() {
  const { token } = useParams();
  const receipt = usePublicReceipt(token);

  return (
    <main className="bg-paper min-h-screen px-4 py-8 sm:py-12 print:bg-white print:p-0">
      {!token ? (
        <div className="mx-auto max-w-xl text-center">
          <p role="alert" className="text-danger">
            This receipt link is incomplete.
          </p>
        </div>
      ) : receipt.isPending ? (
        <output className="mx-auto block max-w-2xl space-y-4" aria-label="Loading receipt">
          <Skeleton className="block h-12 w-2/3" />
          <Skeleton className="block h-4 w-1/2" />
          <Skeleton className="block h-64 w-full" />
        </output>
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
            This link is incorrect or the order was removed. Ask the shop to check the order number.
          </p>
        </div>
      ) : (
        <ReceiptSheet receipt={receipt.data} />
      )}
    </main>
  );
}
