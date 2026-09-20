'use strict';

/**
 * Hardened authorization helpers.
 *
 * Every decision is made from data the client cannot influence:
 *
 *   - the authenticated user id comes from the server-side session record,
 *   - the role is re-read from the `users` table on each request by
 *     `middleware/auth.js#attachUser`,
 *   - ownership checks are expressed as SQL predicates rather than applied
 *     after the fact in JavaScript.
 */

const { queryOne } = require('../config/db');
const { forbidden, unauthorized, notFound } = require('../utils/errors');
const logger = require('../utils/logger');

/** Administrator gate used by every hardened admin route. */
function requireAdminSecure(req, _res, next) {
  if (!req.user) return next(unauthorized('You must be signed in to do that'));

  if (req.user.role !== 'ADMIN') {
    logger.warn('Authorization failure: admin role required', {
      userId: req.user.id,
      path: req.originalUrl,
      method: req.method,
      mode: 'secure',
    });
    return next(forbidden('Administrator privileges are required for this resource'));
  }

  return next();
}

/**
 * Confirm that a record belongs to the signed-in account.
 *
 * @param {object}   options
 * @param {string}   options.table       Table to inspect (allow-listed).
 * @param {string}   [options.ownerColumn='user_id']
 * @param {string}   [options.idColumn='id']
 * @param {boolean}  [options.allowAdmin=true] Administrators may bypass the check.
 */
function requireOwnership(options) {
  const { table, ownerColumn = 'user_id', idColumn = 'id', allowAdmin = true } = options;

  const ALLOWED_TABLES = ['orders', 'reviews', 'cart_items', 'wishlist', 'transactions'];
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`requireOwnership: unsupported table "${table}"`);
  }

  return async function ownershipGuard(req, _res, next) {
    try {
      if (!req.user) return next(unauthorized('You must be signed in to do that'));

      const recordId = req.params.id;
      if (!recordId) return next(notFound('Resource not found'));

      // The predicate is evaluated by the database, so a record that belongs to
      // somebody else simply is not found.
      const sql = `SELECT ${idColumn} AS id, ${ownerColumn} AS owner_id FROM ${table} WHERE ${idColumn} = ? LIMIT 1`;
      const record = await queryOne(sql, [recordId]);

      if (!record) return next(notFound('Resource not found'));

      const isOwner = Number(record.owner_id) === Number(req.user.id);
      const isAdmin = allowAdmin && req.user.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        logger.warn('Authorization failure: ownership check rejected', {
          userId: req.user.id,
          table,
          recordId,
          path: req.originalUrl,
        });
        // Return 404 rather than 403 so the existence of the record is not
        // disclosed to an unrelated account.
        return next(notFound('Resource not found'));
      }

      req.ownershipVerified = true;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** Confirm the signed-in account matches the id in the route. */
function requireSelf(paramName = 'id') {
  return function selfGuard(req, _res, next) {
    if (!req.user) return next(unauthorized('You must be signed in to do that'));
    if (Number(req.params[paramName]) !== Number(req.user.id) && req.user.role !== 'ADMIN') {
      return next(forbidden('You can only access your own account'));
    }
    return next();
  };
}

module.exports = { requireAdminSecure, requireOwnership, requireSelf };
