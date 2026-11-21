import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCentavos, formatPesoInput, parsePesoToCentavos } from '@/lib/money';

import { useCompleteTicket } from '../hooks/use-tickets';
import { paymentSchema, type PaymentValues } from '../schemas';
import type { PaymentMethod, Receipt } from '../types';

type CompleteTicketDialogProps = {
  ticketId: string;
  totalCentavos: number;
  paidCentavos: number;
  open: boolean;
  isOnline: boolean;
  onOpenChange: (open: boolean) => void;
};

const METHODS: PaymentMethod[] = ['CASH', 'GCASH', 'MAYA', 'OTHER'];

export function CompleteTicketDialog({
  ticketId,
  totalCentavos,
  paidCentavos,
  open,
  isOnline,
  onOpenChange,
}: CompleteTicketDialogProps) {
  const balance = totalCentavos - paidCentavos;
  const complete = useCompleteTicket(ticketId);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: 'CASH',
      amount: formatPesoInput(Math.max(0, balance)),
      referenceNo: '',
      note: '',
    },
  });
  const method = useWatch({ control: form.control, name: 'method' });

  const onSubmit = form.handleSubmit(async (values) => {
    const payments =
      balance > 0
        ? [
            {
              method: values.method,
              amountCentavos: parsePesoToCentavos(values.amount) ?? 0,
              referenceNo: values.referenceNo || null,
              note: values.note || null,
            },
          ]
        : [];

    try {
      const result = await complete.mutateAsync(payments);
      setReceipt(result);
      toast.success('Ticket completed. Receipt issued.');
    } catch {
      // The mutation error is rendered below.
    }
  });

  if (receipt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="text-ok flex items-center gap-2">
              <CheckCircle2 className="size-6" aria-hidden="true" />
              <DialogTitle className="font-display text-2xl">Receipt issued</DialogTitle>
            </div>
            <DialogDescription>
              The sale is complete and the stock has been deducted.
            </DialogDescription>
          </DialogHeader>

          <dl className="border-line space-y-2 rounded-md border p-4 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-steel">Receipt no.</dt>
              <dd className="font-mono font-semibold">{receipt.receiptNo}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel">Total</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {formatCentavos(receipt.totalCentavos)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel">Verification code</dt>
              <dd className="font-mono text-xs">{receipt.verificationCode}</dd>
            </div>
          </dl>

          <div className="flex flex-col items-center gap-2">
            <QRCodeSVG
              value={`${window.location.origin}/r/${receipt.publicToken}`}
              size={132}
              bgColor="#ffffff"
              fgColor="#12181a"
              aria-label="QR code for the customer receipt"
            />
            <p className="text-steel text-center text-xs">
              The customer can scan this code to open the e-receipt.
            </p>
          </div>

          <DialogFooter>
            <Button size="touch" render={<Link to={`/r/${receipt.publicToken}`} />}>
              View receipt
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Complete ticket</DialogTitle>
          <DialogDescription>
            Total {formatCentavos(totalCentavos)} · Paid {formatCentavos(paidCentavos)} · Balance{' '}
            {formatCentavos(balance)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          {balance > 0 ? (
            <>
              <p className="text-ink-soft text-sm">
                Take the final payment of <strong>{formatCentavos(balance)}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={method === option ? 'default' : 'outline'}
                    size="touch"
                    aria-pressed={method === option}
                    onClick={() => form.setValue('method', option, { shouldValidate: true })}
                  >
                    {option === 'CASH'
                      ? 'Cash'
                      : option === 'GCASH'
                        ? 'GCash'
                        : option === 'MAYA'
                          ? 'Maya'
                          : 'Other'}
                  </Button>
                ))}
              </div>
              <div>
                <Label htmlFor="complete-amount">Amount (₱)</Label>
                <Input id="complete-amount" inputMode="decimal" {...form.register('amount')} />
                {form.formState.errors.amount ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.amount.message}
                  </p>
                ) : null}
              </div>
              {method !== 'CASH' ? (
                <div>
                  <Label htmlFor="complete-reference">Reference number</Label>
                  <Input
                    id="complete-reference"
                    placeholder="GCash or Maya reference"
                    {...form.register('referenceNo')}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-ink-soft text-sm">
              The ticket is fully paid. Completing it deducts stock and issues the receipt.
            </p>
          )}

          {complete.error ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
            >
              {complete.error.message}
            </p>
          ) : null}

          {!isOnline ? (
            <output className="text-warn block text-sm">
              You are offline. Completing a ticket is disabled until the connection returns.
            </output>
          ) : null}

          <DialogFooter>
            <Button type="submit" size="touch" disabled={complete.isPending || !isOnline}>
              {complete.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Complete ticket
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
