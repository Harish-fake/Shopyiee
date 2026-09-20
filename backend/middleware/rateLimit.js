'use strict';

/**
 * Request throttling.
 *
 * Limits are deliberately generous so that ordinary browsing is never
 * interrupted, while authentication endpoints get a tighter budget to slow
 * down credential-stuffing style traffic.  Limiting is disabled when
 * ENABLE_RATE_LIMIT is false, which keeps bulk testing practical.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

function buildLimiter({ windowMs, max, message, skipSuccessfulRequests = false }) {
  if (!config.security.enableRateLimit) {
    return (req, _res, next) => next();
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { success: false, error: { message, code: 'RATE_LIMITED' } },
  });
}

/** Broad limiter applied to every API route. */
const apiLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/** Tight limiter for sign-in attempts. */
const loginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skipSuccessfulRequests: true,
  message: 'Too many sign-in attempts. Please wait a few minutes before trying again.',
});

/** Limiter for account creation. */
const registerLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many accounts created from this address. Please try again later.',
});

/** Limiter for write-heavy endpoints (reviews, checkout). */
const writeLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 300,
  message: 'Too many requests. Please slow down and try again shortly.',
});

module.exports = { apiLimiter, loginLimiter, registerLimiter, writeLimiter };
