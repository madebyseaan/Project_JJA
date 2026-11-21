import { toAppError } from '@/lib/errors';
import { getSupabaseClient } from '@/lib/supabase';

import type {
  AuditEvent,
  DailySummary,
  DayClose,
  ReceiptIntegrity,
  SalesReceipt,
  ShopSettings,
} from './types';
import type { ReceiptSnapshot } from '@/features/receipts/types';

type DayCloseRow = {
  id: string;
  business_date: string;
  expected_cash_centavos: number;
  counted_cash_centavos: number;
  variance_centavos: number;
  expected_gcash_centavos: number;
  expected_maya_centavos: number;
  expected_other_centavos: number;
  notes: string | null;
  closed_by: string;
  closed_at: string;
};

type SummaryPayload = {
  business_date: string;
  sales: {
    receipt_count: number;
    parts_centavos: number;
    labor_centavos: number;
    total_centavos: number;
  };
  payments: {
    cash_centavos: number;
    gcash_centavos: number;
    maya_centavos: number;
    other_centavos: number;
    total_centavos: number;
  };
  expected_cash_centavos: number;
  voids: {
    receipt_no: string;
    total_centavos: number;
    voided_at: string | null;
    void_reason: string | null;
  }[];
  low_stock: {
    id: string;
    name: string;
    sku: string | null;
    available_qty: number;
    low_stock_threshold: number;
  }[];
  day_close: DayCloseRow | null;
};

type SalesRow = {
  id: string;
  receipt_no: string;
  status: SalesReceipt['status'];
  issued_at: string;
  total_centavos: number;
  verification_code: string;
  public_token: string;
  void_reason: string | null;
  snapshot: ReceiptSnapshot;
};

type AuditRow = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
  actor: { display_name: string }[] | { display_name: string } | null;
};

type IntegrityPayload = {
  checked_at: string;
  receipt_count: number;
  mismatches: {
    receipt_no: string;
    issued_at: string;
    total_centavos: number;
    stored_hash: string;
    computed_hash: string;
  }[];
  missing_numbers: { business_date: string; receipt_no: string }[];
  voided: {
    receipt_no: string;
    issued_at: string;
    voided_at: string | null;
    total_centavos: number;
    void_reason: string | null;
  }[];
};

function mapDayClose(row: DayCloseRow): DayClose {
  return {
    id: row.id,
    businessDate: row.business_date,
    expectedCashCentavos: row.expected_cash_centavos,
    countedCashCentavos: row.counted_cash_centavos,
    varianceCentavos: row.variance_centavos,
    expectedGcashCentavos: row.expected_gcash_centavos,
    expectedMayaCentavos: row.expected_maya_centavos,
    expectedOtherCentavos: row.expected_other_centavos,
    notes: row.notes,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
  };
}

function actorName(row: AuditRow): string | null {
  if (Array.isArray(row.actor)) {
    return row.actor[0]?.display_name ?? null;
  }

  return row.actor?.display_name ?? null;
}

export async function getDailySummary(businessDate: string): Promise<DailySummary> {
  const { data, error } = await getSupabaseClient().rpc('get_daily_summary', {
    p_business_date: businessDate,
  });

  if (error) {
    throw toAppError(error);
  }

  const payload = data as SummaryPayload;

  return {
    businessDate: payload.business_date,
    sales: {
      receiptCount: payload.sales.receipt_count,
      partsCentavos: payload.sales.parts_centavos,
      laborCentavos: payload.sales.labor_centavos,
      totalCentavos: payload.sales.total_centavos,
    },
    payments: {
      cashCentavos: payload.payments.cash_centavos,
      gcashCentavos: payload.payments.gcash_centavos,
      mayaCentavos: payload.payments.maya_centavos,
      otherCentavos: payload.payments.other_centavos,
      totalCentavos: payload.payments.total_centavos,
    },
    expectedCashCentavos: payload.expected_cash_centavos,
    voids: payload.voids.map((row) => ({
      receiptNo: row.receipt_no,
      totalCentavos: row.total_centavos,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
    })),
    lowStock: payload.low_stock.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      availableQty: row.available_qty,
      lowStockThreshold: row.low_stock_threshold,
    })),
    dayClose: payload.day_close ? mapDayClose(payload.day_close) : null,
  };
}

