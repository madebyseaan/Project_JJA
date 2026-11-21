import { z } from 'zod';

import { parsePesoToCentavos } from '@/lib/money';

const MAX_STOCK = 1_000_000;

function pesoString(label: string) {
  return z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .refine((value) => {
      const centavos = parsePesoToCentavos(value);
      return centavos !== null && centavos >= 0;
    }, 'Enter a valid peso amount.');
}

function wholeNumberString(label: string, max = MAX_STOCK) {
  return z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .regex(/^\d+$/, 'Enter a whole number.')
    .refine((value) => Number(value) <= max, `Keep ${label} at ${max.toLocaleString()} or below.`);
}

export const partFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the part name.')
    .max(120, 'Keep the name under 120 characters.'),
  sku: z.string().trim().max(60, 'Keep the SKU under 60 characters.'),
  category: z
    .string()
    .trim()
    .min(1, 'Enter a category.')
    .max(60, 'Keep the category under 60 characters.'),
  models: z
    .string()
    .trim()
    .max(300, 'Keep compatible models under 300 characters.')
    .refine((value) => {
      const models = value
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);
      return models.length <= 20 && models.every((model) => model.length <= 60);
    }, 'Use up to 20 models, each under 60 characters.'),
  unitPrice: pesoString('the selling price'),
  costPrice: pesoString('the cost price'),
  stockOnHand: wholeNumberString('the opening stock'),
  lowStockThreshold: wholeNumberString('the low-stock level'),
  isActive: z.boolean(),
});

export type PartFormValues = z.infer<typeof partFormSchema>;

export const stockAdjustmentSchema = z
  .object({
    delta: z
      .string()
      .trim()
      .min(1, 'Enter a quantity.')
      .regex(/^-?\d+$/, 'Enter a whole number; use a minus sign to reduce stock.')
      .refine((value) => Number(value) !== 0, 'Enter a quantity other than zero.'),
    reason: z.enum(['RESTOCK', 'ADJUSTMENT']),
    note: z.string().trim().max(500, 'Keep the note under 500 characters.'),
  })
  .superRefine((values, context) => {
    if (values.reason === 'RESTOCK' && Number(values.delta) < 0) {
      context.addIssue({
        code: 'custom',
        path: ['delta'],
        message: 'A restock quantity must be positive.',
      });
    }
  });

export type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>;

export function splitModels(value: string): string[] {
  return value
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

export function toPartCreateInput(values: PartFormValues) {
  return {
    name: values.name,
    sku: values.sku || null,
    category: values.category,
    compatibleModels: splitModels(values.models),
    unitPriceCentavos: parsePesoToCentavos(values.unitPrice) ?? 0,
    costPriceCentavos: parsePesoToCentavos(values.costPrice) ?? 0,
    stockOnHand: Number(values.stockOnHand),
    lowStockThreshold: Number(values.lowStockThreshold),
  };
}

export function toPartUpdateInput(values: PartFormValues) {
  return {
    name: values.name,
    sku: values.sku || null,
    category: values.category,
    compatibleModels: splitModels(values.models),
    unitPriceCentavos: parsePesoToCentavos(values.unitPrice) ?? 0,
    costPriceCentavos: parsePesoToCentavos(values.costPrice) ?? 0,
    lowStockThreshold: Number(values.lowStockThreshold),
    isActive: values.isActive,
  };
}
