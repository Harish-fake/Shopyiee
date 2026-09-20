'use strict';

/**
 * Administration routes.
 *
 * Two authorization gates are in play:
 *
 *   requireAdminSecure      - resolves the role from the server-side session
 *                             and the `users` table.  Used by every route here.
 *
 *   requireAdminVulnerable  - additionally accepts a client-controlled
 *                             `lab_role` cookie.  Used only by
 *                             `GET /api/admin/users`, and only when APP_MODE is
 *                             `development` or `testing`.
 *
 * The hardened counterpart of that endpoint is `GET /api/admin/users-secure`.
 * See docs/security-testing.md.
 */

const express = require('express');
const config = require('../config/env');
const adminController = require('../controllers/adminController');
const { requireAdminSecure } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { csrfProtection } = require('../middleware/csrf');
const { asInt, asEnum } = require('../utils/validators');

const router = express.Router();

/** Mode-dependent gate for the user-administration endpoint. */
const usersGate = config.isSecureMode
  ? requireAdminSecure
  : require('../vulnerabilities/vulnerableAuthorization').requireAdminVulnerable();

router.get('/stats', requireAdminSecure, adminController.stats);

// Mode-dependent authorization (see the note at the top of this file).
router.get(
  '/users',
  usersGate,
  validate({
    query: {
      limit: (value) => (value === undefined ? 100 : asInt(value, 'limit', { min: 1, max: 500 })),
      offset: (value) => (value === undefined ? 0 : asInt(value, 'offset', { min: 0 })),
      search: (value) => (value === undefined || value === '' ? null : String(value).slice(0, 100)),
    },
  }),
  adminController.listUsers
);

/** Always hardened. */
router.get('/users-secure', requireAdminSecure, adminController.listUsersSecure);

router.get(
  '/orders',
  requireAdminSecure,
  validate({
    query: {
      page: (value) => (value === undefined ? 1 : asInt(value, 'page', { min: 1, max: 10000 })),
      limit: (value) => (value === undefined ? 25 : asInt(value, 'limit', { min: 1, max: 100 })),
      status: (value) =>
        value === undefined || value === ''
          ? null
          : asEnum(value, ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'], 'status'),
      search: (value) => (value === undefined || value === '' ? null : String(value).slice(0, 100)),
    },
  }),
  adminController.listOrders
);

router.put(
  '/orders/:id/status',
  requireAdminSecure,
  csrfProtection(),
  validate({ body: { status: (value) => asEnum(value, ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'], 'status') } }),
  adminController.updateOrderStatus
);

router.post('/orders/:id/cancel', requireAdminSecure, csrfProtection(), adminController.cancelOrder);

router.get(
  '/products',
  requireAdminSecure,
  validate({
    query: {
      page: (value) => (value === undefined ? 1 : asInt(value, 'page', { min: 1, max: 10000 })),
      limit: (value) => (value === undefined ? 25 : asInt(value, 'limit', { min: 1, max: 100 })),
    },
  }),
  adminController.listProducts
);

router.post('/products', requireAdminSecure, csrfProtection(), adminController.createProduct);

router.put('/products/:id', requireAdminSecure, csrfProtection(), adminController.updateProduct);

router.delete('/products/:id', requireAdminSecure, csrfProtection(), adminController.deleteProduct);

router.get('/inventory', requireAdminSecure, adminController.inventory);

router.get(
  '/reviews',
  requireAdminSecure,
  validate({
    query: {
      limit: (value) => (value === undefined ? 50 : asInt(value, 'limit', { min: 1, max: 200 })),
      offset: (value) => (value === undefined ? 0 : asInt(value, 'offset', { min: 0 })),
    },
  }),
  adminController.listReviews
);

router.delete('/reviews/:id', requireAdminSecure, csrfProtection(), adminController.deleteReview);

router.get(
  '/transactions',
  requireAdminSecure,
  validate({
    query: {
      limit: (value) => (value === undefined ? 100 : asInt(value, 'limit', { min: 1, max: 500 })),
      offset: (value) => (value === undefined ? 0 : asInt(value, 'offset', { min: 0 })),
    },
  }),
  adminController.listTransactions
);

module.exports = router;
