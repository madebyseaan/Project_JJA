import { toAppError } from '@/lib/errors';
import { getSupabaseClient } from '@/lib/supabase';

import type {
  CreateTicketInput,
  PaymentMethod,
  Receipt,
  Ticket,
  TicketDetail,
  TicketItem,
  TicketLabor,
  TicketPayment,
  TicketStatus,
  TicketType,
} from './types';

const TICKET_COLUMNS = [
  'id',
  'ticket_no',
  'type',
  'status',
  'customer_name',
  'bike_model',
  'notes',
  'parts_total_centavos',
  'labor_total_centavos',
  'total_centavos',
  'created_by',
  'created_at',
  'updated_at',
].join(',');

type TicketRow = {
  id: string;
  ticket_no: string;
  type: TicketType;
  status: TicketStatus;
  customer_name: string | null;
  bike_model: string | null;
  notes: string | null;
  parts_total_centavos: number;
  labor_total_centavos: number;
  total_centavos: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
};

type TicketItemRow = {
  id: string;
  ticket_id: string;
  part_id: string;
  part_name_at_time: string;
  qty: number;
  unit_price_at_time_centavos: number;
  unit_cost_at_time_centavos: number;
  line_total_centavos: number;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
};

type TicketLaborRow = {
  id: string;
  ticket_id: string;
  description: string;
  amount_centavos: number;
  created_by: string;
  created_at: string;
};

type TicketPaymentRow = {
  id: string;
  ticket_id: string;
  method: TicketPayment['method'];
  amount_centavos: number;
  reference_no: string | null;
  received_by: string;
  received_at: string;
  note: string | null;
  receiver: { display_name: string }[] | { display_name: string } | null;
};

type ReceiptRow = {
  id: string;
  receipt_no: string;
  ticket_id: string;
  status: Receipt['status'];
  issued_at: string;
  issued_by: string;
  total_centavos: number;
  verification_code: string;
  public_token: string;
  voided_at: string | null;
  void_reason: string | null;
};

function receiverName(row: TicketPaymentRow): string | null {
  if (Array.isArray(row.receiver)) {
    return row.receiver[0]?.display_name ?? null;
  }

  return row.receiver?.display_name ?? null;
}

function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    ticketNo: row.ticket_no,
    type: row.type,
    status: row.status,
    customerName: row.customer_name,
    bikeModel: row.bike_model,
    notes: row.notes,
    partsTotalCentavos: row.parts_total_centavos,
    laborTotalCentavos: row.labor_total_centavos,
    totalCentavos: row.total_centavos,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: TicketItemRow): TicketItem {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    partId: row.part_id,
    partName: row.part_name_at_time,
    qty: row.qty,
    unitPriceCentavos: row.unit_price_at_time_centavos,
    unitCostCentavos: row.unit_cost_at_time_centavos,
    lineTotalCentavos: row.line_total_centavos,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    createdAt: row.created_at,
  };
}

function mapLabor(row: TicketLaborRow): TicketLabor {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    description: row.description,
    amountCentavos: row.amount_centavos,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapPayment(row: TicketPaymentRow): TicketPayment {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    method: row.method,
    amountCentavos: row.amount_centavos,
    referenceNo: row.reference_no,
    receivedBy: row.received_by,
    receivedByName: receiverName(row),
    receivedAt: row.received_at,
    note: row.note,
  };
}

function mapReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    receiptNo: row.receipt_no,
    ticketId: row.ticket_id,
    status: row.status,
    issuedAt: row.issued_at,
    issuedBy: row.issued_by,
    totalCentavos: row.total_centavos,
    verificationCode: row.verification_code,
    publicToken: row.public_token,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  };
}

export async function listOpenTickets(): Promise<Ticket[]> {
  const { data, error } = await getSupabaseClient()
    .from('v_open_tickets')
    .select(`${TICKET_COLUMNS},created_by_name`)
    .order('created_at', { ascending: true });

  if (error) {
    throw toAppError(error);
  }

  return ((data ?? []) as unknown as TicketRow[]).map(mapTicket);
}

