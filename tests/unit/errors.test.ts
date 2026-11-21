import { describe, expect, test } from 'vitest';

import { AppError, toAppError } from '@/lib/errors';

describe('toAppError', () => {
  test('passes an AppError through unchanged', () => {
    const original = new AppError('FORBIDDEN', 'Nope');
    expect(toAppError(original)).toBe(original);
  });

  test('maps stable database codes to human messages', () => {
    expect(toAppError({ message: 'FORBIDDEN' }).code).toBe('FORBIDDEN');
    expect(toAppError({ message: 'NOT_VERIFIED' }).code).toBe('NOT_VERIFIED');
    expect(toAppError({ message: 'TICKET_NOT_OPEN' }).code).toBe('TICKET_NOT_OPEN');
    expect(toAppError({ message: 'PAYMENT_MISMATCH' }).code).toBe('PAYMENT_MISMATCH');
    expect(toAppError({ message: 'RECEIPT_NOT_ISSUED' }).code).toBe('RECEIPT_NOT_ISSUED');
    expect(toAppError({ message: 'ALREADY_COMPLETED' }).code).toBe('ALREADY_COMPLETED');
  });

  test('builds a specific insufficient-stock message from the detail payload', () => {
    const error = toAppError({
      message: 'INSUFFICIENT_STOCK',
      details: JSON.stringify({ part_name: 'Brake pad', available: 2 }),
    });

    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.message).toBe('Only 2 left of Brake pad. Reduce the quantity or restock.');
  });

  test('maps validation codes to a generic actionable message', () => {
    expect(toAppError({ message: 'INVALID_PRICE' }).code).toBe('INVALID_INPUT');
    expect(toAppError({ message: 'INVALID_QUANTITY' }).code).toBe('INVALID_INPUT');
  });

  test('maps network failures and hides unknown SQL errors', () => {
    expect(toAppError(new Error('Failed to fetch')).code).toBe('NETWORK');
    expect(toAppError({ message: 'relation "secret" does not exist' }).code).toBe('UNKNOWN');
    expect(toAppError(null).message).not.toContain('relation');
  });
});
