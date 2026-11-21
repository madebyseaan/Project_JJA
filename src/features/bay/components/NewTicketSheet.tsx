import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { Part } from '@/features/inventory/types';
import { formatCentavos, parsePesoToCentavos } from '@/lib/money';

import { useCreateTicket } from '../hooks/use-tickets';
import {
  laborFormSchema,
  newTicketSchema,
  ticketTypeLabel,
  type LaborFormValues,
  type NewTicketValues,
} from '../schemas';
import type { TicketLaborInput, TicketType } from '../types';
import { PartPicker } from './PartPicker';

type NewTicketSheetProps = {
  open: boolean;
  isOnline: boolean;
  onOpenChange: (open: boolean) => void;
};

type SelectedLine = {
  part: Part;
  qty: number;
};

export function NewTicketSheet({ open, isOnline, onOpenChange }: NewTicketSheetProps) {
  const navigate = useNavigate();
  const createTicket = useCreateTicket();
  const [selected, setSelected] = useState<SelectedLine[]>([]);
  const [laborLines, setLaborLines] = useState<TicketLaborInput[]>([]);

  const form = useForm<NewTicketValues>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: { type: 'REPAIR', customerName: '', bikeModel: '', notes: '' },
  });

  const laborForm = useForm<LaborFormValues>({
    resolver: zodResolver(laborFormSchema),
    defaultValues: { description: '', amount: '' },
  });

  const type = useWatch({ control: form.control, name: 'type' });
  const partsTotal = selected.reduce(
    (total, line) => total + line.qty * line.part.unitPriceCentavos,
    0,
  );
  const laborTotal = laborLines.reduce((total, line) => total + line.amountCentavos, 0);
  const total = partsTotal + laborTotal;

  const addPart = (part: Part) => {
    setSelected((lines) => {
      const existing = lines.find((line) => line.part.id === part.id);

      if (!existing) {
        return [...lines, { part, qty: 1 }];
      }

      if (existing.qty >= part.availableQty) {
        toast.error(`Only ${part.availableQty} available for ${part.name}.`);
        return lines;
      }

      return lines.map((line) =>
        line.part.id === part.id ? { ...line, qty: line.qty + 1 } : line,
      );
    });
  };

  const changeQty = (partId: string, delta: number) => {
    setSelected((lines) =>
      lines.map((line) => {
        if (line.part.id !== partId) return line;
        const next = Math.min(line.part.availableQty, Math.max(1, line.qty + delta));
        return { ...line, qty: next };
      }),
    );
  };

  const removePart = (partId: string) => {
    setSelected((lines) => lines.filter((line) => line.part.id !== partId));
  };

  const addLabor = laborForm.handleSubmit((values) => {
    const amountCentavos = parsePesoToCentavos(values.amount);

    if (amountCentavos === null) {
      return;
    }

    setLaborLines((lines) => [...lines, { description: values.description, amountCentavos }]);
    laborForm.reset({ description: '', amount: '' });
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!isOnline) {
      toast.error('You are offline. Reconnect before creating a ticket.');
      return;
    }

    if (selected.length === 0 && laborLines.length === 0) {
      toast.error('Add at least one part or labor line.');
      return;
    }

    try {
      const ticket = await createTicket.mutateAsync({
        type: values.type,
        customerName: values.customerName || null,
        bikeModel: values.bikeModel || null,
        notes: values.notes || null,
        items: selected.map((line) => ({ partId: line.part.id, qty: line.qty })),
        labor: laborLines,
      });

      toast.success(`Ticket ${ticket.ticketNo} created.`);
      onOpenChange(false);
      navigate(`/bay/ticket/${ticket.id}`);
    } catch {
      // The mutation error is rendered below.
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">New ticket</SheetTitle>
          <SheetDescription>
            Add the customer, parts, and labor. Stock is reserved when the ticket is created.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              {(['REPAIR', 'SALE'] as TicketType[]).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={type === option ? 'default' : 'outline'}
                  size="touch"
                  aria-pressed={type === option}
                  onClick={() => form.setValue('type', option, { shouldValidate: true })}
                >
                  {ticketTypeLabel(option)}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ticket-customer">Customer name</Label>
                <Input
                  id="ticket-customer"
                  placeholder="Optional"
                  {...form.register('customerName')}
                />
                {form.formState.errors.customerName ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.customerName.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="ticket-bike">Bike model</Label>
                <Input id="ticket-bike" placeholder="Optional" {...form.register('bikeModel')} />
                {form.formState.errors.bikeModel ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.bikeModel.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="ticket-notes">Notes</Label>
              <Textarea
                id="ticket-notes"
                rows={2}
                placeholder="Optional"
                {...form.register('notes')}
              />
              {form.formState.errors.notes ? (
                <p role="alert" className="text-danger mt-1 text-sm">
                  {form.formState.errors.notes.message}
                </p>
              ) : null}
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Parts</h2>
                <p className="text-steel font-mono text-sm tabular-nums">
                  {formatCentavos(partsTotal)}
                </p>
              </div>

              {selected.length > 0 ? (
                <ul className="divide-line border-line divide-y rounded-md border">
                  {selected.map((line) => (
                    <li key={line.part.id} className="flex items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{line.part.name}</p>
                        <p className="text-steel text-xs">
                          {formatCentavos(line.part.unitPriceCentavos)} each ·{' '}
                          {line.part.availableQty} available
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Reduce ${line.part.name} quantity`}
                          onClick={() => changeQty(line.part.id, -1)}
                        >
                          <Minus aria-hidden="true" />
                        </Button>
                        <span className="w-8 text-center font-mono tabular-nums">{line.qty}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Increase ${line.part.name} quantity`}
                          onClick={() => changeQty(line.part.id, 1)}
                        >
                          <Plus aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${line.part.name}`}
                          onClick={() => removePart(line.part.id)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              <PartPicker isOnline={isOnline} onPick={addPart} />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Labor</h2>
                <p className="text-steel font-mono text-sm tabular-nums">
                  {formatCentavos(laborTotal)}
                </p>
              </div>

              {laborLines.length > 0 ? (
                <ul className="divide-line border-line divide-y rounded-md border">
                  {laborLines.map((line, index) => (
                    <li
                      key={`${line.description}-${index}`}
                      className="flex items-center gap-2 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{line.description}</p>
                        <p className="text-steel font-mono text-xs tabular-nums">
                          {formatCentavos(line.amountCentavos)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove labor ${line.description}`}
                        onClick={() =>
                          setLaborLines((lines) => lines.filter((_, item) => item !== index))
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
                <div>
                  <Label htmlFor="labor-description">Labor description</Label>
                  <Input
                    id="labor-description"
                    placeholder="Replace brake pads"
                    {...laborForm.register('description')}
                  />
                  {laborForm.formState.errors.description ? (
                    <p role="alert" className="text-danger mt-1 text-sm">
                      {laborForm.formState.errors.description.message}
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="labor-amount">Amount (₱)</Label>
                  <Input
                    id="labor-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...laborForm.register('amount')}
                  />
                  {laborForm.formState.errors.amount ? (
                    <p role="alert" className="text-danger mt-1 text-sm">
                      {laborForm.formState.errors.amount.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    className="w-full"
                    onClick={() => void addLabor()}
                  >
                    Add labor
                  </Button>
                </div>
              </div>
            </section>

            {createTicket.error ? (
              <p
                role="alert"
                className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
              >
                {createTicket.error.message}
              </p>
            ) : null}

            {!isOnline ? (
              <output className="text-warn block text-sm">
                You are offline. Creating tickets is disabled until the connection returns.
              </output>
            ) : null}
          </div>

          <SheetFooter>
            <div className="border-line flex items-center justify-between border-b pb-3">
              <span className="text-ink-soft text-sm">Ticket total</span>
              <span className="font-display text-2xl font-bold tabular-nums">
                {formatCentavos(total)}
              </span>
            </div>
            <Button type="submit" size="touch" disabled={createTicket.isPending || !isOnline}>
              {createTicket.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Create ticket
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
