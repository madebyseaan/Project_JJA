import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { formatCentavos, formatPesoInput, parsePesoToCentavos } from '@/lib/money';

import { useRecordPayment } from '../hooks/use-tickets';
import { paymentSchema, type PaymentValues } from '../schemas';
import type { PaymentMethod } from '../types';

type RecordPaymentDialogProps = {
  ticketId: string;
  totalCentavos: number;
  paidCentavos: number;
  open: boolean;
  isOnline: boolean;
  onOpenChange: (open: boolean) => void;
};

const METHODS: PaymentMethod[] = ['CASH', 'GCASH', 'MAYA', 'OTHER'];

export function RecordPaymentDialog({
  ticketId,
  totalCentavos,
  paidCentavos,
  open,
  isOnline,
  onOpenChange,
}: RecordPaymentDialogProps) {
  const balance = totalCentavos - paidCentavos;
  const recordPayment = useRecordPayment(ticketId);
  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: 'CASH',
      amount: formatPesoInput(balance),
      referenceNo: '',
      note: '',
    },
  });
  const method = useWatch({ control: form.control, name: 'method' });

  const onSubmit = form.handleSubmit(async (values) => {
    const amountCentavos = parsePesoToCentavos(values.amount);

    if (amountCentavos === null) return;

    try {
      await recordPayment.mutateAsync({
        method: values.method,
        amountCentavos,
        referenceNo: values.referenceNo || null,
        note: values.note || null,
      });
      toast.success('Payment recorded.');
      onOpenChange(false);
    } catch {
      // The mutation error is rendered below.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Record payment</DialogTitle>
          <DialogDescription>
            Total {formatCentavos(totalCentavos)} · Balance {formatCentavos(balance)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
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
            <Label htmlFor="payment-amount">Amount (₱)</Label>
            <Input id="payment-amount" inputMode="decimal" {...form.register('amount')} />
            <p className="text-steel mt-1 text-xs">The balance is {formatCentavos(balance)}.</p>
            {form.formState.errors.amount ? (
              <p role="alert" className="text-danger mt-1 text-sm">
                {form.formState.errors.amount.message}
              </p>
            ) : null}
          </div>

          {method !== 'CASH' ? (
            <div>
              <Label htmlFor="payment-reference">Reference number</Label>
              <Input
                id="payment-reference"
                placeholder="GCash or Maya reference"
                {...form.register('referenceNo')}
              />
              {form.formState.errors.referenceNo ? (
                <p role="alert" className="text-danger mt-1 text-sm">
                  {form.formState.errors.referenceNo.message}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label htmlFor="payment-note">Note</Label>
            <Textarea
              id="payment-note"
              rows={2}
              placeholder="Optional"
              {...form.register('note')}
            />
            {form.formState.errors.note ? (
              <p role="alert" className="text-danger mt-1 text-sm">
                {form.formState.errors.note.message}
              </p>
            ) : null}
          </div>

          {recordPayment.error ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
            >
              {recordPayment.error.message}
            </p>
          ) : null}

          {!isOnline ? (
            <output className="text-warn block text-sm">
              You are offline. Recording a payment is disabled until the connection returns.
            </output>
          ) : null}

          <DialogFooter>
            <Button type="submit" size="touch" disabled={recordPayment.isPending || !isOnline}>
              {recordPayment.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Record payment
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
