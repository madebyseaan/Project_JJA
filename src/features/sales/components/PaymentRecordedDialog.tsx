import { CheckCircle2, ReceiptText, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatManilaDate } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import type { PaymentRecordedState, SalesOrder } from '../types';

type PaymentRecordedDialogProps = {
  record: PaymentRecordedState;
  onClose: () => void;
  onShare: (order: SalesOrder) => void;
};

export function PaymentRecordedDialog({ record, onClose, onShare }: PaymentRecordedDialogProps) {
  const { order, paidCentavos, changeCentavos, mode } = record;
  const netPaidCentavos = Math.max(0, paidCentavos - changeCentavos);
  const receiptUrl = `${window.location.origin}/s/${order.publicToken}`;
  const paidOn = order.paidOn
    ? formatManilaDate(`${order.paidOn}T12:00:00+08:00`)
    : 'the payment date';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="bg-ok/10 text-ok flex size-12 items-center justify-center rounded-full">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <DialogTitle className="font-display text-2xl">
            {mode === 'updated' ? 'Payment updated' : 'Payment recorded'}
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono font-semibold">{order.orderNo}</span> is paid. The customer
            receipt is ready.
          </DialogDescription>
        </DialogHeader>

        <div className="border-line bg-surface rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Order</p>
            <span className="border-ok/40 bg-ok/10 text-ok rounded-sm border px-2 py-0.5 text-xs font-semibold">
              Paid
            </span>
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-steel">Total charged</dt>
              <dd className="font-mono tabular-nums">{formatCentavos(netPaidCentavos)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-steel">Amount paid</dt>
              <dd className="font-mono tabular-nums">{formatCentavos(paidCentavos)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-steel">Change</dt>
              <dd className="font-mono tabular-nums">{formatCentavos(changeCentavos)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-steel">Paid on</dt>
              <dd>{paidOn}</dd>
            </div>
          </dl>
        </div>

        <div className="border-ok/30 bg-ok/5 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="text-ok size-5" aria-hidden="true" />
            <p className="text-ok font-semibold">Receipt ready</p>
          </div>
          <p className="text-steel mt-1 text-sm">Share the link or QR code with the customer.</p>
        </div>

        <DialogFooter>
          <Button size="touch" onClick={() => onShare(order)}>
            <Share2 aria-hidden="true" />
            Share receipt
          </Button>
          <Button
            variant="outline"
            size="touch"
            nativeButton={false}
            render={
              <a href={receiptUrl} target="_blank" rel="noreferrer" aria-label="View receipt" />
            }
          >
            <ReceiptText aria-hidden="true" />
            View receipt
          </Button>
          <Button variant="outline" size="touch" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
