/**
 * Application error type shared by the core pipeline and both front doors.
 *
 * Codes and statuses match docs/api-contract.md exactly:
 *   unauthorized (401), forbidden (403), not_found (404),
 *   validation_error (400), conflict (409), not_connected (409),
 *   upstream_error (502), internal_error (500).
 */

export type AppErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'conflict'
  | 'not_connected'
  | 'upstream_error'
  | 'internal_error';

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Convenience factories --------------------------------------------------

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError('unauthorized', message, 401);
}

export function forbidden(message = 'Forbidden'): AppError {
  return new AppError('forbidden', message, 403);
}

export function notFound(message = 'Not found'): AppError {
  return new AppError('not_found', message, 404);
}

export function validationError(message = 'Invalid request'): AppError {
  return new AppError('validation_error', message, 400);
}

export function conflict(message = 'Conflict'): AppError {
  return new AppError('conflict', message, 409);
}

/** The user has not linked (or needs to re-link) a provider account. */
export function notConnected(message = 'Account not connected'): AppError {
  return new AppError('not_connected', message, 409);
}

export function upstreamError(message = 'Upstream service failed'): AppError {
  return new AppError('upstream_error', message, 502);
}

export function internalError(message = 'Internal server error'): AppError {
  return new AppError('internal_error', message, 500);
}
