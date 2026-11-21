import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { parsePesoToCentavos } from '@/lib/money';

import { useAddTicketLabor } from '../hooks/use-tickets';
import { laborFormSchema, type LaborFormValues } from '../schemas';

type AddLaborDialogProps = {
  ticketId: string;
  open: boolean;
  isOnline: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddLaborDialog({ ticketId, open, isOnline, onOpenChange }: AddLaborDialogProps) {
  const addLabor = useAddTicketLabor(ticketId);
  const form = useForm<LaborFormValues>({
    resolver: zodResolver(laborFormSchema),
    defaultValues: { description: '', amount: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const amountCentavos = parsePesoToCentavos(values.amount);

    if (amountCentavos === null) return;

    try {
      await addLabor.mutateAsync({ description: values.description, amountCentavos });
      toast.success('Labor added.');
      form.reset({ description: '', amount: '' });
      onOpenChange(false);
    } catch {
      // The mutation error is rendered below.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add labor</DialogTitle>
          <DialogDescription>Describe the work and the amount charged.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <div>
            <Label htmlFor="labor-description-dialog">Description</Label>
            <Input
              id="labor-description-dialog"
              placeholder="Replace brake pads"
              {...form.register('description')}
            />
            {form.formState.errors.description ? (
              <p role="alert" className="text-danger mt-1 text-sm">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="labor-amount-dialog">Amount (₱)</Label>
            <Input
              id="labor-amount-dialog"
              inputMode="decimal"
              placeholder="0.00"
              {...form.register('amount')}
            />
            {form.formState.errors.amount ? (
              <p role="alert" className="text-danger mt-1 text-sm">
                {form.formState.errors.amount.message}
              </p>
            ) : null}
          </div>

          {addLabor.error ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
            >
              {addLabor.error.message}
            </p>
          ) : null}

          {!isOnline ? (
            <output className="text-warn block text-sm">
              You are offline. Adding labor is disabled until the connection returns.
            </output>
          ) : null}

          <DialogFooter>
            <Button type="submit" size="touch" disabled={addLabor.isPending || !isOnline}>
              {addLabor.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Add labor
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
