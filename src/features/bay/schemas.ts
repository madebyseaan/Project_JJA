import { z } from 'zod';

import { parsePesoToCentavos } from '@/lib/money';

import type { TicketStatus, TicketType } from './types';

export const newTicketSchema = z.object({
  type: z.enum(['REPAIR', 'SALE']),
  customerName: z.string().trim().max(120, 'Keep the customer name under 120 characters.'),
  bikeModel: z.string().trim().max(120, 'Keep the bike model under 120 characters.'),
  notes: z.string().trim().max(500, 'Keep the note under 500 characters.'),
});

export type NewTicketValues = z.infer<typeof newTicketSchema>;

export const laborFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Describe the labor.')
    .max(120, 'Keep the description under 120 characters.'),
  amount: z
    .string()
    .trim()
    .min(1, 'Enter the labor amount.')
    .refine((value) => parsePesoToCentavos(value) !== null, 'Enter a valid peso amount.')
    .refine((value) => (parsePesoToCentavos(value) ?? 0) >= 0, 'Labor cannot be negative.'),
});

export type LaborFormValues = z.infer<typeof laborFormSchema>;

export type StatusAction = {
  label: string;
  status: TicketStatus;
};

const STATUS_ACTIONS: Record<TicketStatus, StatusAction[]> = {
  PENDING: [
    { label: 'Start verifying', status: 'VERIFYING' },
    { label: 'Start work', status: 'IN_PROGRESS' },
  ],
  VERIFYING: [{ label: 'Start work', status: 'IN_PROGRESS' }],
  IN_PROGRESS: [{ label: 'Mark ready', status: 'READY' }],
  READY: [{ label: 'Reopen', status: 'IN_PROGRESS' }],
  COMPLETED: [],
  CANCELLED: [],
  VOIDED: [],
};

export function statusActions(status: TicketStatus): StatusAction[] {
  return STATUS_ACTIONS[status];
}

export function ticketTypeLabel(type: TicketType): string {
  return type === 'REPAIR' ? 'Repair' : 'Sale';
}
