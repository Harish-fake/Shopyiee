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
  frontendOrigin: required('FRONTEND_ORIGIN', 'http://localhost:3000'),

  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3306),
    database: required('DB_NAME', 'shopping_store'),
    user: required('DB_USER', 'shop_app'),
    password: required('DB_PASSWORD', 'change_me_app_password'),
    connectionLimit: int('DB_CONNECTION_LIMIT', 10),
  },

  session: {
    name: required('SESSION_NAME', 'shop.sid'),
    secret: required('SESSION_SECRET', 'insecure-development-session-secret'),
    maxAgeMs: int('SESSION_MAX_AGE_MS', 24 * 60 * 60 * 1000),
  },

  security: {
    enableCsrf: bool('ENABLE_CSRF', true),
    enableRateLimit: bool('ENABLE_RATE_LIMIT', true),
    trustProxy: bool('TRUST_PROXY', false),
    // Set COOKIE_SECURE=true whenever the application is reached over HTTPS
    // (behind the TLS terminator described in the deployment guide).
    cookieSecure: bool('COOKIE_SECURE', false),
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
