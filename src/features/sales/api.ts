import { toAppError } from '@/lib/errors';
import { getSupabaseClient } from '@/lib/supabase';

import { collectPages } from './pagination';
import type {
  CatalogItem,
  DailyReport,
  GcashBalance,
  GcashTransfer,
  LaborReport,
  OrderDetail,
  OrderInput,
  PaymentsReport,
  PublicSalesReceipt,
  SalesChange,
  SalesExtra,
  SalesLabor,
  SalesOrder,
  SalesOrderItem,
  SalesPayment,
  ShopSettingsSummary,
  StaffProfile,
} from './types';

const ORDER_COLUMNS = [
  'id',
  'order_no',
  'business_date',
  'paid_on',
  'customer_name',
  'bike_model',
  'main_user_id',
  'helper_user_id',
  'parts_total_centavos',
  'labor_total_centavos',
  'total_centavos',
  'status',
  'created_at',
  'public_token',
].join(',');

const CATALOG_COLUMNS = [
  'id',
  'name',
  'description',
  'sku',
  'base_price_centavos',
  'item_type',
  'income_account',
  'cogs_account',
  'asset_account',
  'preferred_vendor',
  'is_active',
].join(',');

type EmbeddedName = { display_name: string }[] | { display_name: string } | null;

type OrderRow = {
  id: string;
  order_no: string;
  business_date: string;
  paid_on: string | null;
  customer_name: string | null;
  bike_model: string | null;
  main_user_id: string;
  helper_user_id: string | null;
  parts_total_centavos: number;
  labor_total_centavos: number;
  total_centavos: number;
  status: SalesOrder['status'];
  created_at: string;
  public_token: string;
  main?: EmbeddedName;
  helper?: EmbeddedName;
};

type CatalogRow = {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  base_price_centavos: number;
  item_type: string;
  income_account: string;
  cogs_account: string;
  asset_account: string;
  preferred_vendor: string;
  is_active: boolean;
};

type OrderItemRow = {
  id: string;
  catalog_item_id: string | null;
  item_name_at_time: string;
  qty: number;
  unit_price_at_time_centavos: number;
  line_total_centavos: number;
  is_custom: boolean;
};

type LaborRow = {
  id: string;
  user_id: string;
  amount_centavos: number;
  is_main: boolean;
  profile?: EmbeddedName;
};

type ExtraRow = {
  id: string;
  user_id: string;
  amount_centavos: number;
  note: string | null;
  profile?: EmbeddedName;
};

type PaymentRow = {
  id: string;
  method: SalesPayment['method'];
  amount_centavos: number;
  gcash_recipient_id: string | null;
  received_at: string;
  recipient?: EmbeddedName;
};

type ChangeRow = {
  id: string;
  method: SalesChange['method'];
  amount_centavos: number;
  gcash_recipient_id: string | null;
  recipient?: EmbeddedName;
};

type TransferRow = {
  id: string;
  user_id: string;
  amount_centavos: number;
  destination: GcashTransfer['destination'];
  counterparty_user_id: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
  sender?: EmbeddedName;
  counterparty?: EmbeddedName;
};

function embeddedName(value: EmbeddedName | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.display_name ?? null;
  return value.display_name;
}

function mapOrder(row: OrderRow): SalesOrder {
  return {
    id: row.id,
    orderNo: row.order_no,
    businessDate: row.business_date,
    paidOn: row.paid_on,
    customerName: row.customer_name,
    bikeModel: row.bike_model,
    mainUserId: row.main_user_id,
    mainUserName: embeddedName(row.main),
    helperUserId: row.helper_user_id,
    helperUserName: embeddedName(row.helper),
    partsTotalCentavos: row.parts_total_centavos,
    laborTotalCentavos: row.labor_total_centavos,
    totalCentavos: row.total_centavos,
    status: row.status,
    createdAt: row.created_at,
    publicToken: row.public_token,
  };
}

