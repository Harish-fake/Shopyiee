'use strict';

/**
 * Centralised environment configuration.
 *
 * Values are read once at start-up so the rest of the codebase never touches
 * `process.env` directly.  Nothing here is ever written to an HTTP response.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Look for a .env in the backend folder first, then at the repository root.
const candidateEnvFiles = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
];
for (const file of candidateEnvFiles) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
    break;
  }
}

function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Builds the TLS options for the MySQL pool.
 *
 * Returns `undefined` when TLS is off, which is what `mysql2` expects for a
 * plaintext connection.
 *
 * Managed providers (Aiven and most hosted MySQL) refuse unencrypted
 * connections and hand you a CA certificate to verify them with:
 *
 *   DB_SSL=true                       encrypt and verify
 *   DB_SSL_CA=/path/to/ca.pem         verify against this CA (usually required)
 *   DB_SSL_REJECT_UNAUTHORIZED=false  encrypt but do not verify - see below
 *
 * Verification is on by default.  Turning it off still encrypts the connection
 * but accepts any certificate, which defeats the point: an attacker positioned
 * between the application and the database could present their own and read
 * everything.  It is available only for a throwaway environment, and it warns
 * at start-up so it cannot be left on by accident.
 */
function dbSsl() {
  if (!bool('DB_SSL', false)) return undefined;

  const options = { rejectUnauthorized: bool('DB_SSL_REJECT_UNAUTHORIZED', true) };

  const caPath = process.env.DB_SSL_CA;
  if (caPath) {
    const resolved = path.resolve(process.cwd(), caPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`DB_SSL_CA points at a file that does not exist: ${resolved}`);
    }
    options.ca = fs.readFileSync(resolved, 'utf8');
  }

  return options;
}

/**
 * Validates the SameSite policy for the session cookie.
 *
 * `None` is what a cross-origin deployment needs, but a browser silently
 * discards a `SameSite=None` cookie that is not also `Secure`.  The symptom is
 * a sign-in that appears to work and then immediately looks signed out, which
 * is miserable to diagnose - so the combination is rejected at start-up with an
 * explanation instead of failing quietly at request time.
 */
function cookieSameSite() {
  const raw = String(required('COOKIE_SAMESITE', 'lax')).toLowerCase();
  const allowed = ['lax', 'strict', 'none'];

  if (!allowed.includes(raw)) {
    throw new Error(`COOKIE_SAMESITE must be one of: ${allowed.join(', ')} (got "${raw}")`);
  }

  if (raw === 'none' && !bool('COOKIE_SECURE', false)) {
    throw new Error(
      'COOKIE_SAMESITE=none requires COOKIE_SECURE=true.\n' +
        '  Browsers discard a SameSite=None cookie that is not also Secure, which\n' +
        '  would leave every visitor silently signed out.  Set COOKIE_SECURE=true\n' +
        '  (the site must be served over HTTPS).'
    );
  }

  return raw;
}

const APP_MODE = required('APP_MODE', 'development').toLowerCase();
const VALID_MODES = ['development', 'testing', 'secure'];

if (!VALID_MODES.includes(APP_MODE)) {
  throw new Error(`APP_MODE must be one of ${VALID_MODES.join(', ')} (received "${APP_MODE}")`);
}

const NODE_ENV = required('NODE_ENV', APP_MODE === 'secure' ? 'production' : 'development');

const config = {
  appMode: APP_MODE,
  nodeEnv: NODE_ENV,

  /**
   * `secure` mode turns the hardened implementations on and leaves the
   * deliberately vulnerable routes unmounted.
   *
   * In `development` and `testing` the internal test endpoints described in
   * docs/security-testing.md are reachable so that the application can be
   * exercised with ordinary web-security tooling.
   */
  isSecureMode: APP_MODE === 'secure',
  isProductionLike: NODE_ENV === 'production' || APP_MODE === 'secure',

  port: int('PORT', 5000),

  /**
   * Interface the HTTP listener binds to.
   *
   * The default is loopback, so a developer running the API on a laptop does
   * not silently publish it to the local network (cafe / office / hotel Wi-Fi).
   * Container and reverse-proxy deployments set HOST=0.0.0.0 explicitly,
   * because there the reachability boundary is drawn by the Docker network and
   * the host firewall rather than by the bind address.
   */
  host: required('HOST', '127.0.0.1'),

  frontendOrigin: required('FRONTEND_ORIGIN', 'http://localhost:3000'),

  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3306),
    database: required('DB_NAME', 'shopping_store'),
    user: required('DB_USER', 'shop_app'),
    password: required('DB_PASSWORD', 'change_me_app_password'),
    connectionLimit: int('DB_CONNECTION_LIMIT', 10),
    ssl: dbSsl(),
  },

  session: {
    name: required('SESSION_NAME', 'shop.sid'),
    secret: required('SESSION_SECRET', 'insecure-development-session-secret'),
    maxAgeMs: int('SESSION_MAX_AGE_MS', 24 * 60 * 60 * 1000),
  },

  security: {
    enableCsrf: bool('ENABLE_CSRF', true),
    enableRateLimit: bool('ENABLE_RATE_LIMIT', true),
    /**
     * Emit helmet security headers (CSP, X-Frame-Options, Referrer-Policy,
     * HSTS and friends).  Set ENABLE_SECURITY_HEADERS=false for the
     * deliberately vulnerable sandbox so a scanner sees an ordinary,
     * header-free API and stored/reflected XSS payloads execute unhindered.
     */
    enableSecurityHeaders: bool('ENABLE_SECURITY_HEADERS', true),
    trustProxy: bool('TRUST_PROXY', false),
    // Set COOKIE_SECURE=true whenever the application is reached over HTTPS
    // (behind the TLS terminator described in the deployment guide).
    cookieSecure: bool('COOKIE_SECURE', false),
    /**
     * SameSite policy for the session cookie.
     *
     *   lax     the default, and correct whenever the storefront and the API
     *           share an origin (which is how the Docker setup serves them).
     *   strict  the cookie is withheld even on top-level cross-site navigation,
     *           so following a link into the shop arrives signed out.
     *   none    required when the storefront and the API are on different
     *           registrable domains - for example a static site on one host
     *           calling an API on another.  Browsers reject `None` without
     *           `Secure`, so the two are enforced together below.
     */
    cookieSameSite: cookieSameSite(),
  },

  wallet: {
    startingBalance: Number.parseFloat(required('WALLET_STARTING_BALANCE', '10000.00')),
  },

  logging: {
    httpFormat: required('HTTP_LOG_FORMAT', APP_MODE === 'secure' ? 'combined' : 'dev'),
    level: required('LOG_LEVEL', 'info'),
    /**
     * Unexpected failures are answered with a generic message in every mode.
     * A raw driver error can quote the offending SQL, a filesystem path or a
     * connection string, so echoing it to the client is an information
     * disclosure.  The full detail is always written to the server log; set
     * EXPOSE_ERROR_DETAILS=true only for local debugging.
     */
    exposeErrorDetails: bool('EXPOSE_ERROR_DETAILS', false),
  },
};

// Fail fast in secure mode when placeholder secrets are still in place.
if (config.isSecureMode) {
  const weakSecrets = ['change_me_generate_a_long_random_session_secret', 'insecure-development-session-secret'];
  if (weakSecrets.includes(config.session.secret) || config.session.secret.length < 32) {
    throw new Error(
      'APP_MODE=secure requires a strong SESSION_SECRET (>= 32 characters). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
}

module.exports = config;
