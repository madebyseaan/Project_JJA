import { ReceiptText, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatManilaDate } from '@/lib/dates';

import type { SalesOrder } from '../types';

type PaidReceiptBannerProps = {
  order: SalesOrder;
  onShare: () => void;
};

export function PaidReceiptBanner({ order, onShare }: PaidReceiptBannerProps) {
  const paidOn = order.paidOn ? formatManilaDate(`${order.paidOn}T12:00:00+08:00`) : null;

  return (
    <div className="border-ok/30 bg-ok/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <ReceiptText className="text-ok mt-0.5 size-5" aria-hidden="true" />
        <div>
          <p className="text-ok font-semibold">Receipt ready</p>
          <p className="text-steel text-sm">
            {order.status === 'EXPORTED' ? 'Exported' : 'Paid'}
            {paidOn ? ` on ${paidOn}` : ''}. Share the receipt with the customer.
          </p>
        </div>
      </div>
      <Button variant="outline" size="touch" className="w-full sm:w-auto" onClick={onShare}>
        <Share2 aria-hidden="true" />
        Share receipt
      </Button>
    </div>
  );
}
