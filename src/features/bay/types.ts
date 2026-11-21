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
