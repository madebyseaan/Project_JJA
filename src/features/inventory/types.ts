export type Part = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  compatibleModels: string[];
  unitPriceCentavos: number;
  costPriceCentavos: number;
  stockOnHand: number;
  reservedQty: number;
  availableQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockMovement = {
  id: number;
  partId: string;
  delta: number;
  reason: 'INITIAL' | 'RESTOCK' | 'ADJUSTMENT' | 'SALE' | 'RETURN';
  ticketId: string | null;
  receiptId: string | null;
  actorId: string;
  actorName: string | null;
  note: string | null;
  createdAt: string;
};

export type PartCreateInput = {
  name: string;
  sku: string | null;
  category: string;
  compatibleModels: string[];
  unitPriceCentavos: number;
  costPriceCentavos: number;
  stockOnHand: number;
  lowStockThreshold: number;
};

export type PartUpdateInput = Omit<PartCreateInput, 'stockOnHand'> & {
  isActive: boolean;
};

export type StockAdjustmentInput = {
  delta: number;
  reason: 'RESTOCK' | 'ADJUSTMENT';
  note: string | null;
};
