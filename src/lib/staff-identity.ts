const STAFF_EMAIL_DOMAIN = 'staff.jja.internal';

export function normalizeEmployeeId(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidEmployeeId(value: string): boolean {
  return /^[A-Z0-9-]{2,20}$/.test(normalizeEmployeeId(value));
}

export function employeeIdToEmail(value: string): string {
  return `${normalizeEmployeeId(value).toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

export { STAFF_EMAIL_DOMAIN };
