'use strict';

const express = require('express');
const cartController = require('../controllers/cartController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { csrfProtection } = require('../middleware/csrf');
const { asInt } = require('../utils/validators');

const router = express.Router();

// Every cart route is scoped to the signed-in account.
router.use(requireAuth);

router.get('/', cartController.getCart);

router.post(
  '/',
  csrfProtection(),
  validate({
    body: {
      productId: (value) => asInt(value, 'productId', { min: 1 }),
      quantity: (value) => (value === undefined ? 1 : asInt(value, 'quantity', { min: 1, max: 99 })),
    },
  }),
  cartController.addItem
);

router.put(
  '/:id',
  csrfProtection(),
  validate({ body: { quantity: (value) => asInt(value, 'quantity', { min: 1, max: 99 }) } }),
  cartController.updateItem
);

router.delete('/:id', csrfProtection(), cartController.removeItem);

router.delete('/', csrfProtection(), cartController.clear);

module.exports = router;
