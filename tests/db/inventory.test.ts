import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createStaffUser,
  deleteUser,
  getAnonClient,
  getServiceClient,
  signInAs,
} from '../setup/db';

const password = 'test-password-123';

type TestUser = {
  id: string;
  employeeId: string;
  email: string;
  password: string;
};

let owner: TestUser;
let mechanic: TestUser;
let ownerClient: SupabaseClient;
let mechanicClient: SupabaseClient;
const createdPartIds: string[] = [];

async function createPart(client: SupabaseClient, suffix: string) {
  const { data, error } = await client.rpc('create_part', {
    p_name: `Brake pad ${suffix}`,
    p_sku: `SKU-${suffix}`,
    p_category: 'Brakes',
    p_compatible_models: ['Honda Click 125', 'Yamaha Mio'],
    p_unit_price_centavos: 15000,
    p_cost_price_centavos: 9000,
    p_stock_on_hand: 5,
    p_low_stock_threshold: 2,
  });

  if (error) {
    throw error;
  }

  const row = data as { id: string };
  createdPartIds.push(row.id);
  return row;
}

beforeAll(async () => {
  const stamp = Date.now();

  owner = await createStaffUser({
    employeeId: `JJA-O${stamp}`,
    password,
    displayName: 'Owner Inventory',
    role: 'owner',
  });

  mechanic = await createStaffUser({
    employeeId: `JJA-M${stamp}`,
    password,
    displayName: 'Mechanic Inventory',
    role: 'mechanic',
  });

  ownerClient = await signInAs(owner);
  mechanicClient = await signInAs(mechanic);
});

afterAll(async () => {
  const service = getServiceClient();

  if (createdPartIds.length > 0) {
    await service.from('stock_movements').delete().in('part_id', createdPartIds);
    await service
      .from('audit_events')
      .delete()
      .eq('entity_type', 'part')
      .in('entity_id', createdPartIds);
    await service.from('parts').delete().in('id', createdPartIds);
  }

  if (owner) await deleteUser(owner.id);
  if (mechanic) await deleteUser(mechanic.id);
});

describe('inventory', () => {
  it('lets the owner create a part with opening stock and an audit trail', async () => {
    const part = await createPart(ownerClient, 'A');

    const { data: stored, error } = await ownerClient
      .from('parts')
      .select('name, stock_on_hand, reserved_qty, available_qty, unit_price_centavos')
      .eq('id', part.id)
      .single();

    expect(error).toBeNull();
    expect(stored).toMatchObject({
      stock_on_hand: 5,
      reserved_qty: 0,
      available_qty: 5,
      unit_price_centavos: 15000,
    });

    const { data: movements } = await ownerClient
      .from('stock_movements')
      .select('delta, reason')
      .eq('part_id', part.id);

    expect(movements).toEqual([{ delta: 5, reason: 'INITIAL' }]);

    const { data: audits } = await ownerClient
      .from('audit_events')
      .select('action')
      .eq('entity_type', 'part')
      .eq('entity_id', part.id);

    expect(audits?.map((row) => row.action)).toContain('part.created');
  });

  it('records a price change in the audit trail', async () => {
    const part = await createPart(ownerClient, 'B');

    const { error } = await ownerClient.rpc('update_part', {
      p_part_id: part.id,
      p_name: `Brake pad B`,
      p_sku: null,
      p_category: 'Brakes',
      p_compatible_models: [],
      p_unit_price_centavos: 17500,
      p_cost_price_centavos: 9000,
      p_low_stock_threshold: 2,
      p_is_active: true,
    });

    expect(error).toBeNull();

    const { data: audits } = await ownerClient
      .from('audit_events')
      .select('action')
      .eq('entity_type', 'part')
      .eq('entity_id', part.id);

    expect(audits?.map((row) => row.action)).toContain('part.price_changed');
  });

  it('writes a ledger row and refuses to go below zero', async () => {
    const part = await createPart(ownerClient, 'C');

    const { data, error } = await ownerClient.rpc('adjust_stock', {
      p_part_id: part.id,
      p_delta: 3,
      p_reason: 'RESTOCK',
      p_note: 'Delivery',
    });

    expect(error).toBeNull();
    expect((data as { stock_on_hand: number }).stock_on_hand).toBe(8);

    const { error: tooLow } = await ownerClient.rpc('adjust_stock', {
      p_part_id: part.id,
      p_delta: -100,
      p_reason: 'ADJUSTMENT',
      p_note: 'Bad count',
    });

    expect(tooLow?.message).toBe('INVALID_STOCK');
  });

  it('refuses to push stock below reserved quantity', async () => {
    const part = await createPart(ownerClient, 'D');

    await getServiceClient().from('parts').update({ reserved_qty: 2 }).eq('id', part.id);

    const { error } = await ownerClient.rpc('adjust_stock', {
      p_part_id: part.id,
      p_delta: -4,
      p_reason: 'ADJUSTMENT',
      p_note: 'Count',
    });

    expect(error?.message).toBe('INSUFFICIENT_STOCK');
  });

  it('keeps the mechanic read-only', async () => {
    await createPart(ownerClient, 'E');

    const { data, error } = await mechanicClient.from('parts').select('id').limit(1).maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const { error: createError } = await mechanicClient.rpc('create_part', {
      p_name: 'Mechanic part',
      p_sku: null,
      p_category: 'General',
      p_compatible_models: [],
      p_unit_price_centavos: 100,
      p_cost_price_centavos: 50,
      p_stock_on_hand: 1,
      p_low_stock_threshold: 1,
    });

    expect(createError?.message).toBe('FORBIDDEN');

    const { error: adjustError } = await mechanicClient.rpc('adjust_stock', {
      p_part_id: createdPartIds[0],
      p_delta: 1,
      p_reason: 'RESTOCK',
      p_note: null,
    });

    expect(adjustError?.message).toBe('FORBIDDEN');
  });

  it('denies anon reads and direct authenticated writes', async () => {
    const { error: anonError } = await getAnonClient().from('parts').select('id');
    expect(anonError).toMatchObject({ code: '42501' });

    const { error: insertError } = await mechanicClient.from('parts').insert({
      name: 'Direct write',
      unit_price_centavos: 100,
    });
    expect(insertError).toMatchObject({ code: '42501' });

    const { error: updateError } = await mechanicClient
      .from('parts')
      .update({ unit_price_centavos: 1 })
      .eq('id', createdPartIds[0]);
    expect(updateError).toMatchObject({ code: '42501' });
  });
});
