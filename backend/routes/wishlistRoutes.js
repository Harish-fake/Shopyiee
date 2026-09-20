'use strict';

const express = require('express');
const wishlistController = require('../controllers/wishlistController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { csrfProtection } = require('../middleware/csrf');
const { asInt } = require('../utils/validators');

const router = express.Router();

router.use(requireAuth);

router.get('/', wishlistController.list);

router.post(
  '/',
  csrfProtection(),
  validate({ body: { productId: (value) => asInt(value, 'productId', { min: 1 }) } }),
  wishlistController.add
);

router.delete('/:productId', csrfProtection(), wishlistController.remove);

router.post(
  '/:productId/move-to-cart',
  csrfProtection(),
  validate({
    body: {
      quantity: (value) => (value === undefined ? 1 : asInt(value, 'quantity', { min: 1, max: 99 })),
    },
  }),
  wishlistController.moveToCart
);

module.exports = router;
