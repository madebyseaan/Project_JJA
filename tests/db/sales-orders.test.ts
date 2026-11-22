import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createStaffUser, getAnonClient, getServiceClient, signInAs } from '../setup/db';

const password = 'test-password-123';

type TestUser = { id: string; employeeId: string; email: string; password: string };
type Order = {
  id: string;
  order_no: string;
  parts_total_centavos: number;
  labor_total_centavos: number;
  total_centavos: number;
  public_token: string;
};

let uncle: TestUser;
let dad: TestUser;
let uncleClient: SupabaseClient;
let dadClient: SupabaseClient;
const orderIds: string[] = [];
const catalogIds: string[] = [];

async function importCatalog(client: SupabaseClient, items: unknown[]) {
  const { data, error } = await client.rpc('import_catalog_items', { p_items: items });
  if (error) throw error;
  return data as { inserted: number; updated: number; skipped: number };
}

async function saveOrder(
  client: SupabaseClient,
  input: {
    orderId?: string | null;
    mainUserId: string;
    helperUserId?: string | null;
    items: {
      catalog_item_id: string;
      qty: number;
      unit_price_centavos: number;
      is_custom: boolean;
    }[];
    labor: number;
    helperLabor?: number;
    extras?: { user_id: string; amount_centavos: number; note?: string | null }[];
    payments: { method: string; amount_centavos: number; gcash_recipient_id?: string | null }[];
    changes?: { method: string; amount_centavos: number; gcash_recipient_id?: string | null }[];
    date?: string;
  },
) {
  const { data, error } = await client.rpc('save_sales_order', {
    p_order_id: input.orderId ?? null,
    p_business_date: input.date ?? new Date().toISOString().slice(0, 10),
    p_customer_name: 'Test Customer',
    p_bike_model: 'Honda Click',
    p_main_user_id: input.mainUserId,
    p_helper_user_id: input.helperUserId ?? null,
    p_items: input.items,
    p_labor_total_centavos: input.labor,
    p_helper_labor_centavos: input.helperLabor ?? 0,
    p_extras: input.extras ?? [],
    p_payments: input.payments,
    p_changes: input.changes ?? [],
  });

  if (error) throw error;
  const order = data as Order;
  orderIds.push(order.id);
  return order;
}

beforeAll(async () => {
  const stamp = Date.now();

  uncle = await createStaffUser({
    employeeId: `JJA-SO${stamp}`,
    password,
    displayName: 'Sales Owner',
    role: 'owner',
  });
  dad = await createStaffUser({
    employeeId: `JJA-SM${stamp}`,
    password,
    displayName: 'Sales Mechanic',
    role: 'mechanic',
  });

  uncleClient = await signInAs(uncle);
  dadClient = await signInAs(dad);

  const result = await importCatalog(uncleClient, [
    {
      name: `Brake pad ${stamp}`,
      description: 'Test pad',
      sku: `BP-${stamp}`,
      base_price_centavos: 15000,
      item_type: 'Inventory Part',
      income_account: 'Merchandise Sales',
      cogs_account: 'Cost of Goods Sold',
      asset_account: 'Inventory Asset',
      preferred_vendor: 'Supplier A',
      is_active: true,
    },
    {
      name: `Spark plug ${stamp}`,
      description: '',
      sku: null,
      base_price_centavos: 8500,
      item_type: 'Inventory Part',
      income_account: 'Merchandise Sales',
      cogs_account: 'Cost of Goods Sold',
      asset_account: 'Inventory Asset',
      preferred_vendor: 'Supplier B',
      is_active: true,
    },
  ]);

  expect(result.inserted).toBe(2);

  const { data } = await uncleClient
    .from('catalog_items')
    .select('id, name')
    .in('name', [`Brake pad ${stamp}`, `Spark plug ${stamp}`]);

  const rows = (data ?? []) as { id: string; name: string }[];
  const brake = rows.find((row) => row.name.startsWith('Brake pad '));
  const spark = rows.find((row) => row.name.startsWith('Spark plug '));

  if (!brake || !spark) {
    throw new Error('Catalog fixture rows were not created.');
  }

  catalogIds.push(brake.id, spark.id);
});

