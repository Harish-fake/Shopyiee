'use strict';

/**
 * Product reviews.
 *
 * The rendering behaviour (how a stored review body is prepared for display) is
 * decided by `services/reviewRenderer`, which selects the implementation that
 * matches APP_MODE.  Controllers stay identical in every mode.
 */

const reviewService = require('../services/reviewRenderer');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

/** GET /api/reviews/product/:productId */
const listForProduct = asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId < 1) throw badRequest('Invalid product id');

  const items = await reviewService.listReviewsForProduct(productId, req.user?.id ?? null);

  const average = items.length
    ? Math.round((items.reduce((sum, item) => sum + item.rating, 0) / items.length) * 10) / 10
    : 0;

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: items.filter((item) => item.rating === stars).length,
  }));

  res.json({ success: true, data: { items, total: items.length, average, distribution } });
});

/** GET /api/reviews/mine */
const mine = asyncHandler(async (req, res) => {
  const items = await reviewService.listReviewsByUser(req.user.id);
  res.json({ success: true, data: { items, total: items.length } });
});

/** POST /api/reviews */
const create = asyncHandler(async (req, res) => {
  const { productId, rating, title, comment } = req.body;

  const review = await reviewService.createReview({
    productId,
    userId: req.user.id,
    rating,
    title,
    comment,
  });

  res.status(201).json({ success: true, data: { review } });
});

/** PUT /api/reviews/:id */
const update = asyncHandler(async (req, res) => {
  const { rating, title, comment } = req.body;

  const review = await reviewService.updateReview({
    reviewId: Number(req.params.id),
    userId: req.user.id,
    rating,
    title,
    comment,
  });

  res.json({ success: true, data: { review } });
});

/** DELETE /api/reviews/:id */
const remove = asyncHandler(async (req, res) => {
  const result = await reviewService.deleteReview({
    reviewId: Number(req.params.id),
    userId: req.user.id,
    isAdmin: req.user.role === 'ADMIN',
  });

  res.json({ success: true, data: result });
});

module.exports = { listForProduct, mine, create, update, remove };
