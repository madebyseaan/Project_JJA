import { describe, expect, test } from 'vitest';

import {
  partFormSchema,
  splitModels,
  stockAdjustmentSchema,
  toPartCreateInput,
} from '@/features/inventory/schemas';

const validForm = {
  name: 'Brake pad',
  sku: 'BP-01',
  category: 'Brakes',
  models: 'Honda Click 125, Yamaha Mio',
  unitPrice: '150.00',
  costPrice: '90',
  stockOnHand: '10',
  lowStockThreshold: '3',
  isActive: true,
};

describe('part form schema', () => {
  test('accepts a valid part and converts pesos to centavos', () => {
    const parsed = partFormSchema.parse(validForm);
    const input = toPartCreateInput(parsed);

    expect(input.unitPriceCentavos).toBe(15000);
    expect(input.costPriceCentavos).toBe(9000);
    expect(input.stockOnHand).toBe(10);
    expect(input.compatibleModels).toEqual(['Honda Click 125', 'Yamaha Mio']);
  });

  test('rejects invalid money and negative stock', () => {
    const badMoney = partFormSchema.safeParse({ ...validForm, unitPrice: '1.234' });
    expect(badMoney.success).toBe(false);

    const badStock = partFormSchema.safeParse({ ...validForm, stockOnHand: '-1' });
    expect(badStock.success).toBe(false);
  });

  test('rejects more than 20 compatible models', () => {
    const models = Array.from({ length: 21 }, (_, index) => `Model ${index}`).join(', ');
    const result = partFormSchema.safeParse({ ...validForm, models });
    expect(result.success).toBe(false);
  });
});

describe('stock adjustment schema', () => {
  test('allows a negative adjustment and rejects a negative restock', () => {
    expect(
      stockAdjustmentSchema.safeParse({ delta: '-4', reason: 'ADJUSTMENT', note: 'Count' }).success,
    ).toBe(true);

    expect(
      stockAdjustmentSchema.safeParse({ delta: '-4', reason: 'RESTOCK', note: '' }).success,
    ).toBe(false);
  });

  test('rejects zero and junk quantities', () => {
    expect(
      stockAdjustmentSchema.safeParse({ delta: '0', reason: 'RESTOCK', note: '' }).success,
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({ delta: '2.5', reason: 'RESTOCK', note: '' }).success,
    ).toBe(false);
  });
});

test('splitModels trims and drops empty entries', () => {
  expect(splitModels(' Honda Click , , Yamaha Mio ')).toEqual(['Honda Click', 'Yamaha Mio']);
});
