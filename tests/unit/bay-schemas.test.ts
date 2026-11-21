import { describe, expect, test } from 'vitest';

import {
  laborFormSchema,
  newTicketSchema,
  statusActions,
  ticketTypeLabel,
} from '@/features/bay/schemas';

describe('bay schemas', () => {
  test('accepts a minimal ticket and rejects over-long fields', () => {
    expect(
      newTicketSchema.safeParse({
        type: 'REPAIR',
        customerName: '',
        bikeModel: '',
        notes: '',
      }).success,
    ).toBe(true);

    expect(
      newTicketSchema.safeParse({
        type: 'REPAIR',
        customerName: 'x'.repeat(121),
        bikeModel: '',
        notes: '',
      }).success,
    ).toBe(false);
  });

  test('validates labor descriptions and peso amounts', () => {
    expect(laborFormSchema.safeParse({ description: 'Install', amount: '250' }).success).toBe(true);
    expect(laborFormSchema.safeParse({ description: '', amount: '250' }).success).toBe(false);
    expect(laborFormSchema.safeParse({ description: 'Install', amount: '-1' }).success).toBe(false);
    expect(laborFormSchema.safeParse({ description: 'Install', amount: 'abc' }).success).toBe(
      false,
    );
  });

  test('offers only the allowed status transitions', () => {
    expect(statusActions('PENDING').map((action) => action.status)).toEqual([
      'VERIFYING',
      'IN_PROGRESS',
    ]);
    expect(statusActions('VERIFYING').map((action) => action.status)).toEqual(['IN_PROGRESS']);
    expect(statusActions('IN_PROGRESS').map((action) => action.status)).toEqual(['READY']);
    expect(statusActions('READY').map((action) => action.status)).toEqual(['IN_PROGRESS']);
    expect(statusActions('COMPLETED')).toEqual([]);
    expect(statusActions('CANCELLED')).toEqual([]);
    expect(statusActions('VOIDED')).toEqual([]);
  });

  test('labels the ticket type', () => {
    expect(ticketTypeLabel('REPAIR')).toBe('Repair');
    expect(ticketTypeLabel('SALE')).toBe('Sale');
  });
});
