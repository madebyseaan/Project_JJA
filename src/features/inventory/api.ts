import { toAppError } from '@/lib/errors';
import { getSupabaseClient } from '@/lib/supabase';

import type {
  Part,
  PartCreateInput,
  PartUpdateInput,
  StockAdjustmentInput,
  StockMovement,
} from './types';

const PART_COLUMNS = [
  'id',
  'name',
  'sku',
  'category',
  'compatible_models',
  'unit_price_centavos',
  'cost_price_centavos',
  'stock_on_hand',
  'reserved_qty',
  'available_qty',
  'low_stock_threshold',
  'is_active',
  'created_at',
  'updated_at',
].join(',');

type PartRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  compatible_models: string[];
  unit_price_centavos: number;
  cost_price_centavos: number;
  stock_on_hand: number;
  reserved_qty: number;
  available_qty: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type MovementRow = {
  id: number;
  part_id: string;
  delta: number;
  reason: StockMovement['reason'];
  ticket_id: string | null;
  receipt_id: string | null;
  actor_id: string;
  note: string | null;
  created_at: string;
  actor: { display_name: string }[] | { display_name: string } | null;
};

function actorName(row: MovementRow): string | null {
  if (Array.isArray(row.actor)) {
    return row.actor[0]?.display_name ?? null;
  }

  return row.actor?.display_name ?? null;
}

function mapPart(row: PartRow): Part {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    compatibleModels: row.compatible_models,
    unitPriceCentavos: row.unit_price_centavos,
    costPriceCentavos: row.cost_price_centavos,
    stockOnHand: row.stock_on_hand,
    reservedQty: row.reserved_qty,
    availableQty: row.available_qty,
    lowStockThreshold: row.low_stock_threshold,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    partId: row.part_id,
    delta: row.delta,
    reason: row.reason,
    ticketId: row.ticket_id,
    receiptId: row.receipt_id,
    actorId: row.actor_id,
    actorName: actorName(row),
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function listParts(): Promise<Part[]> {
  const { data, error } = await getSupabaseClient()
    .from('parts')
    .select(PART_COLUMNS)
    .order('name', { ascending: true });

  if (error) {
    throw toAppError(error);
  }

  return ((data ?? []) as unknown as PartRow[]).map(mapPart);
}

export async function listStockMovements(partId: string): Promise<StockMovement[]> {
  const { data, error } = await getSupabaseClient()
    .from('stock_movements')
    .select(
      'id,part_id,delta,reason,ticket_id,receipt_id,actor_id,note,created_at,actor:profiles!stock_movements_actor_id_fkey(display_name)',
    )
    .eq('part_id', partId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw toAppError(error);
  }

  return ((data ?? []) as unknown as MovementRow[]).map(mapMovement);
}

export async function createPart(input: PartCreateInput): Promise<Part> {
  const { data, error } = await getSupabaseClient().rpc('create_part', {
    p_name: input.name,
    p_sku: input.sku,
    p_category: input.category,
    p_compatible_models: input.compatibleModels,
    p_unit_price_centavos: input.unitPriceCentavos,
    p_cost_price_centavos: input.costPriceCentavos,
    p_stock_on_hand: input.stockOnHand,
    p_low_stock_threshold: input.lowStockThreshold,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapPart(data as PartRow);
}

export async function updatePart(partId: string, input: PartUpdateInput): Promise<Part> {
  const { data, error } = await getSupabaseClient().rpc('update_part', {
    p_part_id: partId,
    p_name: input.name,
    p_sku: input.sku,
    p_category: input.category,
    p_compatible_models: input.compatibleModels,
    p_unit_price_centavos: input.unitPriceCentavos,
    p_cost_price_centavos: input.costPriceCentavos,
    p_low_stock_threshold: input.lowStockThreshold,
    p_is_active: input.isActive,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapPart(data as PartRow);
}

export async function adjustStock(partId: string, input: StockAdjustmentInput): Promise<Part> {
  const { data, error } = await getSupabaseClient().rpc('adjust_stock', {
    p_part_id: partId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_note: input.note,
  });

  if (error) {
    throw toAppError(error);
  }

  return mapPart(data as PartRow);
}
