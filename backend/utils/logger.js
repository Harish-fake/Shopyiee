'use strict';

/**
 * Minimal structured logger.
 *
 * Security-relevant events are recorded here (logins, failed logins, checkout
 * attempts, admin access, authorization failures, database errors) while
 * sensitive values are stripped before anything is written.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const config = require('../config/env');

const activeLevel = LEVELS[config.logging.level] ?? LEVELS.info;

/** Keys whose values must never reach a log sink. */
const REDACTED_KEYS = [
  'password',
  'password_hash',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'secret',
  'sessionSecret',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
  'creditcard',
  'cardNumber',
  'cvv',
];

function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value !== 'object') return value;

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = REDACTED_KEYS.includes(key.toLowerCase()) ? '[redacted]' : redact(item, depth + 1);
  }
  return output;
}

function emit(level, message, meta) {
  if (LEVELS[level] > activeLevel) return;

  const entry = {
    time: new Date().toISOString(),
    level,
    message,
  };
  if (meta !== undefined) entry.meta = redact(meta);

  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

module.exports = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
  redact,
};
