'use strict';

const express = require('express');
const orderController = require('../controllers/orderController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { csrfProtection } = require('../middleware/csrf');
const { asInt } = require('../utils/validators');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  validate({
    query: {
      page: (value) => (value === undefined ? 1 : asInt(value, 'page', { min: 1, max: 10000 })),
      limit: (value) => (value === undefined ? 20 : asInt(value, 'limit', { min: 1, max: 100 })),
      status: (value) =>
        ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(value) ? value : null,
    },
  }),
  orderController.list
);

/**
 * Hardened read of a single order.  Declared before `/:id` so the literal
 * path segment is matched first.
 */
router.get('/:id/secure', orderController.detailSecure);

router.get('/:id', orderController.detail);

router.post('/:id/cancel', csrfProtection(), orderController.cancel);

module.exports = router;
