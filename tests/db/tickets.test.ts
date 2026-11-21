import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createStaffUser, getAnonClient, getServiceClient, signInAs } from '../setup/db';

const password = 'test-password-123';

type TestUser = { id: string; employeeId: string; email: string; password: string };
type Ticket = {
  id: string;
  ticket_no: string;
  status: string;
  total_centavos: number;
  parts_total_centavos: number;
  labor_total_centavos: number;
};

let owner: TestUser;
let mechanic: TestUser;
let ownerClient: SupabaseClient;
let mechanicClient: SupabaseClient;
let partId: string;
const ticketIds: string[] = [];

async function createPart(stock = 10) {
  const { data, error } = await ownerClient.rpc('create_part', {
    p_name: `Ticket test part ${Date.now()}`,
    p_sku: null,
    p_category: 'Test',
    p_compatible_models: [],
    p_unit_price_centavos: 15000,
    p_cost_price_centavos: 9000,
    p_stock_on_hand: stock,
    p_low_stock_threshold: 2,
  });

  if (error) throw error;
  const row = data as { id: string };
  return row.id;
}

async function createTicket(
  items: { part_id: string; qty: number }[],
  labor = [{ description: 'Install', amount_centavos: 5000 }],
) {
  const { data, error } = await mechanicClient.rpc('create_ticket', {
    p_type: 'REPAIR',
    p_customer_name: 'Test Customer',
    p_bike_model: 'Honda Click',
    p_notes: null,
    p_items: items,
    p_labor: labor,
  });

  if (error) throw error;
  const ticket = data as Ticket;
  ticketIds.push(ticket.id);
  return ticket;
}

beforeAll(async () => {
  const stamp = Date.now();

  owner = await createStaffUser({
    employeeId: `JJA-TO${stamp}`,
    password,
    displayName: 'Ticket Owner',
    role: 'owner',
  });

  mechanic = await createStaffUser({
    employeeId: `JJA-TM${stamp}`,
    password,
    displayName: 'Ticket Mechanic',
    role: 'mechanic',
  });

  ownerClient = await signInAs(owner);
  mechanicClient = await signInAs(mechanic);
  partId = await createPart(10);
});

afterAll(async () => {
  const service = getServiceClient();

  if (ticketIds.length > 0) {
    await service.from('ticket_labor').delete().in('ticket_id', ticketIds);
    await service.from('ticket_items').delete().in('ticket_id', ticketIds);
    await service.from('audit_events').delete().in('entity_id', ticketIds);
    await service.from('tickets').delete().in('id', ticketIds);
  }

  if (partId) {
    await service.from('stock_movements').delete().eq('part_id', partId);
    await service.from('audit_events').delete().eq('entity_id', partId);
    await service.from('parts').delete().eq('id', partId);
  }
});

