const STAFF_EMAIL_DOMAIN = 'staff.jja.internal';

export function normalizeEmployeeId(value: string): string {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]+)-?(\d{1,3})$/);

  if (match) {
    const prefix = match[1] ?? '';
    const digits = match[2] ?? '';
    return `${prefix}-${digits.padStart(3, '0')}`;
  }

  return normalized;
}

/**
 * Format employee IDs while typing: uppercase, and insert the separator after
 * the letter prefix. `jja001` and `jja 001` both become `JJA-001`.
 */
export function formatEmployeeIdInput(value: string): string {
  const upper = value.toUpperCase();
  const compact = upper.replace(/[\s-]/g, '');
  const match = compact.match(/^([A-Z]+)(\d.*)$/);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return upper;
}

export function isValidEmployeeId(value: string): boolean {
  return /^[A-Z0-9-]{2,20}$/.test(normalizeEmployeeId(value));
}

export function employeeIdToEmail(value: string): string {
  return `${normalizeEmployeeId(value).toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

export { STAFF_EMAIL_DOMAIN };
