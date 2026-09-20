'use strict';

/**
 * CSRF protection using the synchroniser-token pattern.
 *
 * A random token is generated per session and handed to the client through
 * `GET /api/auth/csrf`.  State-changing requests must echo it back in the
 * `X-CSRF-Token` header.  Because the token is bound to the server-side session
 * and the browser cannot read it cross-origin, a forged request from another
 * site cannot supply a valid value.
 *
 * Enforcement is switched on for hardened routes.  It is relaxed outside
 * `secure` mode so that the application remains straightforward to exercise
 * with the tooling listed in docs/security-testing.md.
 */

const crypto = require('crypto');
const config = require('../config/env');
const { forbidden } = require('../utils/errors');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function ensureToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/** Endpoint handler that returns the current session's token. */
function issueToken(req, res) {
  const token = ensureToken(req);
  res.json({ success: true, data: { csrfToken: token } });
}

/**
 * Verify the token on state-changing requests.
 *
 * @param {object}  options
 * @param {boolean} options.enforce  Force enforcement even outside secure mode.
 */
function csrfProtection(options = {}) {
  const enforce = options.enforce ?? config.isSecureMode;

  return function csrfMiddleware(req, res, next) {
    if (SAFE_METHODS.includes(req.method)) return next();
    if (!config.security.enableCsrf || !enforce) return next();

    const expected = req.session?.csrfToken;
    const provided = req.get('x-csrf-token') || req.body?._csrf;

    if (!expected || !provided || !timingSafeEqual(expected, provided)) {
      return next(forbidden('Your session token is missing or has expired. Please refresh the page.'));
    }

    return next();
  };
}

function timingSafeEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

module.exports = { issueToken, csrfProtection, ensureToken };