describe('tickets', () => {
  it('creates a ticket, snapshots prices, and reserves stock', async () => {
    const ticket = await createTicket([{ part_id: partId, qty: 2 }]);

    expect(ticket.ticket_no).toMatch(/^TK-\d{8}-\d{4}$/);
    expect(ticket.status).toBe('PENDING');
    expect(ticket.parts_total_centavos).toBe(30000);
    expect(ticket.labor_total_centavos).toBe(5000);
    expect(ticket.total_centavos).toBe(35000);

    const { data: part } = await mechanicClient
      .from('parts')
      .select('stock_on_hand, reserved_qty, available_qty')
      .eq('id', partId)
      .single();

    expect(part).toMatchObject({ stock_on_hand: 10, reserved_qty: 2, available_qty: 8 });

    const { data: item } = await mechanicClient
      .from('ticket_items')
      .select('part_name_at_time, qty, unit_price_at_time_centavos, unit_cost_at_time_centavos')
      .eq('ticket_id', ticket.id)
      .single();

    expect(item).toMatchObject({
      qty: 2,
      unit_price_at_time_centavos: 15000,
      unit_cost_at_time_centavos: 9000,
    });
  });

  it('merges a repeated part and adjusts the reservation', async () => {
    const ticket = await createTicket([{ part_id: partId, qty: 1 }]);

    const { error } = await mechanicClient.rpc('add_ticket_item', {
      p_ticket_id: ticket.id,
      p_part_id: partId,
      p_qty: 2,
    });

    expect(error).toBeNull();

    const { data: items } = await mechanicClient
      .from('ticket_items')
      .select('qty')
      .eq('ticket_id', ticket.id);

    expect(items).toEqual([{ qty: 3 }]);
  });

  it('refuses to oversell', async () => {
    const ticket = await createTicket([{ part_id: partId, qty: 1 }], []);

    const { error } = await mechanicClient.rpc('add_ticket_item', {
      p_ticket_id: ticket.id,
      p_part_id: partId,
      p_qty: 9999,
    });

    expect(error?.message).toBe('INSUFFICIENT_STOCK');
  });

  it('verifies parts and moves through the allowed statuses', async () => {
    const ticket = await createTicket([{ part_id: partId, qty: 1 }], []);

    const { error: verifyError } = await mechanicClient.rpc('verify_ticket_item', {
      p_ticket_id: ticket.id,
      p_part_id: partId,
    });
    expect(verifyError).toBeNull();

    for (const status of ['VERIFYING', 'IN_PROGRESS', 'READY', 'IN_PROGRESS']) {
      const { error } = await mechanicClient.rpc('update_ticket_status', {
        p_ticket_id: ticket.id,
        p_status: status,
      });
      expect(error).toBeNull();
    }

    const { error: invalid } = await mechanicClient.rpc('update_ticket_status', {
      p_ticket_id: ticket.id,
      p_status: 'COMPLETED',
    });
    expect(invalid?.message).toBe('INVALID_STATUS');
  });

  it('rejects a skipped status transition', async () => {
    const ticket = await createTicket([{ part_id: partId, qty: 1 }], []);

    const { error } = await mechanicClient.rpc('update_ticket_status', {
      p_ticket_id: ticket.id,
      p_status: 'READY',
    });

    expect(error?.message).toBe('INVALID_STATUS_TRANSITION');
  });

  it('releases the reservation when an item or labor line is removed', async () => {
    const ticket = await createTicket([{ part_id: partId, qty: 3 }]);

    const { error: removeError } = await mechanicClient.rpc('remove_ticket_item', {
      p_ticket_id: ticket.id,
      p_part_id: partId,
    });
    expect(removeError).toBeNull();

    const { data: items } = await mechanicClient
      .from('ticket_items')
      .select('id')
      .eq('ticket_id', ticket.id);
    expect(items).toEqual([]);

    const { data: part } = await mechanicClient
      .from('parts')
      .select('reserved_qty')
      .eq('id', partId)
      .single();
    expect(part?.reserved_qty).toBeGreaterThanOrEqual(0);

    const { data: labor } = await mechanicClient
      .from('ticket_labor')
      .select('id')
      .eq('ticket_id', ticket.id)
      .single();

    const { error: laborError } = await mechanicClient.rpc('remove_ticket_labor', {
      p_labor_id: labor?.id,
    });
    expect(laborError).toBeNull();
  });

  it('rejects an empty ticket', async () => {
    const { error } = await mechanicClient.rpc('create_ticket', {
      p_type: 'REPAIR',
      p_customer_name: null,
      p_bike_model: null,
      p_notes: null,
      p_items: [],
      p_labor: [],
    });

    expect(error?.message).toBe('EMPTY_TICKET');
  });

  it('denies anon reads and direct authenticated writes', async () => {
    const { error: anonError } = await getAnonClient().from('tickets').select('id');
    expect(anonError).toMatchObject({ code: '42501' });

    const { error: insertError } = await mechanicClient.from('tickets').insert({
      ticket_no: 'HACK',
      type: 'SALE',
      created_by: mechanic.id,
    });
    expect(insertError).toMatchObject({ code: '42501' });

    const { error: updateError } = await mechanicClient
      .from('tickets')
      .update({ status: 'COMPLETED' })
      .eq('id', ticketIds[0]);
    expect(updateError).toMatchObject({ code: '42501' });
  });
});
