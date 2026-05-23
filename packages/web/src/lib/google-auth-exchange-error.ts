/** Shared error type for Google backend exchange (safe for client + server imports). */
export class GoogleAuthExchangeError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'GoogleAuthExchangeError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
