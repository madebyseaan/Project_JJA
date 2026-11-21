import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Settings } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { useShopSettings, useUpdateShopSettings } from './hooks/use-owner';
import { shopSettingsSchema, toShopSettings, type ShopSettingsValues } from './schemas';
import type { ShopSettings } from './types';

function SettingsForm({ initial }: { initial: ShopSettings }) {
  const update = useUpdateShopSettings();
  const form = useForm<ShopSettingsValues>({
    resolver: zodResolver(shopSettingsSchema),
    defaultValues: {
      shopName: initial.shopName,
      address: initial.address,
      contact: initial.contact,
      receiptFooter: initial.receiptFooter,
      lowStockDefault: String(initial.lowStockDefault),
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(toShopSettings(values));
      toast.success('Shop settings saved.');
    } catch {
      // The mutation error is rendered below.
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <div>
        <Label htmlFor="settings-name">Shop name</Label>
        <Input id="settings-name" {...form.register('shopName')} />
        {form.formState.errors.shopName ? (
          <p role="alert" className="text-danger mt-1 text-sm">
            {form.formState.errors.shopName.message}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="settings-address">Address</Label>
        <Textarea id="settings-address" rows={2} {...form.register('address')} />
        {form.formState.errors.address ? (
          <p role="alert" className="text-danger mt-1 text-sm">
            {form.formState.errors.address.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="settings-contact">Contact</Label>
          <Input id="settings-contact" {...form.register('contact')} />
          {form.formState.errors.contact ? (
            <p role="alert" className="text-danger mt-1 text-sm">
              {form.formState.errors.contact.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="settings-low-stock">Default low-stock level</Label>
          <Input
            id="settings-low-stock"
            inputMode="numeric"
            {...form.register('lowStockDefault')}
          />
          {form.formState.errors.lowStockDefault ? (
            <p role="alert" className="text-danger mt-1 text-sm">
              {form.formState.errors.lowStockDefault.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <Label htmlFor="settings-footer">Receipt footer</Label>
        <Textarea
          id="settings-footer"
          rows={2}
          placeholder="Thank you for your business."
          {...form.register('receiptFooter')}
        />
        {form.formState.errors.receiptFooter ? (
          <p role="alert" className="text-danger mt-1 text-sm">
            {form.formState.errors.receiptFooter.message}
          </p>
        ) : null}
      </div>

      {update.error ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
        >
          {update.error.message}
        </p>
      ) : null}

      <Button type="submit" size="touch" disabled={update.isPending}>
        {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Save settings
      </Button>
    </form>
  );
}

export function OwnerSettingsPage() {
  const settings = useShopSettings();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Shop details copied into every receipt." />

      <div className="border-line bg-surface max-w-2xl rounded-lg border p-4 sm:p-5">
        {settings.isPending ? (
          <output className="block space-y-3" aria-label="Loading shop settings">
            <Skeleton className="block h-12 w-full" />
            <Skeleton className="block h-20 w-full" />
            <Skeleton className="block h-12 w-full" />
          </output>
        ) : settings.isError ? (
          <div role="alert">
            <p className="text-danger font-medium">Could not load shop settings.</p>
            <p className="text-ink-soft mt-1 text-sm">{settings.error.message}</p>
            <Button
              variant="outline"
              size="touch"
              className="mt-3"
              onClick={() => void settings.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <SettingsForm key="shop-settings" initial={settings.data} />
        )}
      </div>

      <Button variant="ghost" size="touch" render={<Link to="/owner" />}>
        <Settings aria-hidden="true" />
        Back to the owner dashboard
      </Button>
    </div>
  );
}
