'use strict';

/**
 * Wrap an async route handler so rejected promises reach the Express error
 * middleware instead of becoming unhandled rejections.
 */
module.exports = function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
