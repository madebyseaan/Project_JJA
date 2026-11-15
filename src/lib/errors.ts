export type AppErrorCode =
  | 'MISSING_ENV'
  | 'AUTH_INVALID'
  | 'AUTH_RATE_LIMIT'
  | 'AUTH_NETWORK'
  | 'PROFILE_MISSING'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}
