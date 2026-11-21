import { describe, expect, test } from 'vitest';

import {
  formatCentavos,
  formatCentavosPlain,
  formatPesoInput,
  parsePesoToCentavos,
  sumCentavos,
} from '@/lib/money';

describe('parsePesoToCentavos', () => {
  test('parses whole pesos, decimals, and grouped input', () => {
    expect(parsePesoToCentavos('125')).toBe(12500);
    expect(parsePesoToCentavos('1,250.50')).toBe(125050);
    expect(parsePesoToCentavos('₱ 1 250.05')).toBe(125005);
    expect(parsePesoToCentavos('0.5')).toBe(50);
    expect(parsePesoToCentavos('.75')).toBeNull();
  });

  test('parses negatives for refunds and adjustments', () => {
    expect(parsePesoToCentavos('-250')).toBe(-25000);
    expect(parsePesoToCentavos('-0.01')).toBe(-1);
  });

  test('rejects malformed and out-of-range values', () => {
    expect(parsePesoToCentavos('')).toBeNull();
    expect(parsePesoToCentavos('abc')).toBeNull();
    expect(parsePesoToCentavos('1.234')).toBeNull();
    expect(parsePesoToCentavos('1,2,3')).toBeNull();
    expect(parsePesoToCentavos('21474836.48')).toBeNull();
    expect(parsePesoToCentavos('99999999999999999999')).toBeNull();
  });

  test('never round-trips through a float', () => {
    expect(parsePesoToCentavos('0.29')).toBe(29);
    expect(parsePesoToCentavos('19.99')).toBe(1999);
    expect(parsePesoToCentavos('1234567.89')).toBe(123456789);
  });
});

describe('formatting', () => {
  test('formats pesos with the Philippine currency symbol', () => {
    expect(formatCentavos(125050)).toBe('₱1,250.50');
    expect(formatCentavos(0)).toBe('₱0.00');
    expect(formatCentavos(-25000)).toBe('-₱250.00');
  });

  test('formats plain and editable values', () => {
    expect(formatCentavosPlain(125050)).toBe('1,250.50');
    expect(formatPesoInput(125050)).toBe('1250.50');
    expect(formatPesoInput(5)).toBe('0.05');
    expect(formatPesoInput(-5)).toBe('-0.05');
  });

  test('sums centavos as integers', () => {
    expect(sumCentavos([100, 250, 5])).toBe(355);
    expect(sumCentavos([])).toBe(0);
  });
});
