import { ArrowLeft, ArrowRightLeft, Loader2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
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
import { Skeleton } from '@/components/ui/skeleton';
import { formatManilaDateTime } from '@/lib/dates';
import { formatCentavos, parsePesoToCentavos } from '@/lib/money';

import { useGcashBalances, useGcashTransfers, useRecordGcashTransfer } from './hooks/use-sales';
import type { GcashBalance } from './types';

function TransferDialog({
  open,
  onOpenChange,
  balances,
  initialUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balances: GcashBalance[];
  initialUserId: string | null;
}) {
  const transfer = useRecordGcashTransfer();
  const [userId, setUserId] = useState(initialUserId ?? balances[0]?.userId ?? '');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState<'SHOP_BANK' | 'USER'>('SHOP_BANK');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sender = balances.find((row) => row.userId === userId);
  const others = balances.filter((row) => row.userId !== userId);
  const available =
    destination === 'SHOP_BANK'
      ? (sender?.shopHeldCentavos ?? 0)
      : (sender?.laborHeldCentavos ?? 0);

  const reset = () => {
    setAmount('');
    setDestination('SHOP_BANK');
    setCounterpartyId('');
    setReference('');
    setNote('');
    setError(null);
  };

  const close = (next: boolean) => {
    if (!next && transfer.isPending) return;

    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    const centavos = parsePesoToCentavos(amount);

    if (!userId) {
      setError('Choose whose GCash account the money is in.');
      return;
    }

    if (centavos === null || centavos <= 0) {
      setError('Enter a valid amount.');
      return;
    }

    if (centavos > available) {
      setError(`That is more than the ${formatCentavos(available)} available for this transfer.`);
      return;
    }

    if (destination === 'USER' && !counterpartyId) {
      setError('Choose who received the GCash.');
      return;
    }

    try {
      await transfer.mutateAsync({
        userId,
        amountCentavos: centavos,
        destination,
        counterpartyUserId: destination === 'USER' ? counterpartyId : null,
        reference: reference.trim() || null,
        note: note.trim() || null,
      });
      toast.success('GCash transfer recorded.');
      close(false);
    } catch (transferError) {
      setError(
        transferError instanceof Error ? transferError.message : 'Could not record the transfer.',
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Record GCash transfer</DialogTitle>
          <DialogDescription>
            Use this when shop money leaves a personal GCash account, or when one person pays the
            other.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>From</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {balances.map((row) => (
                <Button
                  key={row.userId}
                  type="button"
                  variant={userId === row.userId ? 'default' : 'outline'}
                  size="touch"
                  aria-pressed={userId === row.userId}
                  onClick={() => {
                    setUserId(row.userId);
                    setCounterpartyId('');
                    setError(null);
                  }}
                >
                  {row.displayName}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="transfer-amount">Amount (₱)</Label>
            <Input
              id="transfer-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError(null);
              }}
            />
            <p className="text-steel mt-1 text-xs">
              Available: <strong>{formatCentavos(available)}</strong>
            </p>
          </div>

          <div>
            <Label>Destination</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={destination === 'SHOP_BANK' ? 'default' : 'outline'}
                size="touch"
                aria-pressed={destination === 'SHOP_BANK'}
                onClick={() => {
                  setDestination('SHOP_BANK');
                  setError(null);
                }}
              >
                Shop bank
              </Button>
              <Button
                type="button"
                variant={destination === 'USER' ? 'default' : 'outline'}
                size="touch"
                aria-pressed={destination === 'USER'}
                onClick={() => {
                  setDestination('USER');
                  setError(null);
                }}
              >
                Other person
              </Button>
            </div>
          </div>

          {destination === 'USER' ? (
            <div>
              <Label>Received by</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {others.length === 0 ? (
                  <p className="text-steel text-sm">No other staff account.</p>
                ) : (
                  others.map((row) => (
                    <Button
                      key={row.userId}
                      type="button"
                      variant={counterpartyId === row.userId ? 'default' : 'outline'}
                      size="touch"
                      aria-pressed={counterpartyId === row.userId}
                      onClick={() => {
                        setCounterpartyId(row.userId);
                        setError(null);
                      }}
                    >
                      {row.displayName}
                    </Button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="transfer-reference">Bank reference</Label>
            <Input
              id="transfer-reference"
              placeholder="Optional"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="transfer-note">Note</Label>
            <Input
              id="transfer-note"
              placeholder="Optional"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button size="touch" disabled={transfer.isPending} onClick={() => void submit()}>
            {transfer.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRightLeft aria-hidden="true" />
            )}
            {transfer.isPending ? 'Recording…' : 'Record transfer'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={transfer.isPending}
            onClick={() => close(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GcashPage() {
  const balances = useGcashBalances();
  const transfers = useGcashTransfers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialUserId, setInitialUserId] = useState<string | null>(null);

  const rows = balances.data ?? [];
  const totalShopHeld = rows.reduce((total, row) => total + row.shopHeldCentavos, 0);

  const openTransfer = (userId: string | null) => {
    setInitialUserId(userId);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="GCash"
        description="Shop money held in personal GCash accounts, and labor money waiting to be settled."
        actions={
          <Button
            variant="outline"
            size="touch"
            nativeButton={false}
            render={<Link to="/reports" />}
          >
            <ArrowLeft aria-hidden="true" />
            Reports
          </Button>
        }
      />

      <section
        className={
          totalShopHeld > 0
            ? 'border-warn/40 bg-warn/10 rounded-lg border p-4'
            : 'border-ok/40 bg-ok/10 rounded-lg border p-4'
        }
        aria-live="polite"
      >
        <p className="text-steel text-xs">Shop GCash still held</p>
        <p className="font-display mt-1 text-3xl font-bold tabular-nums">
          {formatCentavos(totalShopHeld)}
        </p>
        <p className="text-ink-soft mt-1 text-sm">
          {totalShopHeld > 0
            ? 'Transfer this to the shop bank account, then record the transfer here.'
            : 'All shop GCash has been transferred. Nothing is pending.'}
        </p>
      </section>

      {balances.isPending ? (
        <output className="grid gap-2 sm:grid-cols-2" aria-label="Loading GCash balances">
          {[0, 1].map((card) => (
            <Skeleton key={card} className="block h-56 w-full" />
          ))}
        </output>
      ) : balances.isError ? (
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load GCash balances.</p>
          <p className="text-ink-soft mt-1 text-sm">{balances.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void balances.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <section className="grid gap-2 sm:grid-cols-2" aria-label="GCash balances per person">
          {rows.map((row) => (
            <div key={row.userId} className="border-line bg-surface rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-semibold">{row.displayName}</h2>
                <Wallet className="text-steel size-5" aria-hidden="true" />
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="border-line flex justify-between border-b pb-2">
                  <dt className="font-medium">Shop GCash held</dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {formatCentavos(row.shopHeldCentavos)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-steel">Shop share received</dt>
                  <dd className="tabular-nums">{formatCentavos(row.shopShareCentavos)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-steel">Sent to shop bank</dt>
                  <dd className="tabular-nums">{formatCentavos(row.shopTransfersCentavos)}</dd>
                </div>
                <div className="border-line mt-2 flex justify-between border-t pt-2">
                  <dt className="font-medium">Labor GCash held</dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {formatCentavos(row.laborHeldCentavos)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-steel">Labor earned all-time</dt>
                  <dd className="tabular-nums">{formatCentavos(row.laborEarnedCentavos)}</dd>
                </div>
              </dl>

              <Button
                size="touch"
                className="mt-3 w-full"
                disabled={row.shopHeldCentavos === 0 && row.laborHeldCentavos === 0}
                onClick={() => openTransfer(row.userId)}
              >
                <ArrowRightLeft aria-hidden="true" />
                Record transfer
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2" aria-labelledby="transfer-history">
        <h2 id="transfer-history" className="font-display text-xl font-semibold">
          Recent transfers
        </h2>

        {transfers.isPending ? (
          <Skeleton className="block h-32 w-full" />
        ) : transfers.isError ? (
          <p role="alert" className="text-danger text-sm">
            Could not load transfers: {transfers.error.message}
          </p>
        ) : (transfers.data ?? []).length === 0 ? (
          <p className="border-line bg-surface text-steel rounded-lg border p-4 text-sm">
            No transfers recorded yet.
          </p>
        ) : (
          <ul className="divide-line border-line bg-surface divide-y rounded-lg border">
            {transfers.data?.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {row.userName ?? 'Staff'} →{' '}
                    {row.destination === 'SHOP_BANK'
                      ? 'Shop bank'
                      : (row.counterpartyName ?? 'Staff')}
                  </p>
                  <p className="text-steel mt-0.5 text-xs">
                    {formatManilaDateTime(row.createdAt)}
                    {row.reference ? ` · ${row.reference}` : ''}
                  </p>
                  {row.note ? <p className="text-ink-soft mt-1 text-sm">{row.note}</p> : null}
                </div>
                <p className="shrink-0 font-mono font-semibold tabular-nums">
                  {formatCentavos(row.amountCentavos)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-steel text-xs">
        Month close and QuickBooks export will use these balances in the next step.
      </p>

      <TransferDialog
        key={`${initialUserId ?? 'none'}-${dialogOpen ? 'open' : 'closed'}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        balances={rows}
        initialUserId={initialUserId}
      />
    </div>
  );
}
