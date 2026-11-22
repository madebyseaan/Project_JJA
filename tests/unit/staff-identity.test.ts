import { expect, test } from 'vitest';

import {
  employeeIdToEmail,
  formatEmployeeIdInput,
  isValidEmployeeId,
  normalizeEmployeeId,
} from '@/lib/staff-identity';

test('normalizes an employee ID', () => {
  expect(normalizeEmployeeId('  jja-001 ')).toBe('JJA-001');
  expect(normalizeEmployeeId('jja-01')).toBe('JJA-001');
  expect(normalizeEmployeeId('jja1')).toBe('JJA-001');
  expect(normalizeEmployeeId('JJA-0001')).toBe('JJA-0001');
});

test('formats employee IDs while typing', () => {
  expect(formatEmployeeIdInput('jja001')).toBe('JJA-001');
  expect(formatEmployeeIdInput('jja-001')).toBe('JJA-001');
  expect(formatEmployeeIdInput('jja 001')).toBe('JJA-001');
  expect(formatEmployeeIdInput('JJA')).toBe('JJA');
  expect(formatEmployeeIdInput('JJA001A')).toBe('JJA-001A');
  expect(formatEmployeeIdInput('123')).toBe('123');
  expect(formatEmployeeIdInput('')).toBe('');
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
