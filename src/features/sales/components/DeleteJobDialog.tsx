import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DeleteJobDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNo: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
};

export function DeleteJobDialog({
  open,
  onOpenChange,
  orderNo,
  pending,
  error,
  onConfirm,
}: DeleteJobDialogProps) {
  const close = (next: boolean) => {
    if (!next && pending) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Delete open job?</DialogTitle>
          <DialogDescription>
            Delete <span className="font-mono font-semibold">{orderNo}</span>? This removes the
            unpaid job and its items, labor, and extras. It cannot be undone. Paid jobs cannot be
            deleted.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p
            role="alert"
            className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
          >
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="destructive" size="touch" disabled={pending} onClick={onConfirm}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            {pending ? 'Deleting…' : 'Delete job'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={pending}
            onClick={() => close(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
