'use strict';

/**
 * ===========================================================================
 *  INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING
 *  DO NOT USE THIS IMPLEMENTATION IN PRODUCTION
 * ===========================================================================
 *
 * Product review handling.
 *
 * Two deliberate weaknesses are present here:
 *
 *   1. Stored content is written to the database exactly as supplied, with no
 *      sanitisation or length enforcement beyond the column definition.
 *   2. When reviews are read back, the raw `comment` value is copied into a
 *      `commentHtml` field which the product page renders as markup.  Anything
 *      a reviewer submitted therefore executes in the browser of every visitor
 *      who opens that product.
 *
 * The parameterised and encoded counterpart lives in `../secure/secureReview.js`.
 * Loaded only when APP_MODE is `development` or `testing`.
 */

const { pool, query, queryOne } = require('../config/db');
const { recalculateProductRating } = require('../services/ratingService');
const { notFound, forbidden, badRequest } = require('../utils/errors');

/**
 * Persist a review.
 *
 * INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING:
 * `title` and `comment` are stored verbatim.  No encoding, no tag stripping,
 * no length limit beyond what MySQL enforces on the column.
 */
async function createReview({ productId, userId, rating, title, comment }) {
  const product = await queryOne('SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1', [productId]);
  if (!product) throw notFound('Product not found');

  const existing = await queryOne('SELECT id FROM reviews WHERE user_id = ? AND product_id = ? LIMIT 1', [
    userId,
    productId,
  ]);
  if (existing) throw badRequest('You have already reviewed this product');

  const result = await query(
    'INSERT INTO reviews (product_id, user_id, rating, title, comment) VALUES (?, ?, ?, ?, ?)',
    [productId, userId, rating, title ?? null, comment ?? null]
  );

  await recalculateProductRating(productId);
  return findReviewById(result.insertId);
}

/** Update an existing review. Ownership is verified, but content is not cleaned. */
async function updateReview({ reviewId, userId, rating, title, comment }) {
  const existing = await queryOne('SELECT id, user_id, product_id FROM reviews WHERE id = ? LIMIT 1', [reviewId]);
  if (!existing) throw notFound('Review not found');
  if (existing.user_id !== userId) throw forbidden('You can only edit your own review');

  await query(
    'UPDATE reviews SET rating = ?, title = ?, comment = ? WHERE id = ?',
    [rating, title ?? null, comment ?? null, reviewId]
  );

  await recalculateProductRating(existing.product_id);
  return findReviewById(reviewId);
}

async function deleteReview({ reviewId, userId, isAdmin = false }) {
  const existing = await queryOne('SELECT id, user_id, product_id FROM reviews WHERE id = ? LIMIT 1', [reviewId]);
  if (!existing) throw notFound('Review not found');
  if (!isAdmin && existing.user_id !== userId) throw forbidden('You can only delete your own review');

  await query('DELETE FROM reviews WHERE id = ?', [reviewId]);
  await recalculateProductRating(existing.product_id);
  return { id: reviewId };
}

async function findReviewById(reviewId) {
  const row = await queryOne(
    `SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.comment, r.created_at, r.updated_at,
            u.name AS author_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = ?
     LIMIT 1`,
    [reviewId]
  );
  return row ? shapeReview(row) : null;
}

/**
 * List the reviews for a product.
 *
 * INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING:
 * `commentHtml` is the raw database value.  The product page inserts this field
 * into the DOM as markup, so stored script content is executed on render.
 */
async function listReviewsForProduct(productId, viewerId = null) {
  const rows = await query(
    `SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.comment, r.created_at, r.updated_at,
            u.name AS author_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ?
     ORDER BY r.created_at DESC`,
    [productId]
  );

  return rows.map((row) => shapeReview(row, viewerId));
}

async function listAllReviews({ limit = 50, offset = 0 } = {}) {
  const rows = await query(
    `SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.comment, r.created_at, r.updated_at,
            u.name AS author_name, p.name AS product_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows.map((row) => ({ ...shapeReview(row), productName: row.product_name }));
}

async function listReviewsByUser(userId) {
  const rows = await query(
    `SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.comment, r.created_at, r.updated_at,
            u.name AS author_name, p.name AS product_name, p.image AS product_image
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    ...shapeReview(row, userId),
    productName: row.product_name,
    productImage: row.product_image,
  }));
}

/** INTENTIONALLY VULNERABLE: `commentHtml` mirrors the stored value verbatim. */
function shapeReview(row, viewerId = null) {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    authorName: row.author_name,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    commentHtml: row.comment ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwn: viewerId !== null && row.user_id === viewerId,
  };
}

module.exports = {
  createReview,
  updateReview,
  deleteReview,
  findReviewById,
  listReviewsForProduct,
  listAllReviews,
  listReviewsByUser,
  pool,
};
