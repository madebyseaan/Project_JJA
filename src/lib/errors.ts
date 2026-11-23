export type AppErrorCode =
  | 'MISSING_ENV'
  | 'AUTH_INVALID'
  | 'AUTH_RATE_LIMIT'
  | 'AUTH_NETWORK'
  | 'PROFILE_MISSING'
  | 'INSUFFICIENT_STOCK'
  | 'PAYMENT_MISMATCH'
  | 'TICKET_NOT_OPEN'
  | 'NOT_VERIFIED'
  | 'FORBIDDEN'
  | 'RECEIPT_NOT_ISSUED'
  | 'ALREADY_COMPLETED'
  | 'INVALID_DATE'
  | 'INVALID_LABOR_SPLIT'
  | 'CHANGE_TOO_LARGE'
  | 'EMPTY_ORDER'
  | 'INSUFFICIENT_GCASH'
  | 'PAYMENT_REQUIRED'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_LOCKED'
  | 'INVALID_INPUT'
  | 'NETWORK'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}

const UNKNOWN_MESSAGE = 'Something went wrong. Try again; if it persists, contact Sean.';

const DEFAULT_MESSAGES: Record<string, string> = {
  FORBIDDEN: 'You do not have access to this action.',
  NOT_VERIFIED: 'Verify all parts before completing the ticket.',
  TICKET_NOT_OPEN: 'This ticket is already closed.',
  ALREADY_COMPLETED: 'This ticket is already completed.',
  RECEIPT_NOT_ISSUED: 'This sale has no active receipt.',
  PAYMENT_MISMATCH: 'Payments do not match the total and extras.',
  INSUFFICIENT_STOCK: 'Not enough stock for this part. Reduce the quantity or restock.',
  INVALID_DATE: 'Choose a valid date. The payment date cannot be before the job or in the future.',
  INVALID_LABOR_SPLIT: 'The helper’s share cannot be more than the total labor.',
  CHANGE_TOO_LARGE: 'Change cannot be more than the payment for that method.',
  EMPTY_ORDER: 'Add at least one item, labor, or extra.',
  INSUFFICIENT_GCASH: 'That is more than the GCash held. Check the balance and try again.',
  PAYMENT_REQUIRED: 'Add the payment or remove the extras before saving.',
  ORDER_NOT_FOUND: 'This order was not found. It may have been removed.',
  ORDER_LOCKED: 'This month has been exported. Corrections are made in QuickBooks.',
  INVALID_INPUT: 'Check the entered values and try again.',
  NETWORK: 'No connection. Nothing was saved.',
  UNKNOWN: UNKNOWN_MESSAGE,
};

const CODE_MESSAGES: Record<string, AppErrorCode> = {
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  PAYMENT_MISMATCH: 'PAYMENT_MISMATCH',
  TICKET_NOT_OPEN: 'TICKET_NOT_OPEN',
  NOT_VERIFIED: 'NOT_VERIFIED',
  FORBIDDEN: 'FORBIDDEN',
  RECEIPT_NOT_ISSUED: 'RECEIPT_NOT_ISSUED',
  ALREADY_COMPLETED: 'ALREADY_COMPLETED',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_LABOR_SPLIT: 'INVALID_LABOR_SPLIT',
  CHANGE_TOO_LARGE: 'CHANGE_TOO_LARGE',
  EMPTY_ORDER: 'EMPTY_ORDER',
  INSUFFICIENT_GCASH: 'INSUFFICIENT_GCASH',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_LOCKED: 'ORDER_LOCKED',
};

const INVALID_INPUT_CODES = new Set([
  'INVALID_NAME',
  'INVALID_SKU',
  'INVALID_CATEGORY',
  'INVALID_PRICE',
  'INVALID_COST',
  'INVALID_STOCK',
  'INVALID_THRESHOLD',
  'INVALID_MODELS',
  'INVALID_QUANTITY',
  'INVALID_QTY',
  'INVALID_REASON',
  'INVALID_NOTE',
  'INVALID_AMOUNT',
  'INVALID_METHOD',
  'INVALID_REFERENCE',
  'INVALID_TYPE',
  'INVALID_ITEMS',
  'INVALID_PAYMENTS',
  'INVALID_DESCRIPTION',
  'INVALID_STATUS',
  'INVALID_STATUS_TRANSITION',
  'INVALID_CUSTOMER',
  'INVALID_BIKE',
  'INVALID_ITEM',
  'INVALID_ITEM_NAME',
  'INVALID_LABOR',
  'INVALID_EXTRA',
  'INVALID_EXTRA_USER',
  'INVALID_MAIN_USER',
  'INVALID_HELPER',
  'INVALID_GCASH_RECIPIENT',
  'INVALID_CASH_RECIPIENT',
  'INVALID_DESTINATION',
  'INVALID_COUNTERPARTY',
  'INVALID_ORDER_DATA',
  'INVALID_USER',
  'EMPTY_TICKET',
  'PART_NOT_FOUND',
  'PART_INACTIVE',
  'ITEM_NOT_FOUND',
  'LABOR_NOT_FOUND',
  'TICKET_NOT_FOUND',
  'RECEIPT_NOT_FOUND',
]);

type ErrorLike = {
  message?: unknown;
  details?: unknown;
  code?: unknown;
};

function asErrorLike(error: unknown): ErrorLike | null {
  if (typeof error === 'object' && error !== null) {
    return error as ErrorLike;
  }

  return null;
}

function detailMessage(details: unknown): string | null {
  if (typeof details !== 'string' || details.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(details) as { part_name?: unknown; available?: unknown };

    if (typeof parsed.part_name === 'string' && typeof parsed.available === 'number') {
      return `Only ${parsed.available} left of ${parsed.part_name}. Reduce the quantity or restock.`;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Convert a database or network failure into a stable, human message.
 * Raw SQL errors never reach the UI.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const like = asErrorLike(error);
  const rawMessage = typeof like?.message === 'string' ? like.message : String(error);
  const rawCode = rawMessage.trim().split(/[:\s]/)[0];
  const code = rawCode ?? rawMessage;

  if (code === 'INSUFFICIENT_STOCK') {
    const detail = detailMessage(like?.details);
    return new AppError(
      'INSUFFICIENT_STOCK',
      detail ?? DEFAULT_MESSAGES.INSUFFICIENT_STOCK ?? UNKNOWN_MESSAGE,
    );
  }

  const mappedCode = CODE_MESSAGES[code];

  if (mappedCode) {
    return new AppError(mappedCode, DEFAULT_MESSAGES[mappedCode] ?? UNKNOWN_MESSAGE);
  }

  if (INVALID_INPUT_CODES.has(code)) {
    return new AppError('INVALID_INPUT', DEFAULT_MESSAGES.INVALID_INPUT ?? UNKNOWN_MESSAGE);
  }

  if (
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('Load failed') ||
    rawMessage.includes('network')
  ) {
    return new AppError('NETWORK', DEFAULT_MESSAGES.NETWORK ?? UNKNOWN_MESSAGE);
  }

  return new AppError('UNKNOWN', UNKNOWN_MESSAGE, { cause: error });
}
