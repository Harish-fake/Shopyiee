'use strict';

/**
 * ===========================================================================
 *  INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING
 *  DO NOT USE THIS IMPLEMENTATION IN PRODUCTION
 * ===========================================================================
 *
 * Login built by concatenating the email and password straight into the SQL
 * string.  This module exists so the unsafe and safe paths can be compared
 * side by side; the parameterised + bcrypt equivalent lives in
 * `../services/authService.js`.  Loaded only when APP_MODE is `development`
 * or `testing`.
 *
 * Classic bypasses that "just work" through the login form (password field)
 * or via POST /api/auth/login (email field):
 *
 *   email:    ' OR '1'='1' #          password: anything
 *   email:    admin@shopsphere.test' OR '1'='1' #   password: anything
 *   email:    admin@shopsphere.test' #              password: anything
 *   email:    priya@example.test      password: x' OR '1'='1' #
 *
 * Safety rails that keep the exercise non-destructive (same as
 * vulnerableSearch.js):
 *
 *   1. The connection pool does not allow stacked queries
 *      (`multipleStatements: false`), so `'; DROP TABLE ...` cannot execute.
 *   2. `assertReadOnly()` rejects data-definition / data-modification
 *      keywords before the statement reaches MySQL.
 *   3. Malformed payloads surface the raw SQL error (error-based inference),
 *      exactly like the search endpoint.
 */

const { queryOne } = require('../config/db');
const config = require('../config/env');
const { unauthorized } = require('../utils/errors');
const logger = require('../utils/logger');

const FORBIDDEN_KEYWORDS = [
  'drop', 'delete', 'truncate', 'update', 'insert', 'replace', 'alter',
  'create', 'grant', 'revoke', 'rename', 'load_file', 'outfile', 'dumpfile',
  'shutdown', 'sleep', 'benchmark', 'information_schema', 'into',
];

function assertReadOnly(value, fieldName) {
  const lowered = String(value).toLowerCase();
  const hit = FORBIDDEN_KEYWORDS.find((keyword) => lowered.includes(keyword));
  if (hit) {
    logger.warn('Login input rejected by read-only safety rail', { fieldName, keyword: hit });
    throw unauthorized('Incorrect email address or password');
  }
  return value;
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    walletBalance: Number.parseFloat(row.wallet_balance),
    phone: row.phone,
    address: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    createdAt: row.created_at,
  };
}

/**
 * Authenticate with deliberately unsafe SQL.
 *
 * Returns true and the matched user when the interpolated query finds a row
 * (a payload such as `' OR '1'='1' #` makes it match any account).  When no
 * row matches, the caller falls through to the parameterised bcrypt path so
 * normal demo logins keep working.
 */
async function vulnerableMatch({ email, password }) {
  assertReadOnly(email, 'email');
  assertReadOnly(password, 'password');

  // ---- INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING -------------
  const row = await queryOne(
    `SELECT id, name, email, role, wallet_balance, phone, address_line, city, state,
            postal_code, country, is_active, created_at
     FROM users
     WHERE email = '${email}' AND password_hash = '${password}'
     LIMIT 1`
  );
  // --------------------------------------------------------------------------

  if (!row) return null;
  if (!row.is_active) {
    logger.warn('Sign-in blocked for disabled account', { userId: row.id });
    throw unauthorized('This account has been disabled');
  }
  logger.info('Sign-in successful (vulnerable path)', { userId: row.id, role: row.role, mode: config.isSecureMode ? 'secure' : 'development' });
  return mapUser(row);
}

module.exports = { vulnerableMatch };