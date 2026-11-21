import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createStaffUser, getAnonClient, getServiceClient, signInAs } from '../setup/db';

const password = 'test-password-123';

type TestUser = { id: string; employeeId: string; email: string; password: string };
type Ticket = { id: string };
type Receipt = { id: string; receipt_no: string };

let owner: TestUser;
let mechanic: TestUser;
let ownerClient: SupabaseClient;
let mechanicClient: SupabaseClient;
const ticketIds: string[] = [];
const partIds: string[] = [];

async function createPart() {
  const { data, error } = await ownerClient.rpc('create_part', {
    p_name: `Integrity part ${Date.now()}-${partIds.length}`,
    p_sku: null,
    p_category: 'Test',
    p_compatible_models: [],
    p_unit_price_centavos: 10000,
    p_cost_price_centavos: 5000,
    p_stock_on_hand: 5,
    p_low_stock_threshold: 1,
  });

  if (error) throw error;
  const id = (data as { id: string }).id;
  partIds.push(id);
  return id;
}

async function completedReceipt(): Promise<Receipt> {
  const partId = await createPart();

  const { data: ticketData, error: ticketError } = await mechanicClient.rpc('create_ticket', {
    p_type: 'SALE',
    p_customer_name: null,
    p_bike_model: null,
    p_notes: null,
    p_items: [{ part_id: partId, qty: 1 }],
    p_labor: [],
  });

  if (ticketError) throw ticketError;
  const ticket = ticketData as Ticket;
  ticketIds.push(ticket.id);

  await mechanicClient.rpc('verify_all_ticket_items', { p_ticket_id: ticket.id });

  const { data, error } = await mechanicClient.rpc('complete_ticket', {
    p_ticket_id: ticket.id,
    p_payments: [{ method: 'CASH', amount_centavos: 10000, reference_no: null, note: null }],
  });

  if (error) throw error;
  return data as Receipt;
}

type Integrity = {
  receipt_count: number;
  mismatches: { receipt_no: string }[];
  missing_numbers: { receipt_no: string }[];
  voided: { receipt_no: string }[];
};

async function integrity(client: SupabaseClient = ownerClient): Promise<Integrity> {
  const { data, error } = await client.rpc('get_receipt_integrity');
  if (error) throw error;
  return data as Integrity;
}

beforeAll(async () => {
  const stamp = Date.now();

  owner = await createStaffUser({
    employeeId: `JJA-IO${stamp}`,
    password,
    displayName: 'Integrity Owner',
    role: 'owner',
  });

  mechanic = await createStaffUser({
    employeeId: `JJA-IM${stamp}`,
    password,
    displayName: 'Integrity Mechanic',
    role: 'mechanic',
  });

  ownerClient = await signInAs(owner);
  mechanicClient = await signInAs(mechanic);
});

afterAll(async () => {
  const service = getServiceClient();

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
});

describe('receipt integrity', () => {
  it('reports a clean ledger for valid receipts', async () => {
    const receipt = await completedReceipt();
    const report = await integrity();

    expect(report.receipt_count).toBeGreaterThan(0);
    expect(report.mismatches).toEqual([]);
    expect(report.missing_numbers.map((row) => row.receipt_no)).not.toContain(receipt.receipt_no);
    expect(report.voided.map((row) => row.receipt_no)).not.toContain(receipt.receipt_no);
  });

  it('flags a tampered snapshot as a mismatch', async () => {
    const receipt = await completedReceipt();
    const service = getServiceClient();

    const { data: stored } = await service
      .from('receipts')
      .select('snapshot')
      .eq('id', receipt.id)
      .single();

    await service
      .from('receipts')
      .update({ snapshot: { ...(stored?.snapshot as object), edited: true } })
      .eq('id', receipt.id);

    const report = await integrity();
    expect(report.mismatches.map((row) => row.receipt_no)).toContain(receipt.receipt_no);
  });

  it('flags a deleted receipt number as missing', async () => {
    const receipt = await completedReceipt();
    const service = getServiceClient();

    await service.from('stock_movements').delete().eq('receipt_id', receipt.id);
    const { error } = await service.from('receipts').delete().eq('id', receipt.id);
    expect(error).toBeNull();

    const report = await integrity();
    expect(report.missing_numbers.map((row) => row.receipt_no)).toContain(receipt.receipt_no);
  });

  it('lists voided receipts', async () => {
    const receipt = await completedReceipt();

    const { error } = await ownerClient.rpc('void_sale', {
      p_receipt_id: receipt.id,
      p_reason: 'Integrity test void',
      p_refund_method: 'CASH',
    });
    expect(error).toBeNull();

    const report = await integrity();
    expect(report.voided.map((row) => row.receipt_no)).toContain(receipt.receipt_no);
  });

  it('is owner-only', async () => {
    const { error: mechanicError } = await mechanicClient.rpc('get_receipt_integrity');
    expect(mechanicError?.message).toBe('FORBIDDEN');

    const { error: anonError } = await getAnonClient().rpc('get_receipt_integrity');
    expect(anonError).toMatchObject({ code: '42501' });
  });
});
