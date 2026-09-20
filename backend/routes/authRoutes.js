'use strict';

const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const { csrfProtection } = require('../middleware/csrf');
const { asEmail, asPassword, asSafeText, asString } = require('../utils/validators');

const router = express.Router();

router.post(
  '/register',
  registerLimiter,
  validate({
    body: {
      name: (value) => asString(value, 'name', { min: 2, max: 120 }),
      email: (value) => asEmail(value),
      password: (value) => asPassword(value),
      phone: (value) => (value ? asString(value, 'phone', { min: 6, max: 30 }) : null),
    },
  }),
  authController.register
);

router.post(
  '/login',
  loginLimiter,
  validate({
    body: {
      email: (value) => asEmail(value),
      password: (value) => asString(value, 'password', { min: 1, max: 128 }),
    },
  }),
  authController.login
);

router.post('/logout', authController.logout);

router.get('/me', authController.me);

router.get('/csrf', authController.csrf);

router.get('/session-check', authController.sessionInfo);

router.put(
  '/profile',
  requireAuth,
  csrfProtection(),
  validate({
    body: {
      // Address-shaped fields go through an allow-list: a name, a phone number
      // or a street address has no business containing markup.
      name: (value) => (value === undefined ? undefined : asSafeText(value, 'name', { min: 2, max: 120 })),
      phone: (value) =>
        value === undefined || value === null ? undefined : asSafeText(value, 'phone', { min: 6, max: 30 }),
      address: (value) => (value === undefined ? undefined : asSafeText(value, 'address', { min: 4, max: 255 })),
      city: (value) => (value === undefined ? undefined : asSafeText(value, 'city', { min: 2, max: 80 })),
      state: (value) => (value === undefined ? undefined : asSafeText(value, 'state', { min: 2, max: 80 })),
      postalCode: (value) =>
        value === undefined ? undefined : asSafeText(value, 'postalCode', { min: 3, max: 20 }),
    },
  }),
  authController.updateProfile
);

router.put(
  '/password',
  requireAuth,
  csrfProtection(),
  validate({
    body: {
      currentPassword: (value) => asString(value, 'currentPassword', { min: 1, max: 128 }),
      newPassword: (value) => asPassword(value, 'newPassword'),
    },
  }),
  authController.changePassword
);

module.exports = router;
