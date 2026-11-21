import { BadgeCheck, Circle, Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatManilaDateTime } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import {
  useRemoveTicketItem,
  useSetTicketItemQty,
  useVerifyAllTicketItems,
  useVerifyTicketItem,
} from '../hooks/use-tickets';
import type { TicketItem } from '../types';

type TicketPartsCardProps = {
  ticketId: string;
  items: TicketItem[];
  editable: boolean;
  isOnline: boolean;
  onAddPart: () => void;
};

function VerifiedLabel({ item }: { item: TicketItem }) {
  if (item.verifiedAt) {
    return (
      <span className="text-ok inline-flex items-center gap-1 text-xs font-medium">
        <BadgeCheck className="size-4" aria-hidden="true" />
        Verified {formatManilaDateTime(item.verifiedAt)}
      </span>
    );
  }

  return (
    <span className="text-warn inline-flex items-center gap-1 text-xs font-medium">
      <Circle className="size-2 fill-current" aria-hidden="true" />
      Not verified
    </span>
  );
}

export function TicketPartsCard({
  ticketId,
  items,
  editable,
  isOnline,
  onAddPart,
}: TicketPartsCardProps) {
  const setQty = useSetTicketItemQty(ticketId);
  const removeItem = useRemoveTicketItem(ticketId);
  const verifyItem = useVerifyTicketItem(ticketId);
  const verifyAll = useVerifyAllTicketItems(ticketId);
  const [removeTarget, setRemoveTarget] = useState<TicketItem | null>(null);
  const busy =
    setQty.isPending || removeItem.isPending || verifyItem.isPending || verifyAll.isPending;
  const unverified = items.filter((item) => item.verifiedAt === null);

  const changeQty = async (item: TicketItem, qty: number) => {
    try {
      await setQty.mutateAsync({ partId: item.partId, qty });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the quantity.');
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;

    try {
      await removeItem.mutateAsync(removeTarget.partId);
      toast.success(`${removeTarget.partName} removed. Stock reservation released.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the part.');
    } finally {
      setRemoveTarget(null);
    }
  };

  const handleVerify = async (item: TicketItem) => {
    try {
      await verifyItem.mutateAsync(item.partId);
      toast.success(`${item.partName} verified.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not verify the part.');
    }
  };

  const handleVerifyAll = async () => {
    try {
      const count = await verifyAll.mutateAsync();
      toast.success(`${count} part${count === 1 ? '' : 's'} verified.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not verify the parts.');
    }
  };

  return (
    <section className="border-line bg-surface rounded-lg border">
      <div className="border-line flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Parts</h2>
          <p className="text-steel text-xs">
            {items.length} lines · {items.length - unverified.length} verified
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && unverified.length > 0 ? (
            <Button
              variant="outline"
              size="touch"
              disabled={!isOnline || busy}
              onClick={() => void handleVerifyAll()}
            >
              {verifyAll.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <BadgeCheck aria-hidden="true" />
              )}
              Verify all
            </Button>
          ) : null}
          {editable ? (
            <Button size="touch" disabled={!isOnline} onClick={onAddPart}>
              <Plus aria-hidden="true" />
              Add part
            </Button>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-steel p-4 text-sm">
          No parts yet.{editable ? ' Add a part to reserve stock.' : ''}
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                  <TableHead>Verified</TableHead>
                  {editable ? <TableHead className="w-32" aria-label="Actions" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.partName}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{item.qty}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCentavos(item.unitPriceCentavos)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {formatCentavos(item.lineTotalCentavos)}
                    </TableCell>
                    <TableCell>
                      <VerifiedLabel item={item} />
                    </TableCell>
                    {editable ? (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Reduce ${item.partName} quantity`}
                            disabled={!isOnline || busy || item.qty <= 1}
                            onClick={() => void changeQty(item, item.qty - 1)}
                          >
                            <Minus aria-hidden="true" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Increase ${item.partName} quantity`}
                            disabled={!isOnline || busy}
                            onClick={() => void changeQty(item, item.qty + 1)}
                          >
                            <Plus aria-hidden="true" />
                          </Button>
                          {item.verifiedAt === null ? (
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Verify ${item.partName}`}
                              disabled={!isOnline || busy}
                              onClick={() => void handleVerify(item)}
                            >
                              <BadgeCheck aria-hidden="true" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${item.partName}`}
                            disabled={!isOnline || busy}
                            onClick={() => setRemoveTarget(item)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-line divide-y md:hidden">
            {items.map((item) => (
              <li key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{item.partName}</p>
                    <p className="text-steel font-mono text-xs tabular-nums">
                      {item.qty} × {formatCentavos(item.unitPriceCentavos)}
                    </p>
                  </div>
                  <p className="font-mono font-semibold tabular-nums">
                    {formatCentavos(item.lineTotalCentavos)}
                  </p>
                </div>
                <div className="mt-2">
                  <VerifiedLabel item={item} />
                </div>
                {editable ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="touch"
                      aria-label={`Reduce ${item.partName} quantity`}
                      disabled={!isOnline || busy || item.qty <= 1}
                      onClick={() => void changeQty(item, item.qty - 1)}
                    >
                      <Minus aria-hidden="true" />
                    </Button>
                    <span className="w-10 text-center font-mono tabular-nums">{item.qty}</span>
                    <Button
                      variant="outline"
                      size="touch"
                      aria-label={`Increase ${item.partName} quantity`}
                      disabled={!isOnline || busy}
                      onClick={() => void changeQty(item, item.qty + 1)}
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                    {item.verifiedAt === null ? (
                      <Button
                        variant="outline"
                        size="touch"
                        className="flex-1"
                        disabled={!isOnline || busy}
                        onClick={() => void handleVerify(item)}
                      >
                        Verify
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="touch"
                      aria-label={`Remove ${item.partName}`}
                      disabled={!isOnline || busy}
                      onClick={() => setRemoveTarget(item)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this part?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${removeTarget.qty} × ${removeTarget.partName} will be removed and the stock reservation released.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="touch">Keep part</AlertDialogCancel>
            <AlertDialogAction
              size="touch"
              variant="destructive"
              disabled={removeItem.isPending}
              onClick={() => void handleRemove()}
            >
              Remove part
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