function mapCatalog(row: CatalogRow): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    basePriceCentavos: row.base_price_centavos,
    itemType: row.item_type,
    incomeAccount: row.income_account,
    cogsAccount: row.cogs_account,
    assetAccount: row.asset_account,
    preferredVendor: row.preferred_vendor,
    isActive: row.is_active,
  };
}

function mapItem(row: OrderItemRow): SalesOrderItem {
  return {
    id: row.id,
    catalogItemId: row.catalog_item_id,
    itemName: row.item_name_at_time,
    qty: row.qty,
    unitPriceCentavos: row.unit_price_at_time_centavos,
    lineTotalCentavos: row.line_total_centavos,
    isCustom: row.is_custom,
  };
}

function mapLabor(row: LaborRow): SalesLabor {
  return {
    id: row.id,
    userId: row.user_id,
    userName: embeddedName(row.profile),
    amountCentavos: row.amount_centavos,
    isMain: row.is_main,
  };
}

function mapExtra(row: ExtraRow): SalesExtra {
  return {
    id: row.id,
    userId: row.user_id,
    userName: embeddedName(row.profile),
    amountCentavos: row.amount_centavos,
    note: row.note,
  };
}

function mapPayment(row: PaymentRow): SalesPayment {
  return {
    id: row.id,
    method: row.method,
    amountCentavos: row.amount_centavos,
    gcashRecipientId: row.gcash_recipient_id,
    gcashRecipientName: embeddedName(row.recipient),
    receivedAt: row.received_at,
  };
}

function mapChange(row: ChangeRow): SalesChange {
  return {
    id: row.id,
    method: row.method,
    amountCentavos: row.amount_centavos,
    gcashRecipientId: row.gcash_recipient_id,
    gcashRecipientName: embeddedName(row.recipient),
  };
}

export async function listCatalog(): Promise<CatalogItem[]> {
  const client = getSupabaseClient();

  const rows = await collectPages<CatalogRow>(async (from, to) => {
    const { data, error } = await client
      .from('catalog_items')
      .select(CATALOG_COLUMNS)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(from, to);

    if (error) throw toAppError(error);
    return (data ?? []) as unknown as CatalogRow[];
  });

  return rows.map(mapCatalog);
}

export async function listStaff(): Promise<StaffProfile[]> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id,display_name,employee_id')
    .order('employee_id');

  if (error) throw toAppError(error);

  return ((data ?? []) as { id: string; display_name: string; employee_id: string }[]).map(
    (row) => ({ id: row.id, displayName: row.display_name, employeeId: row.employee_id }),
  );
}

