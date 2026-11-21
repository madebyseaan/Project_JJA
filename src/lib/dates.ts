export const MANILA_TIME_ZONE = 'Asia/Manila';

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MANILA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: MANILA_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: MANILA_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

function toDate(iso: string | Date): Date | null {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The shop's business date as YYYY-MM-DD. Invalid dates return an empty key. */
export function manilaDateKey(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = dateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

export function formatManilaDate(iso: string | Date): string {
  const date = toDate(iso);
  return date ? dateFormatter.format(date) : '—';
}

export function formatManilaTime(iso: string | Date): string {
  const date = toDate(iso);
  return date ? timeFormatter.format(date) : '—';
}

export function formatManilaDateTime(iso: string | Date): string {
  const date = toDate(iso);

  if (!date) {
    return '—';
  }

  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
}

export function ageInHours(iso: string, now: number = Date.now()): number {
  const date = toDate(iso);
  return date ? Math.max(0, (now - date.getTime()) / 3_600_000) : 0;
}

export function isOlderThan(iso: string, hours: number, now: number = Date.now()): boolean {
  return ageInHours(iso, now) > hours;
}
