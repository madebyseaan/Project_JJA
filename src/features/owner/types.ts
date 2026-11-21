import type { ReceiptSnapshot } from '@/features/receipts/types';

export type DayClose = {
  id: string;
  businessDate: string;
  expectedCashCentavos: number;
  countedCashCentavos: number;
  varianceCentavos: number;
  expectedGcashCentavos: number;
  expectedMayaCentavos: number;
  expectedOtherCentavos: number;
  notes: string | null;
  closedBy: string;
  closedAt: string;
};

export type DailySummary = {
  businessDate: string;
  sales: {
    receiptCount: number;
    partsCentavos: number;
    laborCentavos: number;
    totalCentavos: number;
  };
  payments: {
    cashCentavos: number;
    gcashCentavos: number;
    mayaCentavos: number;
    otherCentavos: number;
    totalCentavos: number;
  };
  expectedCashCentavos: number;
  voids: {
    receiptNo: string;
    totalCentavos: number;
    voidedAt: string | null;
    voidReason: string | null;
  }[];
  lowStock: {
    id: string;
    name: string;
    sku: string | null;
    availableQty: number;
    lowStockThreshold: number;
  }[];
  dayClose: DayClose | null;
};

export type ShopSettings = {
  shopName: string;
  address: string;
  contact: string;
  receiptFooter: string;
  lowStockDefault: number;
};

export type SalesReceipt = {
  id: string;
  receiptNo: string;
  status: 'ISSUED' | 'VOID';
  issuedAt: string;
  totalCentavos: number;
  verificationCode: string;
  publicToken: string;
  voidReason: string | null;
  snapshot: ReceiptSnapshot;
};

export type AuditEvent = {
  id: number;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type ReceiptIntegrity = {
  checkedAt: string;
  receiptCount: number;
  mismatches: {
    receiptNo: string;
    issuedAt: string;
    totalCentavos: number;
    storedHash: string;
    computedHash: string;
  }[];
  missingNumbers: {
    businessDate: string;
    receiptNo: string;
  }[];
  voided: {
    receiptNo: string;
    issuedAt: string;
    voidedAt: string | null;
    totalCentavos: number;
    voidReason: string | null;
  }[];
};
