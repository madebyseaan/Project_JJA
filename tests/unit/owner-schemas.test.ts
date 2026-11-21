import { describe, expect, test } from 'vitest';

import { closeDaySchema, shopSettingsSchema, toShopSettings } from '@/features/owner/schemas';

describe('owner schemas', () => {
  test('validates counted cash and notes', () => {
    expect(closeDaySchema.safeParse({ countedCash: '1,250.50', notes: '' }).success).toBe(true);
    expect(closeDaySchema.safeParse({ countedCash: '-1', notes: '' }).success).toBe(false);
    expect(closeDaySchema.safeParse({ countedCash: 'abc', notes: '' }).success).toBe(false);
    expect(closeDaySchema.safeParse({ countedCash: '10', notes: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });

  test('validates shop settings and converts the default', () => {
    const parsed = shopSettingsSchema.parse({
      shopName: 'J.J.A Motor Accessories',
      address: 'Manila',
      contact: '0917',
      receiptFooter: 'Thank you',
      lowStockDefault: '4',
    });

    expect(toShopSettings(parsed)).toMatchObject({
      shopName: 'J.J.A Motor Accessories',
      lowStockDefault: 4,
    });

    expect(
      shopSettingsSchema.safeParse({
        shopName: '',
        address: '',
        contact: '',
        receiptFooter: '',
        lowStockDefault: '4',
      }).success,
    ).toBe(false);
  });
});
