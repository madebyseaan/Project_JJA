import { Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useCancelTicket } from '../hooks/use-tickets';

type CancelTicketDialogProps = {
  ticketId: string;
  hasPayments: boolean;
  isOwner: boolean;
  open: boolean;
  isOnline: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CancelTicketDialog({
  ticketId,
  hasPayments,
  isOwner,
  open,
  isOnline,
  onOpenChange,
}: CancelTicketDialogProps) {
  const cancel = useCancelTicket(ticketId);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const blocked = hasPayments && !isOwner;

  const handleCancel = async () => {
    const trimmed = reason.trim();

    if (trimmed.length === 0) {
      setError('Enter a reason for cancelling.');
      return;
    }

    try {
      await cancel.mutateAsync(trimmed);
      toast.success('Ticket cancelled. Stock reservation released.');
      onOpenChange(false);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : 'Could not cancel the ticket.',
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Cancel ticket</DialogTitle>
          <DialogDescription>
            This releases the stock reservation. A ticket with a deposit can only be cancelled by
            the owner, who records the refund.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <p className="border-warn/30 bg-warn/10 text-warn rounded-md border p-3 text-sm">
            This ticket has a deposit. Ask the owner to cancel it and issue the refund.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder="Customer left, wrong part, duplicate ticket…"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError(null);
              }}
            />
            {error ? (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            ) : null}
          </div>
        )}

        {!isOnline ? (
          <output className="text-warn block text-sm">
            You are offline. Cancelling is disabled until the connection returns.
          </output>
        ) : null}

        <DialogFooter>
          <Button
            size="touch"
            variant="destructive"
            disabled={blocked || cancel.isPending || !isOnline}
            onClick={() => void handleCancel()}
          >
            {cancel.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Cancel ticket
          </Button>
          <Button type="button" variant="outline" size="touch" onClick={() => onOpenChange(false)}>
            Keep ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
