const PIN_KEY_PREFIX = 'jja.pin.';

export type PinRecord = {
  salt: string;
  hash: string;
  attempts: number;
};

function storageKey(userId: string): string {
  return `${PIN_KEY_PREFIX}${userId}`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equalHashes(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

export function getPinRecord(userId: string): PinRecord | null {
  const raw = localStorage.getItem(storageKey(userId));

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PinRecord;

    if (
      typeof parsed.salt !== 'string' ||
      typeof parsed.hash !== 'string' ||
      typeof parsed.attempts !== 'number'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function savePin(userId: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits.');
  }

  const salt = randomSalt();
  const hash = await hashPin(pin, salt);

  localStorage.setItem(storageKey(userId), JSON.stringify({ salt, hash, attempts: 0 }));
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const hash = await hashPin(pin, record.salt);
  return equalHashes(hash, record.hash);
}

export function clearPin(userId: string): void {
  localStorage.removeItem(storageKey(userId));
}

export function recordFailedAttempt(userId: string): number {
  const record = getPinRecord(userId);

  if (!record) return 0;

  const attempts = record.attempts + 1;
  localStorage.setItem(storageKey(userId), JSON.stringify({ ...record, attempts }));
  return attempts;
}

export function resetAttempts(userId: string): void {
  const record = getPinRecord(userId);

  if (!record) return;

  localStorage.setItem(storageKey(userId), JSON.stringify({ ...record, attempts: 0 }));
}
