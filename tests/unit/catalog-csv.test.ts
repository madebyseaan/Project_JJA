import { describe, expect, test } from 'vitest';

import { parseCatalogCsv } from '@/features/sales/catalog-csv';

const csv = `Active Status,Type,Item,Description,Account,COGS Account,Asset Account,Preferred Vendor,Price,MPN
Active,Inventory Part,Brake pad,Front pad,Merchandise Sales,Cost of Goods Sold,Inventory Asset,Supplier A,150.00,BP-01
Not-active,Inventory Part,Old pad,Old stock,Merchandise Sales,Cost of Goods Sold,Inventory Asset,Supplier A,100.00,
Active,Service,Install labor,Install,Service Income,,, ,200.00,
Active,Inventory Part,Spark plug,,Merchandise Sales,Cost of Goods Sold,Inventory Asset,,85.50,SP-01
`;

describe('parseCatalogCsv', () => {
  test('imports active inventory parts and skips other types', () => {
    const result = parseCatalogCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      name: 'Brake pad',
      description: 'Front pad',
      sku: 'BP-01',
      basePriceCentavos: 15000,
      incomeAccount: 'Merchandise Sales',
      isActive: true,
    });
    expect(result.items[1]).toMatchObject({
      name: 'Spark plug',
      sku: 'SP-01',
      basePriceCentavos: 8550,
    });
  });

  test('reports missing columns', () => {
    const result = parseCatalogCsv('Item,Price\nBrake pad,10');

    expect(result.items).toEqual([]);
    expect(result.errors[0]).toContain('Missing columns: Type');
  });

  test('rejects a negative price', () => {
    const result = parseCatalogCsv(
      'Active Status,Type,Item,Price\nActive,Inventory Part,Brake pad,-10\n',
    );

    expect(result.items).toEqual([]);
    expect(result.errors[0]).toContain('invalid price');
  });
});
