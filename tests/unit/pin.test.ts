import { beforeEach, expect, test } from 'vitest';

import {
  clearPin,
  getPinRecord,
  recordFailedAttempt,
  resetAttempts,
  savePin,
  verifyPin,
  type PinRecord,
} from '@/features/auth/pin';

beforeEach(() => {
  localStorage.clear();
});

test('saves and verifies a PIN', async () => {
  await savePin('user-1', '1234');

  const record = getPinRecord('user-1');

  expect(record).not.toBeNull();

  const saved = record as PinRecord;

  expect(saved.attempts).toBe(0);
  expect(await verifyPin('1234', saved)).toBe(true);
  expect(await verifyPin('0000', saved)).toBe(false);
});

test('uses a unique salt for every save', async () => {
  await savePin('user-1', '1234');
  const first = getPinRecord('user-1') as PinRecord;

  localStorage.clear();

  await savePin('user-2', '1234');
  const second = getPinRecord('user-2') as PinRecord;

  expect(first.salt).not.toBe(second.salt);
  expect(first.hash).not.toBe(second.hash);
});

test('counts failed attempts and resets them', async () => {
  await savePin('user-1', '1234');

  expect(recordFailedAttempt('user-1')).toBe(1);
  expect(recordFailedAttempt('user-1')).toBe(2);
  expect(getPinRecord('user-1')?.attempts).toBe(2);

  resetAttempts('user-1');
  expect(getPinRecord('user-1')?.attempts).toBe(0);
});

test('clears a PIN', async () => {
  await savePin('user-1', '1234');
  clearPin('user-1');

  expect(getPinRecord('user-1')).toBeNull();
});

test('rejects a PIN that is not four digits', async () => {
  await expect(savePin('user-1', '12')).rejects.toThrow('4 digits');
});
