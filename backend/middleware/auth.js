'use strict';

/**
 * Authentication middleware.
 *
 * The authenticated identity always comes from the server-side session record,
 * never from a request header, body field or client-set cookie.  This is the
 * trusted source that the hardened authorization checks rely on.
 */

const { queryOne } = require('../config/db');
const { unauthorized } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Populate `req.user` from the session, refreshing it from the database when
 * possible so that role and balance changes take effect immediately.
 */
async function attachUser(req, _res, next) {
  req.user = null;

  const sessionUser = req.session?.user;
  if (!sessionUser?.id) return next();

  try {
    const row = await queryOne(
      'SELECT id, name, email, role, wallet_balance, is_active FROM users WHERE id = ? LIMIT 1',
      [sessionUser.id]
    );

    if (!row || !row.is_active) {
      req.session.destroy(() => {});
      return next();
    }

    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      walletBalance: Number.parseFloat(row.wallet_balance),
    };
    // Keep the session copy in sync with the database.
    req.session.user = { id: row.id, name: row.name, email: row.email, role: row.role };

    return next();
  } catch (error) {
    return next(error);
  }
}

/** Reject the request unless an authenticated user is present. */
function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized('You must be signed in to do that'));
  return next();
}

/**
 * Hardened administrator check.
 *
 * The role is read from the server-side user record loaded by `attachUser`.
 * Any client-supplied value (cookie, header, query string or body field) is
 * ignored entirely.
 */
function requireAdminSecure(req, _res, next) {
  if (!req.user) return next(unauthorized('You must be signed in to do that'));

  if (req.user.role !== 'ADMIN') {
    logger.warn('Authorization failure: admin role required', {
      userId: req.user.id,
      path: req.originalUrl,
      method: req.method,
    });
    return next(
      require('../utils/errors').forbidden('Administrator privileges are required for this resource')
    );
  }

  return next();
}

/** Attach `req.session.user` after a successful login. */
function establishSession(req, user) {
  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  req.session.authenticatedAt = Date.now();
}

module.exports = { attachUser, requireAuth, requireAdminSecure, establishSession };
