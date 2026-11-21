import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createStaffUser, getAnonClient, getServiceClient, signInAs } from '../setup/db';

const password = 'test-password-123';

type TestUser = { id: string; employeeId: string; email: string; password: string };
type Ticket = { id: string; ticket_no: string; status: string; total_centavos: number };
type Receipt = {
  id: string;
  receipt_no: string;
  status: string;
  total_centavos: number;
  verification_code: string;
  verification_hash: string;
  public_token: string;
  snapshot: Record<string, unknown>;
};

let owner: TestUser;
let mechanic: TestUser;
let ownerClient: SupabaseClient;
let mechanicClient: SupabaseClient;
const ticketIds: string[] = [];
const partIds: string[] = [];
const receiptIds: string[] = [];

async function createPart(stock = 10) {
  const stamp = `${Date.now()}-${partIds.length}`;
  const { data, error } = await ownerClient.rpc('create_part', {
    p_name: `Payment test part ${stamp}`,
    p_sku: null,
    p_category: 'Test',
    p_compatible_models: [],
    p_unit_price_centavos: 15000,
    p_cost_price_centavos: 9000,
    p_stock_on_hand: stock,
    p_low_stock_threshold: 2,
  });

  if (error) throw error;
  const id = (data as { id: string }).id;
  partIds.push(id);
  return id;
}

async function createTicket(partId: string, qty = 2, labor = 5000) {
  const { data, error } = await mechanicClient.rpc('create_ticket', {
    p_type: 'REPAIR',
    p_customer_name: 'Payment Customer',
    p_bike_model: 'Honda Click',
    p_notes: null,
    p_items: [{ part_id: partId, qty }],
    p_labor: [{ description: 'Install', amount_centavos: labor }],
  });

  if (error) throw error;
  const ticket = data as Ticket;
  ticketIds.push(ticket.id);
  return ticket;
}

async function verifyAll(ticketId: string) {
  const { error } = await mechanicClient.rpc('verify_all_ticket_items', { p_ticket_id: ticketId });
  if (error) throw error;
}

async function complete(ticketId: string, amount: number) {
  const { data, error } = await mechanicClient.rpc('complete_ticket', {
    p_ticket_id: ticketId,
    p_payments: [{ method: 'CASH', amount_centavos: amount, reference_no: null, note: null }],
  });

  if (error) throw error;
  const receipt = data as Receipt;
  receiptIds.push(receipt.id);
  return receipt;
}

