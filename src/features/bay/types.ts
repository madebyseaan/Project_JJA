import type { TicketStatus } from '@/components/StatusBadge';

export type { TicketStatus };

export type TicketType = 'REPAIR' | 'SALE';

export type Ticket = {
  id: string;
  ticketNo: string;
  type: TicketType;
  status: TicketStatus;
  customerName: string | null;
  bikeModel: string | null;
  notes: string | null;
  partsTotalCentavos: number;
  laborTotalCentavos: number;
  totalCentavos: number;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketItem = {
  id: string;
  ticketId: string;
  partId: string;
  partName: string;
  qty: number;
  unitPriceCentavos: number;
  unitCostCentavos: number;
  lineTotalCentavos: number;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
};

export type TicketLabor = {
  id: string;
  ticketId: string;
  description: string;
  amountCentavos: number;
  createdBy: string;
  createdAt: string;
};

export type TicketDetail = {
  ticket: Ticket;
  items: TicketItem[];
  labor: TicketLabor[];
  payments: TicketPayment[];
  receipt: Receipt | null;
};

export type PaymentMethod = 'CASH' | 'GCASH' | 'MAYA' | 'OTHER';

export type TicketPayment = {
  id: string;
  ticketId: string;
  method: PaymentMethod;
  amountCentavos: number;
  referenceNo: string | null;
  receivedBy: string;
  receivedByName: string | null;
  receivedAt: string;
  note: string | null;
};

export type Receipt = {
  id: string;
  receiptNo: string;
  ticketId: string;
  status: 'ISSUED' | 'VOID';
  issuedAt: string;
  issuedBy: string;
  totalCentavos: number;
  verificationCode: string;
  publicToken: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type TicketLineInput = {
  partId: string;
  qty: number;
};

export type TicketLaborInput = {
  description: string;
  amountCentavos: number;
};

export type CreateTicketInput = {
  type: TicketType;
  customerName: string | null;
  bikeModel: string | null;
  notes: string | null;
  items: TicketLineInput[];
  labor: TicketLaborInput[];
};
