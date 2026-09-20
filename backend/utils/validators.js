'use strict';

/**
 * Input validation helpers.
 *
 * These are used by the hardened code paths.  Every helper returns a normalised
 * value or throws, so controllers can rely on the result being well-formed.
 */

const { badRequest } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Allows letters, digits and the punctuation typically found in postal addresses.
const SAFE_TEXT_RE = /^[\p{L}\p{N}\s.,'’\-/#()&+:]*$/u;

function asString(value, field, { min = 0, max = 255, trim = true } = {}) {
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  const result = trim ? value.trim() : value;
  if (result.length < min) throw badRequest(`${field} must be at least ${min} character(s)`);
  if (result.length > max) throw badRequest(`${field} must be at most ${max} character(s)`);
  return result;
}

function asEmail(value, field = 'email') {
  const email = asString(value, field, { min: 5, max: 190 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw badRequest(`${field} is not a valid email address`);
  return email;
}

function asPassword(value, field = 'password') {
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  if (value.length < 8) throw badRequest(`${field} must be at least 8 characters`);
  if (value.length > 128) throw badRequest(`${field} must be at most 128 characters`);
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    throw badRequest(`${field} must contain at least one letter and one number`);
  }
  return value;
}

/**
 * Coerce a value to an integer.
 *
 * Strings must consist of digits only.  `Number.parseInt` is deliberately not
 * used on its own because it is happy to read a numeric prefix out of a longer
 * string - `parseInt('1 OR 1=1')` is `1` - which would silently accept input
 * that is obviously not an identifier.
 */
function asInt(value, field, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  let parsed;

  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    parsed = Number.parseInt(value.trim(), 10);
  } else {
    throw badRequest(`${field} must be a whole number`);
  }

  if (!Number.isSafeInteger(parsed)) throw badRequest(`${field} must be a whole number`);
  if (parsed < min || parsed > max) throw badRequest(`${field} must be between ${min} and ${max}`);
  return parsed;
}

function asMoney(value, field) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) throw badRequest(`${field} must be a number`);
  if (parsed < 0) throw badRequest(`${field} must not be negative`);
  if (parsed > 10_000_000) throw badRequest(`${field} is out of range`);
  // Round to 2 decimal places to avoid float noise reaching the database.
  return Math.round(parsed * 100) / 100;
}

function asEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function asSafeText(value, field, options = {}) {
  const text = asString(value, field, options);
  if (!SAFE_TEXT_RE.test(text)) {
    throw badRequest(`${field} contains characters that are not allowed`);
  }
  return text;
}

/** Strip anything that could be interpreted as markup. */
function stripTags(value) {
  return String(value).replace(/<[^>]*>/g, '');
}

module.exports = {
  asString,
  asEmail,
  asPassword,
  asInt,
  asMoney,
  asEnum,
  asSafeText,
  stripTags,
};
