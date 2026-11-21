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
import { cn } from '@/lib/utils';

import { useAdjustStock } from '../hooks/use-parts';
import { stockAdjustmentSchema, type StockAdjustmentValues } from '../schemas';
import type { Part } from '../types';

type StockAdjustDialogProps = {
  part: Part;
  open: boolean;
  isOnline: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StockAdjustDialog({ part, open, isOnline, onOpenChange }: StockAdjustDialogProps) {
  const adjustStock = useAdjustStock();
  const form = useForm<StockAdjustmentValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { delta: '', reason: 'RESTOCK', note: '' },
  });

  const reason = useWatch({ control: form.control, name: 'reason' });
  const deltaValue = useWatch({ control: form.control, name: 'delta' });
  const delta = Number(deltaValue);
  const preview = Number.isFinite(delta) ? part.stockOnHand + delta : part.stockOnHand;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await adjustStock.mutateAsync({
        partId: part.id,
        input: {
          delta: Number(values.delta),
          reason: values.reason,
          note: values.note || null,
        },
      });
      toast.success('Stock updated.');
      onOpenChange(false);
    } catch {
      // The mutation error is rendered below.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Adjust stock</DialogTitle>
          <DialogDescription>
            {part.name} · {part.stockOnHand} on hand, {part.reservedQty} reserved
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['RESTOCK', 'ADJUSTMENT'] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={reason === option ? 'default' : 'outline'}
                size="touch"
                aria-pressed={reason === option}
                onClick={() => form.setValue('reason', option, { shouldValidate: true })}
              >
                {option === 'RESTOCK' ? 'Restock' : 'Adjustment'}
              </Button>
            ))}
          </div>

          <div>
            <Label htmlFor="stock-delta">
              {reason === 'RESTOCK' ? 'Quantity received' : 'Change (+ or −)'}
            </Label>
            <Input
              id="stock-delta"
              inputMode="numeric"
              placeholder={reason === 'RESTOCK' ? '10' : '-3'}
              {...form.register('delta')}
            />
            <p
              className={cn(
                'mt-1 text-xs',
                preview < part.reservedQty ? 'text-danger' : 'text-steel',
              )}
              aria-live="polite"
            >
              New count: {preview}
              {preview < part.reservedQty
                ? ' — below the reserved quantity. Reduce the change.'
                : ''}
            </p>
            {form.formState.errors.delta ? (
              <p role="alert" className="text-danger mt-1 text-sm">
                {form.formState.errors.delta.message}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="stock-note">Note</Label>
            <Textarea
              id="stock-note"
              rows={2}
              placeholder="Delivery, count correction, damage…"
              {...form.register('note')}
            />
            {form.formState.errors.note ? (
              <p role="alert" className="text-danger mt-1 text-sm">
                {form.formState.errors.note.message}
              </p>
            ) : null}
          </div>

          {adjustStock.error ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
            >
              {adjustStock.error.message}
            </p>
          ) : null}

          {!isOnline ? (
            <output className="text-warn block text-sm">
              You are offline. Adjusting stock is disabled until the connection returns.
            </output>
          ) : null}

          <DialogFooter>
            <Button type="submit" size="touch" disabled={adjustStock.isPending || !isOnline}>
              {adjustStock.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save stock
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
