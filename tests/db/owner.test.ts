import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { manilaDateKey } from '@/lib/dates';
import { createStaffUser, getAnonClient, getServiceClient, signInAs } from '../setup/db';

const password = 'test-password-123';

type TestUser = { id: string; employeeId: string; email: string; password: string };

let owner: TestUser;
let mechanic: TestUser;
let ownerClient: SupabaseClient;
let mechanicClient: SupabaseClient;
const ticketIds: string[] = [];
const partIds: string[] = [];

async function createPart(stock = 5) {
  const { data, error } = await ownerClient.rpc('create_part', {
    p_name: `Owner test part ${Date.now()}-${partIds.length}`,
    p_sku: null,
    p_category: 'Test',
    p_compatible_models: [],
    p_unit_price_centavos: 30000,
    p_cost_price_centavos: 10000,
    p_stock_on_hand: stock,
    p_low_stock_threshold: 5,
  });

  if (error) throw error;
  const id = (data as { id: string }).id;
  partIds.push(id);
  return id;
}

async function createCompletedSale() {
  const partId = await createPart();

  const { data: ticketData, error: ticketError } = await mechanicClient.rpc('create_ticket', {
    p_type: 'SALE',
    p_customer_name: 'Owner Test',
    p_bike_model: 'Honda Click',
    p_notes: null,
    p_items: [{ part_id: partId, qty: 1 }],
    p_labor: [{ description: 'Install', amount_centavos: 5000 }],
  });

  if (ticketError) throw ticketError;
  const ticket = ticketData as { id: string };
  ticketIds.push(ticket.id);

  await mechanicClient.rpc('verify_all_ticket_items', { p_ticket_id: ticket.id });

  const { error: depositError } = await mechanicClient.rpc('record_payment', {
    p_ticket_id: ticket.id,
    p_method: 'GCASH',
    p_amount_centavos: 10000,
    p_reference_no: 'REF-1',
    p_note: 'Deposit',
  });
  if (depositError) throw depositError;

  const { error: completeError } = await mechanicClient.rpc('complete_ticket', {
    p_ticket_id: ticket.id,
    p_payments: [{ method: 'CASH', amount_centavos: 25000, reference_no: null, note: null }],
  });
  if (completeError) throw completeError;
}

beforeAll(async () => {
  const stamp = Date.now();

  owner = await createStaffUser({
    employeeId: `JJA-DO${stamp}`,
    password,
    displayName: 'Dashboard Owner',
    role: 'owner',
  });

  mechanic = await createStaffUser({
    employeeId: `JJA-DM${stamp}`,
    password,
    displayName: 'Dashboard Mechanic',
    role: 'mechanic',
  });

  ownerClient = await signInAs(owner);
  mechanicClient = await signInAs(mechanic);
});

afterAll(async () => {
  const service = getServiceClient();
  const date = manilaDateKey();

  await service.from('day_closes').delete().eq('business_date', date);

  if (ticketIds.length > 0) {
    await service.from('stock_movements').delete().in('ticket_id', ticketIds);
    await service.from('ticket_payments').delete().in('ticket_id', ticketIds);
    await service.from('receipts').delete().in('ticket_id', ticketIds);
    await service.from('ticket_items').delete().in('ticket_id', ticketIds);
    await service.from('ticket_labor').delete().in('ticket_id', ticketIds);
    await service.from('audit_events').delete().in('entity_id', ticketIds);
    await service.from('tickets').delete().in('id', ticketIds);
  }

  if (partIds.length > 0) {
    await service.from('stock_movements').delete().in('part_id', partIds);
    await service.from('audit_events').delete().in('entity_id', partIds);
    await service.from('parts').delete().in('id', partIds);
  }

  await service.from('shop_settings').update({
    shop_name: 'J.J.A Motor Accessories and Motorcycle Repair Shop',
    address: '',
    contact: '',
    receipt_footer: '',
    low_stock_default: 3,
  });
});

describe('owner dashboard and day close', () => {
  it('summarises sales, payments, and low stock', async () => {
    await createCompletedSale();
    const date = manilaDateKey();

    const { data, error } = await ownerClient.rpc('get_daily_summary', {
      p_business_date: date,
    });

    expect(error).toBeNull();
    const summary = data as {
      sales: {
        receipt_count: number;
        parts_centavos: number;
        labor_centavos: number;
        total_centavos: number;
      };
      payments: { cash_centavos: number; gcash_centavos: number; total_centavos: number };
      expected_cash_centavos: number;
      low_stock: { id: string }[];
      day_close: unknown;
    };

    expect(summary.sales.receipt_count).toBeGreaterThan(0);
    expect(summary.sales.parts_centavos).toBeGreaterThanOrEqual(30000);
    expect(summary.sales.total_centavos).toBeGreaterThanOrEqual(35000);
    expect(summary.payments.cash_centavos).toBe(25000);
    expect(summary.payments.gcash_centavos).toBe(10000);
    expect(summary.expected_cash_centavos).toBe(25000);
    expect(summary.day_close).toBeNull();
    expect(summary.low_stock.length).toBeGreaterThan(0);
  });

  it('stores a day close with the expected cash and variance', async () => {
    const date = manilaDateKey();

    const { data, error } = await ownerClient.rpc('close_day', {
      p_business_date: date,
      p_counted_cash: 24000,
      p_notes: 'Counted at close',
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      expected_cash_centavos: 25000,
      counted_cash_centavos: 24000,
      variance_centavos: -1000,
    });

    const { data: stored } = await ownerClient
      .from('day_closes')
      .select('business_date, variance_centavos')
      .eq('business_date', date)
      .single();
    expect(stored?.variance_centavos).toBe(-1000);
  });

  it('recomputes a corrected close and audits it', async () => {
    const date = manilaDateKey();

    const { error } = await ownerClient.rpc('close_day', {
      p_business_date: date,
      p_counted_cash: 25000,
      p_notes: 'Recount',
    });
    expect(error).toBeNull();

    const { data: audits } = await ownerClient
      .from('audit_events')
      .select('action')
      .eq('action', 'day.corrected');
    expect(audits?.length).toBeGreaterThan(0);
  });

  it('lets the owner update shop settings and rejects the mechanic', async () => {
    const { data, error } = await ownerClient.rpc('update_shop_settings', {
      p_shop_name: 'J.J.A Motor Accessories',
      p_address: 'Manila',
      p_contact: '0917 000 0000',
      p_receipt_footer: 'Thank you',
      p_low_stock_default: 4,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ shop_name: 'J.J.A Motor Accessories', low_stock_default: 4 });

    const { error: mechanicError } = await mechanicClient.rpc('update_shop_settings', {
      p_shop_name: 'Mechanic shop',
      p_address: '',
      p_contact: '',
      p_receipt_footer: '',
      p_low_stock_default: 1,
    });
    expect(mechanicError?.message).toBe('FORBIDDEN');
  });

  it('keeps the dashboard owner-only', async () => {
    const { error } = await mechanicClient.rpc('get_daily_summary', {
      p_business_date: manilaDateKey(),
    });
    expect(error?.message).toBe('FORBIDDEN');

    const { error: anonError } = await getAnonClient().rpc('get_daily_summary', {
      p_business_date: manilaDateKey(),
    });
    expect(anonError).toMatchObject({ code: '42501' });
  });
});
