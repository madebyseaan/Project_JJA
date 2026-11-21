import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Part } from '@/features/inventory/types';

import { useAddTicketItem } from '../hooks/use-tickets';
import { PartPicker } from './PartPicker';

type AddPartSheetProps = {
  ticketId: string;
  open: boolean;
  isOnline: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddPartSheet({ ticketId, open, isOnline, onOpenChange }: AddPartSheetProps) {
  const addItem = useAddTicketItem(ticketId);
  const [pendingPartId, setPendingPartId] = useState<string | null>(null);

  const handlePick = async (part: Part) => {
    setPendingPartId(part.id);

    try {
      await addItem.mutateAsync({ partId: part.id, qty: 1 });
      toast.success(`${part.name} added.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the part.');
    } finally {
      setPendingPartId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Add a part</SheetTitle>
          <SheetDescription>
            Stock is reserved as soon as the part is added. The price is snapshotted now.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <PartPicker isOnline={isOnline} pendingPartId={pendingPartId} onPick={handlePick} />
          {addItem.isPending ? (
            <output className="text-steel mt-3 flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Reserving stock…
            </output>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
