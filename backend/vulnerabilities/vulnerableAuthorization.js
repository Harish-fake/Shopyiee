'use strict';

/**
 * ===========================================================================
 *  INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING
 *  DO NOT USE THIS IMPLEMENTATION IN PRODUCTION
 * ===========================================================================
 *
 * Administrator authorization.
 *
 * The check below accepts *either* of two values:
 *
 *   - the role held in the server-side session, or
 *   - the `lab_role` cookie, which is entirely controlled by the browser.
 *
 * Because the second source is client-controlled, any visitor can present
 * `lab_role=admin` and satisfy the check.  The cookie is never issued by the
 * application and is never referenced anywhere in the user interface; it exists
 * purely so that the flaw can be exercised with a proxy or an intercepting
 * tool.
 *
 * `../secure/secureAuthorization.js` resolves the role exclusively from the
 * session record.  Loaded only when APP_MODE is `development` or `testing`.
 */

const { forbidden, unauthorized } = require('../utils/errors');
const logger = require('../utils/logger');

const LAB_ROLE_COOKIE = 'lab_role';

/**
 * INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING.
 *
 * @param {object} options
 * @param {boolean} options.requireAuthentication  When false, a session is not
 *        required at all - the cookie alone is enough.  Defaults to true so the
 *        endpoint still looks like an ordinary authenticated route.
 */
function requireAdminVulnerable(options = {}) {
  const requireAuthentication = options.requireAuthentication !== false;

  return function adminAuthorization(req, _res, next) {
    const sessionRole = req.session?.user?.role ?? null;
    const cookieRole = req.cookies?.[LAB_ROLE_COOKIE] ?? null; // <- untrusted input

    if (requireAuthentication && !req.user && !sessionRole) {
      return next(unauthorized('You must be signed in to do that'));
    }

    // INTENTIONALLY VULNERABLE: a client-supplied cookie can grant the role.
    const effectiveRole = sessionRole === 'ADMIN' || cookieRole === 'admin' ? 'ADMIN' : 'USER';

    if (effectiveRole !== 'ADMIN') {
      logger.warn('Authorization failure: admin role required', {
        userId: req.user?.id ?? null,
        path: req.originalUrl,
        method: req.method,
        mode: 'development',
      });
      return next(forbidden('Administrator privileges are required for this resource'));
    }

    req.authorizationSource = sessionRole === 'ADMIN' ? 'session' : 'client-cookie';
    return next();
  };
}

module.exports = { requireAdminVulnerable, LAB_ROLE_COOKIE };
