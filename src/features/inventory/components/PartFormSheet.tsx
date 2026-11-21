import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import { formatPesoInput } from '@/lib/money';

import { useCreatePart, useUpdatePart } from '../hooks/use-parts';
import {
  partFormSchema,
  toPartCreateInput,
  toPartUpdateInput,
  type PartFormValues,
} from '../schemas';
import type { Part } from '../types';

type PartFormSheetProps = {
  open: boolean;
  part: Part | null;
  isOnline: boolean;
  onOpenChange: (open: boolean) => void;
};

function toFormValues(part: Part | null): PartFormValues {
  return {
    name: part?.name ?? '',
    sku: part?.sku ?? '',
    category: part?.category ?? 'General',
    models: part?.compatibleModels.join(', ') ?? '',
    unitPrice: part ? formatPesoInput(part.unitPriceCentavos) : '',
    costPrice: part ? formatPesoInput(part.costPriceCentavos) : '',
    stockOnHand: part ? String(part.stockOnHand) : '0',
    lowStockThreshold: part ? String(part.lowStockThreshold) : '3',
    isActive: part?.isActive ?? true,
  };
}

export function PartFormSheet({ open, part, isOnline, onOpenChange }: PartFormSheetProps) {
  const isEdit = part !== null;
  const createPart = useCreatePart();
  const updatePart = useUpdatePart();
  const pending = createPart.isPending || updatePart.isPending;
  const mutationError = createPart.error ?? updatePart.error;

  const form = useForm<PartFormValues>({
    resolver: zodResolver(partFormSchema),
    defaultValues: toFormValues(part),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!isOnline) {
      toast.error('You are offline. Reconnect before saving.');
      return;
    }

    try {
      if (part) {
        await updatePart.mutateAsync({
          partId: part.id,
          input: { ...toPartUpdateInput(values), isActive: values.isActive },
        });
        toast.success('Part updated.');
      } else {
        await createPart.mutateAsync(toPartCreateInput(values));
        toast.success('Part added.');
      }

      onOpenChange(false);
    } catch {
      // The mutation exposes the human message below; do not duplicate the toast.
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">
            {isEdit ? 'Edit part' : 'Add part'}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the catalog details. Use Adjust stock to change the count.'
              : 'Add a part to the catalog with its opening stock.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <div>
              <Label htmlFor="part-name">Part name</Label>
              <Input
                id="part-name"
                {...form.register('name')}
                aria-invalid={Boolean(form.formState.errors.name)}
              />
              {form.formState.errors.name ? (
                <p role="alert" className="text-danger mt-1 text-sm">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="part-sku">SKU</Label>
                <Input id="part-sku" {...form.register('sku')} placeholder="Optional" />
                {form.formState.errors.sku ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.sku.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="part-category">Category</Label>
                <Input
                  id="part-category"
                  placeholder="e.g. Brakes"
                  {...form.register('category')}
                />
                {form.formState.errors.category ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.category.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="part-models">Compatible models</Label>
              <Textarea
                id="part-models"
                rows={2}
                placeholder="Honda Click 125, Yamaha Mio"
                {...form.register('models')}
              />
              <p className="text-steel mt-1 text-xs">Separate models with commas.</p>
              {form.formState.errors.models ? (
                <p role="alert" className="text-danger mt-1 text-sm">
                  {form.formState.errors.models.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="part-price">Selling price (₱)</Label>
                <Input
                  id="part-price"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...form.register('unitPrice')}
                />
                {form.formState.errors.unitPrice ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.unitPrice.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="part-cost">Cost price (₱)</Label>
                <Input
                  id="part-cost"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...form.register('costPrice')}
                />
                {form.formState.errors.costPrice ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.costPrice.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="part-stock">Opening stock</Label>
                <Input
                  id="part-stock"
                  inputMode="numeric"
                  disabled={isEdit}
                  {...form.register('stockOnHand')}
                />
                {isEdit ? (
                  <p className="text-steel mt-1 text-xs">
                    Stock changes only through Adjust stock, so the ledger stays complete.
                  </p>
                ) : null}
                {form.formState.errors.stockOnHand ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.stockOnHand.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="part-low">Low-stock level</Label>
                <Input id="part-low" inputMode="numeric" {...form.register('lowStockThreshold')} />
                {form.formState.errors.lowStockThreshold ? (
                  <p role="alert" className="text-danger mt-1 text-sm">
                    {form.formState.errors.lowStockThreshold.message}
                  </p>
                ) : null}
              </div>
            </div>

            {isEdit ? (
              <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
                <input type="checkbox" className="size-5" {...form.register('isActive')} />
                Active in the catalog
              </label>
            ) : null}

            {mutationError ? (
              <p
                role="alert"
                className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
              >
                {mutationError.message}
              </p>
            ) : null}

            {!isOnline ? (
              <output className="text-warn block text-sm">
                You are offline. Saving is disabled until the connection returns.
              </output>
            ) : null}
          </div>

          <SheetFooter>
            <Button type="submit" size="touch" disabled={pending || !isOnline} className="w-full">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {isEdit ? 'Save changes' : 'Add part'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
