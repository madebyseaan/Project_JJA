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

import { useCloseDay } from '../hooks/use-owner';
import { closeDaySchema, type CloseDayValues } from '../schemas';
import type { DailySummary } from '../types';

type CloseDayDialogProps = {
  summary: DailySummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CloseDayDialog({ summary, open, onOpenChange }: CloseDayDialogProps) {
  const closeDay = useCloseDay();
  const existing = summary.dayClose;
  const form = useForm<CloseDayValues>({
    resolver: zodResolver(closeDaySchema),
    defaultValues: {
      countedCash: formatPesoInput(existing?.countedCashCentavos ?? summary.expectedCashCentavos),
      notes: existing?.notes ?? '',
    },
  });
  const countedValue = useWatch({ control: form.control, name: 'countedCash' });
  const counted = parsePesoToCentavos(countedValue);
  const variance = counted === null ? null : counted - summary.expectedCashCentavos;

  const onSubmit = form.handleSubmit(async (values) => {
    const countedCashCentavos = parsePesoToCentavos(values.countedCash);

    if (countedCashCentavos === null) return;

    try {
      await closeDay.mutateAsync({
        businessDate: summary.businessDate,
        countedCashCentavos,
        notes: values.notes || null,
      });
      toast.success(existing ? 'Day close corrected.' : 'Day closed.');
      onOpenChange(false);
    } catch {
      // The mutation error is rendered below.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {existing ? 'Correct day close' : 'Close the day'}
          </DialogTitle>
          <DialogDescription>
            {summary.businessDate} · Expected cash {formatCentavos(summary.expectedCashCentavos)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <div>
            <Label htmlFor="counted-cash">Counted cash (₱)</Label>
            <Input id="counted-cash" inputMode="decimal" {...form.register('countedCash')} />
            {form.formState.errors.countedCash ? (
              <p role="alert" className="text-danger mt-1 text-sm">
                {form.formState.errors.countedCash.message}
              </p>
            ) : null}
          </div>

          <div className="border-line bg-paper flex items-center justify-between rounded-md border p-3 text-sm">
            <span className="text-steel">Variance</span>
            <span
              className={
                variance === null
                  ? 'text-steel font-mono tabular-nums'
                  : variance === 0
                    ? 'text-ok font-mono font-semibold tabular-nums'
                    : 'text-danger font-mono font-semibold tabular-nums'
              }
            >
              {variance === null ? '—' : formatCentavos(variance)}
            </span>
          </div>

          <div>
            <Label htmlFor="close-notes">Notes</Label>
            <Textarea
              id="close-notes"
              rows={2}
              placeholder="Counted by Dad, drawer had…"
              {...form.register('notes')}
            />
            {form.formState.errors.notes ? (
              <p role="alert" className="text-danger mt-1 text-sm">
                {form.formState.errors.notes.message}
              </p>
            ) : null}
          </div>

          {closeDay.error ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
            >
              {closeDay.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" size="touch" disabled={closeDay.isPending}>
              {closeDay.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {existing ? 'Save correction' : 'Close day'}
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
