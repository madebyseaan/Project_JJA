import { expect, test } from 'vitest';

import { employeeIdToEmail, isValidEmployeeId, normalizeEmployeeId } from '@/lib/staff-identity';

test('normalizes an employee ID', () => {
  expect(normalizeEmployeeId('  jja-001 ')).toBe('JJA-001');
});

test('validates employee IDs', () => {
  expect(isValidEmployeeId('JJA-001')).toBe(true);
  expect(isValidEmployeeId('jja-002')).toBe(true);
  expect(isValidEmployeeId('not an id')).toBe(false);
  expect(isValidEmployeeId('A')).toBe(false);
});

test('maps an employee ID to the hidden auth email', () => {
  expect(employeeIdToEmail(' jja-001 ')).toBe('jja-001@staff.jja.internal');
});
