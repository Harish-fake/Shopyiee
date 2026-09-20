'use strict';

const express = require('express');
const reviewController = require('../controllers/reviewController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { csrfProtection } = require('../middleware/csrf');
const { writeLimiter } = require('../middleware/rateLimit');
const { asInt, asString } = require('../utils/validators');

const router = express.Router();

/** Public: reviews for a product are visible to everyone. */
router.get('/product/:productId', reviewController.listForProduct);

router.get('/mine', requireAuth, reviewController.mine);

router.post(
  '/',
  requireAuth,
  writeLimiter,
  csrfProtection(),
  validate({
    body: {
      productId: (value) => asInt(value, 'productId', { min: 1 }),
      rating: (value) => asInt(value, 'rating', { min: 1, max: 5 }),
      title: (value) =>
        value === undefined || value === null || value === ''
          ? null
          : asString(value, 'title', { min: 1, max: 160 }),
      comment: (value) =>
        value === undefined || value === null || value === ''
          ? null
          : asString(value, 'comment', { min: 1, max: 4000, trim: false }),
    },
  }),
  reviewController.create
);

router.put(
  '/:id',
  requireAuth,
  csrfProtection(),
  validate({
    body: {
      rating: (value) => asInt(value, 'rating', { min: 1, max: 5 }),
      title: (value) =>
        value === undefined || value === null || value === ''
          ? null
          : asString(value, 'title', { min: 1, max: 160 }),
      comment: (value) =>
        value === undefined || value === null || value === ''
          ? null
          : asString(value, 'comment', { min: 1, max: 4000, trim: false }),
    },
  }),
  reviewController.update
);

router.delete('/:id', requireAuth, csrfProtection(), reviewController.remove);

module.exports = router;
