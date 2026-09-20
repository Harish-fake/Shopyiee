'use strict';

/**
 * Central error handling.
 *
 * Responses follow a single shape so the frontend can rely on it:
 *
 *   { "success": false, "error": { "message": "...", "code": "..." } }
 *
 * Expected failures (`ApiError`) keep their message.  Anything else is treated
 * as a defect: the full detail is written to the server log and the client
 * receives a generic message, so stack traces, SQL fragments, filesystem paths
 * and configuration values are never exposed over HTTP.
 */

const config = require('../config/env');
const { ApiError } = require('../utils/errors');
const logger = require('../utils/logger');

function notFound(req, _res, next) {
  next(new ApiError(404, `Cannot ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity
function errorHandler(err, req, res, _next) {
  const isExpected = err instanceof ApiError;
  const status = isExpected ? err.status : 500;

  // eslint-disable-next-line no-unused-vars
  const requestContext = {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id ?? null,
    ip: req.ip,
  };

  if (isExpected) {
    logger.warn('Request rejected', { ...requestContext, status, message: err.message });
  } else {
    logger.error('Unhandled application error', {
      ...requestContext,
      message: err.message,
      code: err.code,
      // Stack traces are logged server-side only.
      stack: err.stack ? err.stack.split('\n').slice(0, 6).join(' | ') : undefined,
    });
  }

  /**
   * Expected failures carry a message written for the client.  Anything else is
   * a defect, and a driver error can quote SQL, a filesystem path or a
   * connection string - so it is answered generically unless an operator has
   * explicitly opted in to seeing the detail.
   */
  const clientMessage = isExpected
    ? err.message
    : config.logging.exposeErrorDetails
      ? err.message
      : 'Something went wrong. Please try again.';

  const body = {
    success: false,
    error: {
      message: clientMessage,
      code: isExpected ? err.code || httpCodeToLabel(status) : 'INTERNAL_ERROR',
    },
  };

  if (isExpected && err.details) body.error.details = err.details;

  res.status(status).json(body);
}

function httpCodeToLabel(status) {
  return (
    {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE',
      429: 'RATE_LIMITED',
    }[status] || 'ERROR'
  );
}

module.exports = { notFound, errorHandler };