export async function getTicket(ticketId: string): Promise<TicketDetail> {
  const client = getSupabaseClient();

  const [ticketResult, itemsResult, laborResult, paymentsResult, receiptResult] = await Promise.all(
    [
      client.from('tickets').select(TICKET_COLUMNS).eq('id', ticketId).maybeSingle(),
      client
        .from('ticket_items')
        .select(
          'id,ticket_id,part_id,part_name_at_time,qty,unit_price_at_time_centavos,unit_cost_at_time_centavos,line_total_centavos,verified_at,verified_by,created_at',
        )
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
      client
        .from('ticket_labor')
        .select('id,ticket_id,description,amount_centavos,created_by,created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
      client
        .from('ticket_payments')
        .select(
          'id,ticket_id,method,amount_centavos,reference_no,received_by,received_at,note,receiver:profiles!ticket_payments_received_by_fkey(display_name)',
        )
        .eq('ticket_id', ticketId)
        .order('received_at', { ascending: true }),
      client
        .from('receipts')
        .select(
          'id,receipt_no,ticket_id,status,issued_at,issued_by,total_centavos,verification_code,public_token,voided_at,void_reason',
        )
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ],
  );

  if (ticketResult.error) throw toAppError(ticketResult.error);
  if (itemsResult.error) throw toAppError(itemsResult.error);
  if (laborResult.error) throw toAppError(laborResult.error);
  if (paymentsResult.error) throw toAppError(paymentsResult.error);
  if (receiptResult.error) throw toAppError(receiptResult.error);

  if (!ticketResult.data) {
    throw toAppError({ message: 'TICKET_NOT_FOUND' });
  }

  return {
    ticket: mapTicket(ticketResult.data as unknown as TicketRow),
    items: ((itemsResult.data ?? []) as unknown as TicketItemRow[]).map(mapItem),
    labor: ((laborResult.data ?? []) as unknown as TicketLaborRow[]).map(mapLabor),
    payments: ((paymentsResult.data ?? []) as unknown as TicketPaymentRow[]).map(mapPayment),
    receipt: receiptResult.data ? mapReceipt(receiptResult.data as unknown as ReceiptRow) : null,
  };
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const { data, error } = await getSupabaseClient().rpc('create_ticket', {
    p_type: input.type,
    p_customer_name: input.customerName,
    p_bike_model: input.bikeModel,
    p_notes: input.notes,
    p_items: input.items.map((item) => ({ part_id: item.partId, qty: item.qty })),
    p_labor: input.labor.map((line) => ({
      description: line.description,
      amount_centavos: line.amountCentavos,
    })),
  });

  if (error) {
    throw toAppError(error);
  }

  return mapTicket(data as unknown as TicketRow);
}

export async function addTicketItem(
  ticketId: string,
  partId: string,
  qty: number,
): Promise<TicketItem> {
  const { data, error } = await getSupabaseClient().rpc('add_ticket_item', {
    p_ticket_id: ticketId,
    p_part_id: partId,
    p_qty: qty,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapItem(data as TicketItemRow);
}

export async function setTicketItemQty(
  ticketId: string,
  partId: string,
  qty: number,
): Promise<TicketItem> {
  const { data, error } = await getSupabaseClient().rpc('set_ticket_item_qty', {
    p_ticket_id: ticketId,
    p_part_id: partId,
    p_qty: qty,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapItem(data as TicketItemRow);
}

export async function removeTicketItem(ticketId: string, partId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('remove_ticket_item', {
    p_ticket_id: ticketId,
    p_part_id: partId,
  });

  if (error) {
    throw toAppError(error);
  }
}

export async function addTicketLabor(
  ticketId: string,
  description: string,
  amountCentavos: number,
): Promise<TicketLabor> {
  const { data, error } = await getSupabaseClient().rpc('add_ticket_labor', {
    p_ticket_id: ticketId,
    p_description: description,
    p_amount_centavos: amountCentavos,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapLabor(data as TicketLaborRow);
}

export async function removeTicketLabor(laborId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('remove_ticket_labor', {
    p_labor_id: laborId,
  });

  if (error) {
    throw toAppError(error);
  }
}

export async function verifyTicketItem(ticketId: string, partId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('verify_ticket_item', {
    p_ticket_id: ticketId,
    p_part_id: partId,
  });

  if (error) {
    throw toAppError(error);
  }
}

export async function verifyAllTicketItems(ticketId: string): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('verify_all_ticket_items', {
    p_ticket_id: ticketId,
  });

  if (error) {
    throw toAppError(error);
  }

  return data as number;
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
  const { data, error } = await getSupabaseClient().rpc('update_ticket_status', {
    p_ticket_id: ticketId,
    p_status: status,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapTicket(data as unknown as TicketRow);
}

export async function recordPayment(input: {
  ticketId: string;
  method: PaymentMethod;
  amountCentavos: number;
  referenceNo: string | null;
  note: string | null;
}): Promise<TicketPayment> {
  const { data, error } = await getSupabaseClient().rpc('record_payment', {
    p_ticket_id: input.ticketId,
    p_method: input.method,
    p_amount_centavos: input.amountCentavos,
    p_reference_no: input.referenceNo,
    p_note: input.note,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapPayment(data as unknown as TicketPaymentRow);
}

export async function completeTicket(input: {
  ticketId: string;
  payments: {
    method: PaymentMethod;
    amountCentavos: number;
    referenceNo: string | null;
    note: string | null;
  }[];
}): Promise<Receipt> {
  const { data, error } = await getSupabaseClient().rpc('complete_ticket', {
    p_ticket_id: input.ticketId,
    p_payments: input.payments.map((payment) => ({
      method: payment.method,
      amount_centavos: payment.amountCentavos,
      reference_no: payment.referenceNo,
      note: payment.note,
    })),
  });

  if (error) {
    throw toAppError(error);
  }

  return mapReceipt(data as unknown as ReceiptRow);
}

export async function cancelTicket(ticketId: string, reason: string): Promise<Ticket> {
  const { data, error } = await getSupabaseClient().rpc('cancel_ticket', {
    p_ticket_id: ticketId,
    p_reason: reason,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapTicket(data as unknown as TicketRow);
}
