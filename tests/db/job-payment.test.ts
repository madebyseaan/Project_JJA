import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createStaffUser, getAnonClient, getServiceClient, signInAs } from '../setup/db';

const password = 'test-password-123';

function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type TestUser = { id: string; employeeId: string; email: string; password: string };
type Order = {
  id: string;
  order_no: string;
  business_date: string;
  paid_on: string | null;
  status: 'OPEN' | 'PAID' | 'EXPORTED';
  parts_total_centavos: number;
  labor_total_centavos: number;
  total_centavos: number;
  public_token: string;
};

let uncle: TestUser;
let dad: TestUser;
let uncleClient: SupabaseClient;
const orderIds: string[] = [];
const catalogIds: string[] = [];

async function importCatalog(client: SupabaseClient, items: unknown[]) {
  const { data, error } = await client.rpc('import_catalog_items', { p_items: items });
  if (error) throw error;
  return data as { inserted: number; updated: number; skipped: number };
}

function manilaDateOffset(days: number): string {
  const date = new Date(`${manilaToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type SaveOrderInput = {
  orderId?: string | null;
  mainUserId: string;
  helperUserId?: string | null;
  items: {
    catalog_item_id: string | null;
    item_name?: string | null;
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
  paidOn?: string | null;
};

function saveOrderPayload(input: SaveOrderInput) {
  return {
    p_order_id: input.orderId ?? null,
    p_business_date: input.date ?? manilaToday(),
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
    p_paid_on: input.paidOn === undefined ? manilaToday() : input.paidOn,
  };
}

async function saveOrder(client: SupabaseClient, input: SaveOrderInput) {
  const { data, error } = await client.rpc('save_sales_order', saveOrderPayload(input));

  if (error) throw error;
  const order = data as Order;
  orderIds.push(order.id);
  return order;
}

async function saveOrderError(client: SupabaseClient, input: SaveOrderInput) {
  const { error } = await client.rpc('save_sales_order', saveOrderPayload(input));
  return error;
}

beforeAll(async () => {
  const stamp = Date.now();

  uncle = await createStaffUser({
    employeeId: `JJA-JP${stamp}`,
    password,
    displayName: 'Sales Owner',
    role: 'owner',
  });
  dad = await createStaffUser({
    employeeId: `JJA-JM${stamp}`,
    password,
    displayName: 'Sales Mechanic',
    role: 'mechanic',
  });

  uncleClient = await signInAs(uncle);

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

describe('job payments', () => {
  it('saves an unpaid job and then pays it on a later date', async () => {
    const jobDate = manilaDateOffset(-120);
    const paidDate = manilaDateOffset(-119);

    const beforeBalances = await uncleClient.rpc('get_gcash_balances');
    const beforeEarned =
      (beforeBalances.data as { user_id: string; labor_earned_centavos: number }[]).find(
        (row) => row.user_id === uncle.id,
      )?.labor_earned_centavos ?? 0;

    const job = await saveOrder(uncleClient, {
      mainUserId: uncle.id,
      date: jobDate,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 5000,
      payments: [],
      paidOn: null,
    });

    expect(job.status).toBe('OPEN');
    expect(job.paid_on).toBeNull();

    const openBalances = await uncleClient.rpc('get_gcash_balances');
    const afterOpenEarned =
      (openBalances.data as { user_id: string; labor_earned_centavos: number }[]).find(
        (row) => row.user_id === uncle.id,
      )?.labor_earned_centavos ?? 0;
    expect(afterOpenEarned).toBe(beforeEarned);

    const { data: unsold } = await uncleClient
      .from('v_sales_daily')
      .select('paid_on')
      .eq('paid_on', jobDate)
      .maybeSingle();
    expect(unsold).toBeNull();

    const paid = await saveOrder(uncleClient, {
      orderId: job.id,
      mainUserId: uncle.id,
      date: jobDate,
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
      paidOn: paidDate,
    });

    expect(paid.status).toBe('PAID');
    expect(paid.paid_on).toBe(paidDate);

    const { data: daily } = await uncleClient
      .from('v_sales_daily')
      .select('paid_on,order_count,parts_total_centavos,labor_total_centavos,total_centavos')
      .eq('paid_on', paidDate)
      .single();

    expect(daily).toEqual({
      paid_on: paidDate,
      order_count: 1,
      parts_total_centavos: 15000,
      labor_total_centavos: 5000,
      total_centavos: 20000,
    });

    const { data: labor } = await uncleClient
      .from('v_sales_labor_daily')
      .select('paid_on,user_id,base_labor_centavos')
      .eq('paid_on', paidDate);

    expect(labor).toEqual([{ paid_on: paidDate, user_id: uncle.id, base_labor_centavos: 5000 }]);

    const { data: payment } = await uncleClient
      .from('v_sales_payments_daily')
      .select('paid_on,method,net_centavos')
      .eq('paid_on', paidDate);

    expect(payment).toEqual([{ paid_on: paidDate, method: 'CASH', net_centavos: 20000 }]);

    const paidBalances = await uncleClient.rpc('get_gcash_balances');
    const afterPaidEarned =
      (paidBalances.data as { user_id: string; labor_earned_centavos: number }[]).find(
        (row) => row.user_id === uncle.id,
      )?.labor_earned_centavos ?? 0;
    expect(afterPaidEarned).toBe(beforeEarned + 5000);
  });

  it('rejects a payment date before the job date or in the future', async () => {
    const jobDate = manilaDateOffset(-10);

    const job = await saveOrder(uncleClient, {
      mainUserId: uncle.id,
      date: jobDate,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [],
      paidOn: null,
    });

    const beforeJob = await saveOrderError(uncleClient, {
      orderId: job.id,
      mainUserId: uncle.id,
      date: jobDate,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
      paidOn: manilaDateOffset(-11),
    });
    expect(beforeJob?.message).toBe('INVALID_DATE');

    const future = await saveOrderError(uncleClient, {
      orderId: job.id,
      mainUserId: uncle.id,
      date: jobDate,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
      paidOn: manilaDateOffset(1),
    });
    expect(future?.message).toBe('INVALID_DATE');
  });

  it('does not allow a paid order to become unpaid', async () => {
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
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
    });

    const error = await saveOrderError(uncleClient, {
      orderId: order.id,
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [],
      paidOn: null,
    });

    expect(error?.message).toBe('PAYMENT_REQUIRED');
  });

  it('rejects extras without a payment', async () => {
    const error = await saveOrderError(uncleClient, {
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      extras: [{ user_id: uncle.id, amount_centavos: 1000 }],
      payments: [],
      paidOn: null,
    });

    expect(error?.message).toBe('PAYMENT_REQUIRED');
  });

  it('requires rebalancing after changing a paid order', async () => {
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
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
    });

    const mismatch = await saveOrderError(uncleClient, {
      orderId: order.id,
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 2,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
    });
    expect(mismatch?.message).toBe('PAYMENT_MISMATCH');

    const rebalanced = await saveOrder(uncleClient, {
      orderId: order.id,
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 2,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 30000 }],
    });

    expect(rebalanced.status).toBe('PAID');
    expect(rebalanced.total_centavos).toBe(30000);
  });

  it('does not serve a public receipt for an unpaid job', async () => {
    const job = await saveOrder(uncleClient, {
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [],
      paidOn: null,
    });

    const anon = getAnonClient();
    const { data, error } = await anon.rpc('get_sales_receipt', { p_token: job.public_token });

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('moves a paid job date only when the payment date stays valid', async () => {
    const jobDate = manilaDateOffset(-2);
    const order = await saveOrder(uncleClient, {
      mainUserId: uncle.id,
      date: jobDate,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
      paidOn: jobDate,
    });

    const invalid = await saveOrderError(uncleClient, {
      orderId: order.id,
      mainUserId: uncle.id,
      date: manilaDateOffset(-1),
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
      paidOn: jobDate,
    });
    expect(invalid?.message).toBe('INVALID_DATE');

    const moved = await saveOrder(uncleClient, {
      orderId: order.id,
      mainUserId: uncle.id,
      date: manilaDateOffset(-1),
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
      paidOn: manilaDateOffset(-1),
    });

    expect(moved.status).toBe('PAID');
    expect(moved.paid_on).toBe(manilaDateOffset(-1));
  });

  it('enforces the paid-date constraints and locks exported orders', async () => {
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
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
    });

    const service = getServiceClient();
    const { error: nullPaidOn } = await service
      .from('sales_orders')
      .update({ status: 'PAID', paid_on: null })
      .eq('id', order.id);
    expect(nullPaidOn?.code).toBe('23514');

    const { error: earlyPaidOn } = await service
      .from('sales_orders')
      .update({ status: 'PAID', paid_on: manilaDateOffset(-1) })
      .eq('id', order.id);
    expect(earlyPaidOn?.code).toBe('23514');

    const { error: exportError } = await service
      .from('sales_orders')
      .update({ status: 'EXPORTED', paid_on: manilaToday() })
      .eq('id', order.id);
    expect(exportError).toBeNull();

    const locked = await saveOrderError(uncleClient, {
      orderId: order.id,
      mainUserId: uncle.id,
      items: [
        {
          catalog_item_id: catalogIds[0] as string,
          qty: 1,
          unit_price_centavos: 15000,
          is_custom: false,
        },
      ],
      labor: 0,
      payments: [{ method: 'CASH', amount_centavos: 15000 }],
    });
    expect(locked?.message).toBe('ORDER_LOCKED');
  });
});
