import { z } from 'zod';

import { parsePesoToCentavos } from '@/lib/money';

export const closeDaySchema = z.object({
  countedCash: z
    .string()
    .trim()
    .min(1, 'Enter the counted cash.')
    .refine((value) => {
      const centavos = parsePesoToCentavos(value);
      return centavos !== null && centavos >= 0;
    }, 'Enter a valid cash amount.'),
  notes: z.string().trim().max(500, 'Keep the note under 500 characters.'),
});

export type CloseDayValues = z.infer<typeof closeDaySchema>;

export const shopSettingsSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(1, 'Enter the shop name.')
    .max(120, 'Keep the shop name under 120 characters.'),
  address: z.string().trim().max(300, 'Keep the address under 300 characters.'),
  contact: z.string().trim().max(120, 'Keep the contact under 120 characters.'),
  receiptFooter: z.string().trim().max(300, 'Keep the footer under 300 characters.'),
  lowStockDefault: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Enter a whole number.')
    .refine((value) => Number(value) <= 1_000_000, 'Keep the default at 1,000,000 or below.'),
});

export type ShopSettingsValues = z.infer<typeof shopSettingsSchema>;

export function toShopSettings(values: ShopSettingsValues) {
  return {
    shopName: values.shopName,
    address: values.address,
    contact: values.contact,
    receiptFooter: values.receiptFooter,
    lowStockDefault: Number(values.lowStockDefault),
  };
}