export async function closeDay(
  businessDate: string,
  countedCashCentavos: number,
  notes: string | null,
): Promise<DayClose> {
  const { data, error } = await getSupabaseClient().rpc('close_day', {
    p_business_date: businessDate,
    p_counted_cash: countedCashCentavos,
    p_notes: notes,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapDayClose(data as DayCloseRow);
}

export async function getShopSettings(): Promise<ShopSettings> {
  const { data, error } = await getSupabaseClient()
    .from('shop_settings')
    .select('shop_name,address,contact,receipt_footer,low_stock_default')
    .eq('id', 1)
    .single();

  if (error) {
    throw toAppError(error);
  }

  return {
    shopName: data.shop_name,
    address: data.address,
    contact: data.contact,
    receiptFooter: data.receipt_footer,
    lowStockDefault: data.low_stock_default,
  };
}

export async function updateShopSettings(input: ShopSettings): Promise<ShopSettings> {
  const { error } = await getSupabaseClient().rpc('update_shop_settings', {
    p_shop_name: input.shopName,
    p_address: input.address,
    p_contact: input.contact,
    p_receipt_footer: input.receiptFooter,
    p_low_stock_default: input.lowStockDefault,
  });

  if (error) {
    throw toAppError(error);
  }

  return input;
}

export async function listSales(businessDate: string): Promise<SalesReceipt[]> {
  const start = new Date(`${businessDate}T00:00:00+08:00`).toISOString();
  const end = new Date(`${businessDate}T23:59:59.999+08:00`).toISOString();

  const { data, error } = await getSupabaseClient()
    .from('receipts')
    .select(
      'id,receipt_no,status,issued_at,total_centavos,verification_code,public_token,void_reason,snapshot',
    )
    .gte('issued_at', start)
    .lte('issued_at', end)
    .order('issued_at', { ascending: false })
    .limit(500);

  if (error) {
    throw toAppError(error);
  }

  return ((data ?? []) as unknown as SalesRow[]).map((row) => ({
    id: row.id,
    receiptNo: row.receipt_no,
    status: row.status,
    issuedAt: row.issued_at,
    totalCentavos: row.total_centavos,
    verificationCode: row.verification_code,
    publicToken: row.public_token,
    voidReason: row.void_reason,
    snapshot: row.snapshot,
  }));
}

export async function listAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const { data, error } = await getSupabaseClient()
    .from('audit_events')
    .select(
      'id,action,entity_type,entity_id,"before","after",created_at,actor:profiles(display_name)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw toAppError(error);
  }

  return ((data ?? []) as unknown as AuditRow[]).map((row) => ({
    id: row.id,
    actorName: actorName(row),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row['before'],
    after: row['after'],
    createdAt: row.created_at,
  }));
}

export async function getReceiptIntegrity(): Promise<ReceiptIntegrity> {
  const { data, error } = await getSupabaseClient().rpc('get_receipt_integrity');

  if (error) {
    throw toAppError(error);
  }

  const payload = data as IntegrityPayload;

  return {
    checkedAt: payload.checked_at,
    receiptCount: payload.receipt_count,
    mismatches: payload.mismatches.map((row) => ({
      receiptNo: row.receipt_no,
      issuedAt: row.issued_at,
      totalCentavos: row.total_centavos,
      storedHash: row.stored_hash,
      computedHash: row.computed_hash,
    })),
    missingNumbers: payload.missing_numbers.map((row) => ({
      businessDate: row.business_date,
      receiptNo: row.receipt_no,
    })),
    voided: payload.voided.map((row) => ({
      receiptNo: row.receipt_no,
      issuedAt: row.issued_at,
      voidedAt: row.voided_at,
      totalCentavos: row.total_centavos,
      voidReason: row.void_reason,
    })),
  };
}
