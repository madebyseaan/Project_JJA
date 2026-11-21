import { describe, expect, test } from 'vitest';

import { escapeCsvFormula, toCsv } from '@/lib/csv';

describe('CSV export', () => {
  test('escapes formula injection characters', () => {
    expect(escapeCsvFormula('=1+1')).toBe("'=1+1");
    expect(escapeCsvFormula('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(escapeCsvFormula('-2')).toBe("'-2");
    expect(escapeCsvFormula('@cmd')).toBe("'@cmd");
    expect(escapeCsvFormula('Normal part')).toBe('Normal part');
  });

  test('writes the requested columns in order', () => {
    const csv = toCsv(
      [
        { receipt_no: '20261121-0001', total_centavos: 35000 },
        { receipt_no: '=HACK', total_centavos: 100 },
      ],
      [
        { key: 'receipt_no', label: 'Receipt' },
        { key: 'total_centavos', label: 'Total' },
      ],
    );

    expect(csv.split(/\r?\n/)[0]).toBe('Receipt,Total');
    expect(csv).toContain("'=HACK,100");
    expect(csv).toContain('20261121-0001,35000');
  });
});