export async function listOpenOrders(): Promise<SalesOrder[]> {
  const client = getSupabaseClient();

  const rows = await collectPages<OrderRow>(async (from, to) => {
    const { data, error } = await client
      .from('sales_orders')
      .select(
        `${ORDER_COLUMNS},main:profiles!sales_orders_main_user_id_fkey(display_name),helper:profiles!sales_orders_helper_user_id_fkey(display_name)`,
      )
      .eq('status', 'OPEN')
      .order('business_date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) throw toAppError(error);
    return (data ?? []) as unknown as OrderRow[];
  });

  return rows.map(mapOrder);
}

export async function listPaidOrders(paidOn: string): Promise<SalesOrder[]> {
  const { data, error } = await getSupabaseClient()
    .from('sales_orders')
    .select(
      `${ORDER_COLUMNS},main:profiles!sales_orders_main_user_id_fkey(display_name),helper:profiles!sales_orders_helper_user_id_fkey(display_name)`,
    )
    .eq('paid_on', paidOn)
    .in('status', ['PAID', 'EXPORTED'])
    .order('created_at', { ascending: false });

  if (error) throw toAppError(error);
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

export async function getOrder(orderId: string): Promise<OrderDetail> {
  const client = getSupabaseClient();

  const [order, items, labor, extras, payments, changes] = await Promise.all([
    client
      .from('sales_orders')
      .select(
        `${ORDER_COLUMNS},main:profiles!sales_orders_main_user_id_fkey(display_name),helper:profiles!sales_orders_helper_user_id_fkey(display_name)`,
      )
      .eq('id', orderId)
      .maybeSingle(),
    client
      .from('sales_order_items')
      .select(
        'id,catalog_item_id,item_name_at_time,qty,unit_price_at_time_centavos,line_total_centavos,is_custom',
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    client
      .from('sales_labor')
      .select(
        'id,user_id,amount_centavos,is_main,profile:profiles!sales_labor_user_id_fkey(display_name)',
      )
      .eq('order_id', orderId)
      .order('is_main', { ascending: false }),
    client
      .from('sales_extras')
      .select(
        'id,user_id,amount_centavos,note,profile:profiles!sales_extras_user_id_fkey(display_name)',
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    client
      .from('sales_payments')
      .select(
        'id,method,amount_centavos,gcash_recipient_id,received_at,recipient:profiles!sales_payments_gcash_recipient_id_fkey(display_name)',
      )
      .eq('order_id', orderId)
      .order('received_at', { ascending: true }),
    client
      .from('sales_changes')
      .select(
        'id,method,amount_centavos,gcash_recipient_id,recipient:profiles!sales_changes_gcash_recipient_id_fkey(display_name)',
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
  ]);

  if (order.error) throw toAppError(order.error);
  if (items.error) throw toAppError(items.error);
  if (labor.error) throw toAppError(labor.error);
  if (extras.error) throw toAppError(extras.error);
  if (payments.error) throw toAppError(payments.error);
  if (changes.error) throw toAppError(changes.error);
  if (!order.data) throw toAppError({ message: 'ORDER_NOT_FOUND' });

  return {
    order: mapOrder(order.data as unknown as OrderRow),
    items: ((items.data ?? []) as unknown as OrderItemRow[]).map(mapItem),
    labor: ((labor.data ?? []) as unknown as LaborRow[]).map(mapLabor),
    extras: ((extras.data ?? []) as unknown as ExtraRow[]).map(mapExtra),
    payments: ((payments.data ?? []) as unknown as PaymentRow[]).map(mapPayment),
    changes: ((changes.data ?? []) as unknown as ChangeRow[]).map(mapChange),
  };
}

export async function saveOrder(input: OrderInput): Promise<SalesOrder> {
  const { data, error } = await getSupabaseClient().rpc('save_sales_order', {
    p_order_id: input.orderId,
    p_business_date: input.businessDate,
    p_paid_on: input.paidOn,
    p_customer_name: input.customerName,
    p_bike_model: input.bikeModel,
    p_main_user_id: input.mainUserId,
    p_helper_user_id: input.helperUserId,
    p_items: input.items.map((item) => ({
      catalog_item_id: item.catalogItemId,
      item_name: item.itemName,
      qty: item.qty,
      unit_price_centavos: item.unitPriceCentavos,
      is_custom: item.isCustom,
    })),
    p_labor_total_centavos: input.laborTotalCentavos,
    p_helper_labor_centavos: input.helperLaborCentavos,
    p_extras: input.extras.map((extra) => ({
      user_id: extra.userId,
      amount_centavos: extra.amountCentavos,
      note: extra.note,
    })),
    p_payments: input.payments.map((payment) => ({
      method: payment.method,
      amount_centavos: payment.amountCentavos,
      gcash_recipient_id: payment.gcashRecipientId,
    })),
    p_changes: input.changes.map((change) => ({
      method: change.method,
      amount_centavos: change.amountCentavos,
      gcash_recipient_id: change.gcashRecipientId,
    })),
  });

  if (error) throw toAppError(error);
  return mapOrder(data as unknown as OrderRow);
}

export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('delete_sales_order', {
    p_order_id: orderId,
  });

  if (error) throw toAppError(error);
}

export async function listDailyReport(from: string, to: string): Promise<DailyReport[]> {
  const { data, error } = await getSupabaseClient()
    .from('v_sales_daily')
    .select(
      'paid_on,order_count,parts_total_centavos,labor_total_centavos,total_centavos,extras_total_centavos',
    )
    .gte('paid_on', from)
    .lte('paid_on', to)
    .order('paid_on', { ascending: false });

  if (error) throw toAppError(error);

  return (
    (data ?? []) as unknown as {
      paid_on: string;
      order_count: number;
      parts_total_centavos: number;
      labor_total_centavos: number;
      total_centavos: number;
      extras_total_centavos: number;
    }[]
  ).map((row) => ({
    paidOn: row.paid_on,
    orderCount: row.order_count,
    partsTotalCentavos: row.parts_total_centavos,
    laborTotalCentavos: row.labor_total_centavos,
    totalCentavos: row.total_centavos,
    extrasTotalCentavos: row.extras_total_centavos,
  }));
}

export async function listLaborReport(from: string, to: string): Promise<LaborReport[]> {
  const { data, error } = await getSupabaseClient()
    .from('v_sales_labor_daily')
    .select(
      'paid_on,user_id,display_name,base_labor_centavos,extras_centavos,labor_payout_centavos',
    )
    .gte('paid_on', from)
    .lte('paid_on', to)
    .order('paid_on', { ascending: false });

  if (error) throw toAppError(error);

  return (
    (data ?? []) as unknown as {
      paid_on: string;
      user_id: string;
      display_name: string;
      base_labor_centavos: number;
      extras_centavos: number;
      labor_payout_centavos: number;
    }[]
  ).map((row) => ({
    paidOn: row.paid_on,
    userId: row.user_id,
    displayName: row.display_name,
    baseLaborCentavos: row.base_labor_centavos,
    extrasCentavos: row.extras_centavos,
    laborPayoutCentavos: row.labor_payout_centavos,
  }));
}

export async function listPaymentsReport(from: string, to: string): Promise<PaymentsReport[]> {
  const { data, error } = await getSupabaseClient()
    .from('v_sales_payments_daily')
    .select('paid_on,method,received_centavos,change_centavos,net_centavos')
    .gte('paid_on', from)
    .lte('paid_on', to)
    .order('paid_on', { ascending: false });

  if (error) throw toAppError(error);

  return (
    (data ?? []) as unknown as {
      paid_on: string;
      method: 'CASH' | 'GCASH';
      received_centavos: number;
      change_centavos: number;
      net_centavos: number;
    }[]
  ).map((row) => ({
    paidOn: row.paid_on,
    method: row.method,
    receivedCentavos: row.received_centavos,
    changeCentavos: row.change_centavos,
    netCentavos: row.net_centavos,
  }));
}

export async function getGcashBalances(): Promise<GcashBalance[]> {
  const { data, error } = await getSupabaseClient().rpc('get_gcash_balances');
  if (error) throw toAppError(error);

  return (
    (data ?? []) as {
      user_id: string;
      display_name: string;
      shop_share_centavos: number;
      shop_transfers_centavos: number;
      shop_held_centavos: number;
      labor_share_centavos: number;
      labor_transfers_centavos: number;
      labor_held_centavos: number;
      labor_earned_centavos: number;
    }[]
  ).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    shopShareCentavos: row.shop_share_centavos,
    shopTransfersCentavos: row.shop_transfers_centavos,
    shopHeldCentavos: row.shop_held_centavos,
    laborShareCentavos: row.labor_share_centavos,
    laborTransfersCentavos: row.labor_transfers_centavos,
    laborHeldCentavos: row.labor_held_centavos,
    laborEarnedCentavos: row.labor_earned_centavos,
  }));
}

export async function listGcashTransfers(): Promise<GcashTransfer[]> {
  const { data, error } = await getSupabaseClient()
    .from('gcash_transfers')
    .select(
      'id,user_id,amount_centavos,destination,counterparty_user_id,reference,note,created_at,sender:profiles!gcash_transfers_user_id_fkey(display_name),counterparty:profiles!gcash_transfers_counterparty_user_id_fkey(display_name)',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw toAppError(error);

  return ((data ?? []) as unknown as TransferRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: embeddedName(row.sender),
    amountCentavos: row.amount_centavos,
    destination: row.destination,
    counterpartyUserId: row.counterparty_user_id,
    counterpartyName: embeddedName(row.counterparty),
    reference: row.reference,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function recordGcashTransfer(input: {
  userId: string;
  amountCentavos: number;
  destination: 'SHOP_BANK' | 'USER';
  counterpartyUserId: string | null;
  reference: string | null;
  note: string | null;
}): Promise<void> {
  const { error } = await getSupabaseClient().rpc('record_gcash_transfer', {
    p_user_id: input.userId,
    p_amount_centavos: input.amountCentavos,
    p_destination: input.destination,
    p_counterparty_user_id: input.counterpartyUserId,
    p_reference: input.reference,
    p_note: input.note,
  });

  if (error) throw toAppError(error);
}

export async function getPublicReceipt(token: string): Promise<PublicSalesReceipt | null> {
  const { data, error } = await getSupabaseClient().rpc('get_sales_receipt', {
    p_token: token,
  });

  if (error) throw toAppError(error);
  if (!data) return null;

  const payload = data as {
    shop: PublicSalesReceipt['shop'];
    order_no: string;
    business_date: string;
    paid_on: string;
    status: 'PAID' | 'EXPORTED';
    customer_name: string | null;
    bike_model: string | null;
    items: {
      name: string;
      qty: number;
      unit_price_centavos: number;
      line_total_centavos: number;
    }[];
    labor_total_centavos: number;
    total_centavos: number;
    extras_total_centavos: number;
    payments: { method: 'CASH' | 'GCASH'; amount_centavos: number }[];
    changes: { method: 'CASH' | 'GCASH'; amount_centavos: number }[];
  };

  return {
    shop: payload.shop,
    orderNo: payload.order_no,
    businessDate: payload.business_date,
    paidOn: payload.paid_on,
    status: payload.status,
    customerName: payload.customer_name,
    bikeModel: payload.bike_model,
    items: payload.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      unitPriceCentavos: item.unit_price_centavos,
      lineTotalCentavos: item.line_total_centavos,
    })),
    laborTotalCentavos: payload.labor_total_centavos,
    totalCentavos: payload.total_centavos,
    extrasTotalCentavos: payload.extras_total_centavos,
    payments: payload.payments.map((payment) => ({
      method: payment.method,
      amountCentavos: payment.amount_centavos,
    })),
    changes: payload.changes.map((change) => ({
      method: change.method,
      amountCentavos: change.amount_centavos,
    })),
  };
}

export async function getShopSettingsSummary(): Promise<ShopSettingsSummary> {
  const { data, error } = await getSupabaseClient()
    .from('shop_settings')
    .select('shop_name,address,contact,receipt_footer')
    .eq('id', 1)
    .single();

  if (error) throw toAppError(error);

  return {
    shopName: data.shop_name,
    address: data.address,
    contact: data.contact,
    receiptFooter: data.receipt_footer,
  };
}

export async function importCatalogItems(
  items: {
    name: string;
    description: string;
    sku: string | null;
    basePriceCentavos: number;
    itemType: string;
    incomeAccount: string;
    cogsAccount: string;
    assetAccount: string;
    preferredVendor: string;
    isActive: boolean;
  }[],
): Promise<{ inserted: number; updated: number; skipped: number }> {
  const { data, error } = await getSupabaseClient().rpc('import_catalog_items', {
    p_items: items.map((item) => ({
      name: item.name,
      description: item.description,
      sku: item.sku,
      base_price_centavos: item.basePriceCentavos,
      item_type: item.itemType,
      income_account: item.incomeAccount,
      cogs_account: item.cogsAccount,
      asset_account: item.assetAccount,
      preferred_vendor: item.preferredVendor,
      is_active: item.isActive,
    })),
  });

  if (error) throw toAppError(error);

  return data as { inserted: number; updated: number; skipped: number };
}
