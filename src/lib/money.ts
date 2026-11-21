const MAX_CENTAVOS = 2_147_483_647;

/**
 * Parse a peso string into integer centavos without floating-point arithmetic.
 * Accepts a leading ₱, commas, and surrounding spaces. Returns null when the
 * input is not a valid money value or exceeds the database integer range.
 */
export function parsePesoToCentavos(input: string): number | null {
  const compact = input.trim().replace(/[₱\s]/g, '');

  if (compact === '') {
    return null;
  }

  const negative = compact.startsWith('-');
  const unsigned = negative ? compact.slice(1) : compact;

  if (unsigned.includes(',')) {
    if (!/^\d{1,3}(,\d{3})*(\.\d{0,2})?$/.test(unsigned)) {
      return null;
    }
  } else if (!/^\d+(\.\d{0,2})?$/.test(unsigned)) {
    return null;
  }

  const cleaned = unsigned.replace(/,/g, '');
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const centavos = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));

  if (!Number.isSafeInteger(centavos) || centavos > MAX_CENTAVOS) {
    return null;
  }

  return negative ? -centavos : centavos;
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCentavos(centavos: number): string {
  return currencyFormatter.format(centavos / 100);
}

export function formatCentavosPlain(centavos: number): string {
  return plainFormatter.format(centavos / 100);
}

/** Format centavos for an editable peso input: no symbol, no grouping. */
export function formatPesoInput(centavos: number): string {
  const negative = centavos < 0;
  const absolute = Math.abs(centavos);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function sumCentavos(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
