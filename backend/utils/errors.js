'use strict';

/**
 * Application error types.
 *
 * `ApiError` carries the HTTP status and a client-safe message.  Anything that
 * is not an `ApiError` is treated as an unexpected failure: the details are
 * logged server-side and a generic message is returned to the client so that
 * stack traces, SQL fragments and configuration values never leak.
 */

class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

const badRequest = (message = 'Invalid request', details) => new ApiError(400, message, details);
const unauthorized = (message = 'Authentication required') => new ApiError(401, message);
const forbidden = (message = 'You do not have permission to perform this action') => new ApiError(403, message);
const notFound = (message = 'Resource not found') => new ApiError(404, message);
const conflict = (message = 'Resource already exists') => new ApiError(409, message);
const unprocessable = (message = 'Request could not be processed', details) => new ApiError(422, message, details);

module.exports = {
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
};