beforeAll(async () => {
  const stamp = Date.now();

  owner = await createStaffUser({
    employeeId: `JJA-PO${stamp}`,
    password,
    displayName: 'Payment Owner',
    role: 'owner',
  });

  mechanic = await createStaffUser({
    employeeId: `JJA-PM${stamp}`,
    password,
    displayName: 'Payment Mechanic',
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
    await service.from('ticket_labor').delete().in('ticket_id', ticketIds);
    await service.from('ticket_items').delete().in('ticket_id', ticketIds);
    await service.from('audit_events').delete().in('entity_id', ticketIds);
    await service.from('tickets').delete().in('id', ticketIds);
  }

  if (partIds.length > 0) {
    await service.from('stock_movements').delete().in('part_id', partIds);
    await service.from('audit_events').delete().in('entity_id', partIds);
    await service.from('parts').delete().in('id', partIds);
  }
});

describe('payments and completion', () => {
  it('records a deposit and rejects overpayment', async () => {
    const partId = await createPart();
    const ticket = await createTicket(partId);

    const { error } = await mechanicClient.rpc('record_payment', {
      p_ticket_id: ticket.id,
      p_method: 'GCASH',
      p_amount_centavos: 10000,
      p_reference_no: 'REF-1',
      p_note: 'Deposit',
    });

    expect(error).toBeNull();

    const { error: overpay } = await mechanicClient.rpc('record_payment', {
      p_ticket_id: ticket.id,
      p_method: 'CASH',
      p_amount_centavos: 30000,
      p_reference_no: null,
      p_note: null,
    });

    expect(overpay?.message).toBe('PAYMENT_MISMATCH');
  });

  it('blocks completion until every part is verified', async () => {
    const partId = await createPart();
    const ticket = await createTicket(partId);

    const { error } = await mechanicClient.rpc('complete_ticket', {
      p_ticket_id: ticket.id,
      p_payments: [{ method: 'CASH', amount_centavos: 35000 }],
    });

    expect(error?.message).toBe('NOT_VERIFIED');
  });

  it('completes a ticket, deducts stock, and issues one receipt', async () => {
    const partId = await createPart();
    const ticket = await createTicket(partId);
    await verifyAll(ticket.id);

    const receipt = await complete(ticket.id, 35000);

    expect(receipt.receipt_no).toMatch(/^\d{8}-\d{4}$/);
    expect(receipt.total_centavos).toBe(35000);
    expect(receipt.verification_code).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(receipt.verification_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.public_token).toMatch(/^[0-9a-f]{32}$/);
    expect(receipt.status).toBe('ISSUED');

    const { data: storedTicket } = await mechanicClient
      .from('tickets')
      .select('status')
      .eq('id', ticket.id)
      .single();
    expect(storedTicket?.status).toBe('COMPLETED');

    const { data: part } = await mechanicClient
      .from('parts')
      .select('stock_on_hand, reserved_qty, available_qty')
      .eq('id', partId)
      .single();
    expect(part).toMatchObject({ stock_on_hand: 8, reserved_qty: 0, available_qty: 8 });

    const { data: movements } = await ownerClient
      .from('stock_movements')
      .select('delta, reason')
      .eq('part_id', partId)
      .eq('reason', 'SALE');
    expect(movements).toEqual([{ delta: -2, reason: 'SALE' }]);

    const { data: snapshot } = await mechanicClient
      .from('receipts')
      .select('snapshot')
      .eq('id', receipt.id)
      .single();
    expect(snapshot?.snapshot).toMatchObject({
      totals: { parts_centavos: 30000, labor_centavos: 5000, total_centavos: 35000 },
      receipt_no: receipt.receipt_no,
    });

    const { error: second } = await mechanicClient.rpc('complete_ticket', {
      p_ticket_id: ticket.id,
      p_payments: [],
    });
    expect(second?.message).toBe('TICKET_NOT_OPEN');
  });

  it('verifies a valid receipt and rejects a tampered snapshot', async () => {
    const partId = await createPart();
    const ticket = await createTicket(partId);
    await verifyAll(ticket.id);
    const receipt = await complete(ticket.id, 35000);

    const anon = getAnonClient();
    const { data: valid, error } = await anon.rpc('verify_receipt', {
      p_receipt_no: receipt.receipt_no,
      p_code: receipt.verification_code,
    });

    expect(error).toBeNull();
    expect(valid).toMatchObject({
      valid: true,
      status: 'ISSUED',
      receipt_no: receipt.receipt_no,
      total_centavos: 35000,
      payment_method: 'CASH',
    });
    expect(valid).not.toHaveProperty('customer_name');
    expect(valid).not.toHaveProperty('items');

    const { data: wrong } = await anon.rpc('verify_receipt', {
      p_receipt_no: receipt.receipt_no,
      p_code: '0000-0000-0000-0000',
    });
    expect(wrong).toMatchObject({ valid: false, status: 'NO_MATCH' });

    await getServiceClient()
      .from('receipts')
      .update({ snapshot: { ...receipt.snapshot, tampered: true } })
      .eq('id', receipt.id);

    const { data: tampered } = await anon.rpc('verify_receipt', {
      p_receipt_no: receipt.receipt_no,
      p_code: receipt.verification_code,
    });
    expect(tampered).toMatchObject({ valid: false, status: 'NO_MATCH' });
  });

  it('serves a public receipt by token and hides other receipts', async () => {
    const partId = await createPart();
    const ticket = await createTicket(partId);
    await verifyAll(ticket.id);
    const receipt = await complete(ticket.id, 35000);

    const anon = getAnonClient();
    const { data } = await anon.rpc('get_receipt', { p_token: receipt.public_token });

    expect(data).toMatchObject({
      receipt_no: receipt.receipt_no,
      status: 'ISSUED',
      total_centavos: 35000,
    });

    const { data: missing } = await anon.rpc('get_receipt', {
      p_token: '00000000000000000000000000000000',
    });
    expect(missing).toBeNull();
  });

  it('refunds a deposit on cancellation only for the owner', async () => {
    const partId = await createPart();
    const ticket = await createTicket(partId);

    await mechanicClient.rpc('record_payment', {
      p_ticket_id: ticket.id,
      p_method: 'CASH',
      p_amount_centavos: 10000,
      p_reference_no: null,
      p_note: 'Deposit',
    });

    const { error: mechanicError } = await mechanicClient.rpc('cancel_ticket', {
      p_ticket_id: ticket.id,
      p_reason: 'Customer left',
    });
    expect(mechanicError?.message).toBe('FORBIDDEN');

    const { error: ownerError } = await ownerClient.rpc('cancel_ticket', {
      p_ticket_id: ticket.id,
      p_reason: 'Customer left',
    });
    expect(ownerError).toBeNull();

    const { data: payments } = await mechanicClient
      .from('ticket_payments')
      .select('amount_centavos, method')
      .eq('ticket_id', ticket.id)
      .order('amount_centavos');

    expect(payments).toEqual([
      { amount_centavos: -10000, method: 'CASH' },
      { amount_centavos: 10000, method: 'CASH' },
    ]);

    const { data: part } = await mechanicClient
      .from('parts')
      .select('reserved_qty')
      .eq('id', partId)
      .single();
    expect(part?.reserved_qty).toBe(0);
  });

  it('voids a completed sale, restores stock, and marks the receipt VOID', async () => {
    const partId = await createPart();
    const ticket = await createTicket(partId);
    await verifyAll(ticket.id);
    const receipt = await complete(ticket.id, 35000);

    const { error: mechanicError } = await mechanicClient.rpc('void_sale', {
      p_receipt_id: receipt.id,
      p_reason: 'Wrong part',
      p_refund_method: 'CASH',
    });
    expect(mechanicError?.message).toBe('FORBIDDEN');

    const { error } = await ownerClient.rpc('void_sale', {
      p_receipt_id: receipt.id,
      p_reason: 'Wrong part',
      p_refund_method: 'CASH',
    });
    expect(error).toBeNull();

    const { data: storedReceipt } = await mechanicClient
      .from('receipts')
      .select('status, void_reason')
      .eq('id', receipt.id)
      .single();
    expect(storedReceipt).toMatchObject({ status: 'VOID', void_reason: 'Wrong part' });

    const { data: storedTicket } = await mechanicClient
      .from('tickets')
      .select('status')
      .eq('id', ticket.id)
      .single();
    expect(storedTicket?.status).toBe('VOIDED');

    const { data: part } = await mechanicClient
      .from('parts')
      .select('stock_on_hand, reserved_qty')
      .eq('id', partId)
      .single();
    expect(part).toMatchObject({ stock_on_hand: 10, reserved_qty: 0 });

    const { data: movements } = await ownerClient
      .from('stock_movements')
      .select('delta, reason')
      .eq('part_id', partId)
      .eq('reason', 'RETURN');
    expect(movements).toEqual([{ delta: 2, reason: 'RETURN' }]);

    const { data: refunds } = await mechanicClient
      .from('ticket_payments')
      .select('amount_centavos')
      .eq('ticket_id', ticket.id)
      .lt('amount_centavos', 0);
    expect(refunds).toEqual([{ amount_centavos: -35000 }]);
  });

  it('denies anon payment reads and direct writes', async () => {
    const { error: anonError } = await getAnonClient().from('ticket_payments').select('id');
    expect(anonError).toMatchObject({ code: '42501' });

    const { error: insertError } = await mechanicClient.from('ticket_payments').insert({
      ticket_id: ticketIds[0],
      method: 'CASH',
      amount_centavos: 1,
      received_by: mechanic.id,
    });
    expect(insertError).toMatchObject({ code: '42501' });
  });
});