afterAll(async () => {
  const service = getServiceClient();

  if (orderIds.length > 0) {
    await service.from('sales_gcash_allocations').delete().in('order_id', orderIds);
    await service.from('sales_changes').delete().in('order_id', orderIds);
    await service.from('sales_payments').delete().in('order_id', orderIds);
    await service.from('sales_extras').delete().in('order_id', orderIds);
    await service.from('sales_labor').delete().in('order_id', orderIds);
    await service.from('sales_order_items').delete().in('order_id', orderIds);
    await service.from('sales_orders').delete().in('id', orderIds);
  }

  await service.from('gcash_transfers').delete().in('user_id', [uncle.id, dad.id]);
  await service.from('audit_events').delete().eq('entity_type', 'catalog');
  await service.from('catalog_items').delete().in('id', catalogIds);
});

describe('sales orders', () => {
  it('creates an order with items, labor split, extra, mixed payment, and change', async () => {
    const order = await saveOrder(uncleClient, {
      mainUserId: uncle.id,
      helperUserId: dad.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 2,
          unit_price_centavos: 15000,
          is_custom: false,
        },
        {
          catalog_item_id: catalogIds[1] as string,
          qty: 1,
          unit_price_centavos: 8500,
          is_custom: false,
        },
      ],
      labor: 10000,
      helperLabor: 2000,
      extras: [{ user_id: dad.id, amount_centavos: 2000, note: 'Keep the change' }],
      payments: [
        { method: 'CASH', amount_centavos: 30000 },
        { method: 'GCASH', amount_centavos: 22000, gcash_recipient_id: dad.id },
      ],
      changes: [{ method: 'CASH', amount_centavos: 1500 }],
    });

    expect(order.order_no).toMatch(/^SL-\d{8}-\d{4}$/);
    expect(order.parts_total_centavos).toBe(38500);
    expect(order.labor_total_centavos).toBe(10000);
    expect(order.total_centavos).toBe(48500);

    const { data: labor } = await uncleClient
      .from('sales_labor')
      .select('user_id, amount_centavos, is_main')
      .eq('order_id', order.id)
      .order('is_main', { ascending: false });

    expect(labor).toEqual([
      { user_id: uncle.id, amount_centavos: 8000, is_main: true },
      { user_id: dad.id, amount_centavos: 2000, is_main: false },
    ]);

    const { data: extras } = await uncleClient
      .from('sales_extras')
      .select('user_id, amount_centavos')
      .eq('order_id', order.id);
    expect(extras).toEqual([{ user_id: dad.id, amount_centavos: 2000 }]);

    const { data: allocations } = await uncleClient
      .from('sales_gcash_allocations')
      .select('recipient_id, net_gcash_centavos, shop_share_centavos, labor_share_centavos')
      .eq('order_id', order.id);

    expect(allocations?.[0]).toMatchObject({
      recipient_id: dad.id,
      net_gcash_centavos: 22000,
    });
    expect(
      (allocations?.[0]?.shop_share_centavos ?? 0) + (allocations?.[0]?.labor_share_centavos ?? 0),
    ).toBe(22000);
  });

  it('rejects a helper share larger than total labor', async () => {
    const { error } = await uncleClient.rpc('save_sales_order', {
      p_order_id: null,
      p_business_date: new Date().toISOString().slice(0, 10),
      p_customer_name: null,
      p_bike_model: null,
      p_main_user_id: uncle.id,
      p_helper_user_id: dad.id,
      p_items: [
        { catalog_item_id: catalogIds[0], qty: 1, unit_price_centavos: 15000, is_custom: false },
      ],
      p_labor_total_centavos: 1000,
      p_helper_labor_centavos: 2000,
      p_extras: [],
      p_payments: [{ method: 'CASH', amount_centavos: 16000 }],
      p_changes: [],
    });

    expect(error?.message).toBe('INVALID_LABOR_SPLIT');
  });

  it('rejects a payment mismatch', async () => {
    const { error } = await uncleClient.rpc('save_sales_order', {
      p_order_id: null,
      p_business_date: new Date().toISOString().slice(0, 10),
      p_customer_name: null,
      p_bike_model: null,
      p_main_user_id: uncle.id,
      p_helper_user_id: null,
      p_items: [
        { catalog_item_id: catalogIds[0], qty: 1, unit_price_centavos: 15000, is_custom: false },
      ],
      p_labor_total_centavos: 0,
      p_helper_labor_centavos: 0,
      p_extras: [],
      p_payments: [{ method: 'CASH', amount_centavos: 10000 }],
      p_changes: [],
    });

    expect(error?.message).toBe('PAYMENT_MISMATCH');
  });

  it('edits an order and replaces its child rows', async () => {
    const order = await saveOrder(uncleClient, {
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 5000,
      payments: [{ method: 'CASH', amount_centavos: 20000 }],
    });

    const updated = await saveOrder(uncleClient, {
      orderId: order.id,
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 3,
          unit_price_centavos: 16000,
          is_custom: false,
        },
      ],
      labor: 6000,
      payments: [{ method: 'CASH', amount_centavos: 54000 }],
    });

    expect(updated.id).toBe(order.id);
    expect(updated.parts_total_centavos).toBe(48000);
    expect(updated.labor_total_centavos).toBe(6000);

    const { data: items } = await uncleClient
      .from('sales_order_items')
      .select('qty')
      .eq('order_id', order.id);
    expect(items).toEqual([{ qty: 3 }]);
  });

  it('shows daily totals and labor per user', async () => {
    const { data: daily } = await uncleClient
      .from('v_sales_daily')
      .select('business_date, order_count, parts_total_centavos, labor_total_centavos')
      .order('business_date', { ascending: false })
      .limit(1);

    expect(daily?.[0]?.order_count).toBeGreaterThan(0);

    const { data: labor } = await uncleClient
      .from('v_sales_labor_daily')
      .select('user_id, base_labor_centavos, extras_centavos')
      .order('user_id');

    expect((labor ?? []).length).toBeGreaterThan(0);
  });

  it('tracks GCash held and transfers', async () => {
    const balances = await uncleClient.rpc('get_gcash_balances');
    expect(balances.error).toBeNull();
    const rows = balances.data as { user_id: string; shop_held_centavos: number }[];
    const dadBalance = rows.find((row) => row.user_id === dad.id);
    expect(dadBalance?.shop_held_centavos).toBeGreaterThan(0);

    const { error } = await uncleClient.rpc('record_gcash_transfer', {
      p_user_id: dad.id,
      p_amount_centavos: dadBalance?.shop_held_centavos ?? 0,
      p_destination: 'SHOP_BANK',
      p_counterparty_user_id: null,
      p_reference: 'BANK-1',
      p_note: 'Test transfer',
    });
    expect(error).toBeNull();

    const after = await uncleClient.rpc('get_gcash_balances');
    const afterRows = after.data as { user_id: string; shop_held_centavos: number }[];
    expect(afterRows.find((row) => row.user_id === dad.id)?.shop_held_centavos).toBe(0);
  });

  it('serves a public digital receipt by token', async () => {
    const order = await saveOrder(uncleClient, {
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 2000,
      payments: [{ method: 'CASH', amount_centavos: 17000 }],
    });

    const anon = getAnonClient();
    const { data, error } = await anon.rpc('get_sales_receipt', { p_token: order.public_token });
    expect(error).toBeNull();
    expect(data).toMatchObject({ order_no: order.order_no, labor_total_centavos: 2000 });
    expect(data).not.toHaveProperty('labor');
  });

  it('denies anon reads and direct writes', async () => {
    const { error: anonError } = await getAnonClient().from('sales_orders').select('id');
    expect(anonError).toMatchObject({ code: '42501' });

    const { error: insertError } = await dadClient.from('sales_orders').insert({
      order_no: 'HACK',
      business_date: new Date().toISOString().slice(0, 10),
      main_user_id: dad.id,
      created_by: dad.id,
    });
    expect(insertError).toMatchObject({ code: '42501' });
  });
});
