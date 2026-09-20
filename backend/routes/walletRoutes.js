'use strict';

const express = require('express');
const walletController = require('../controllers/walletController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { csrfProtection } = require('../middleware/csrf');
const { writeLimiter } = require('../middleware/rateLimit');
const { asMoney, asInt, asEnum } = require('../utils/validators');

const router = express.Router();

router.use(requireAuth);

router.get('/', walletController.getWallet);

router.get(
  '/transactions',
  validate({
    query: {
      limit: (value) => (value === undefined ? 50 : asInt(value, 'limit', { min: 1, max: 200 })),
      offset: (value) => (value === undefined ? 0 : asInt(value, 'offset', { min: 0 })),
      type: (value) =>
        value === undefined || value === ''
          ? null
          : asEnum(value, ['DEPOSIT', 'PURCHASE', 'REFUND', 'ADJUSTMENT'], 'type'),
    },
  }),
  walletController.transactions
);

router.get('/purchases', walletController.purchases);

/** Simulated top-up. No external payment service is involved. */
router.post(
  '/deposit',
  writeLimiter,
  csrfProtection(),
  validate({ body: { amount: (value) => asMoney(value, 'amount') } }),
  walletController.deposit
);

module.exports = router;
