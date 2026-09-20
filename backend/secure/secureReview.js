'use strict';

/**
 * Hardened review handling.
 *
 * Defence in depth:
 *
 *   1. On write, the review body is sanitised - dangerous elements and event
 *      handler attributes are removed and a small allow-list of formatting tags
 *      is retained.
 *   2. On read, the stored value is HTML-encoded before it is handed to the
 *      client, so even a row that was inserted by another path (or directly
 *      into MySQL) cannot introduce markup into the page.
 *
 * Length limits and rating bounds are enforced server-side.
 */

const { query, queryOne } = require('../config/db');
const { recalculateProductRating } = require('../services/ratingService');
const { notFound, forbidden, badRequest } = require('../utils/errors');
const { sanitizeRichText, escapeHtml } = require('../utils/encoding');
const { asInt, asString } = require('../utils/validators');

const MAX_TITLE = 160;
const MAX_COMMENT = 4000;

function cleanTitle(value) {
  if (value === undefined || value === null || value === '') return null;
  return sanitizeRichText(asString(String(value), 'title', { min: 1, max: MAX_TITLE }));
}

function cleanComment(value) {
  if (value === undefined || value === null || value === '') return null;
  return sanitizeRichText(asString(String(value), 'comment', { min: 1, max: MAX_COMMENT }));
}

function cleanRating(value) {
  return asInt(value, 'rating', { min: 1, max: 5 });
}

async function createReview({ productId, userId, rating, title, comment }) {
  const safeProductId = asInt(productId, 'productId', { min: 1 });
  const safeRating = cleanRating(rating);

  const product = await queryOne('SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1', [safeProductId]);
  if (!product) throw notFound('Product not found');

  const existing = await queryOne('SELECT id FROM reviews WHERE user_id = ? AND product_id = ? LIMIT 1', [
    userId,
    safeProductId,
  ]);
  if (existing) throw badRequest('You have already reviewed this product');

  const result = await query(
    'INSERT INTO reviews (product_id, user_id, rating, title, comment) VALUES (?, ?, ?, ?, ?)',
    [safeProductId, userId, safeRating, cleanTitle(title), cleanComment(comment)]
  );

  await recalculateProductRating(safeProductId);
  return findReviewById(result.insertId);
}

async function updateReview({ reviewId, userId, rating, title, comment }) {
  const safeReviewId = asInt(reviewId, 'reviewId', { min: 1 });
  const safeRating = cleanRating(rating);

  const existing = await queryOne('SELECT id, user_id, product_id FROM reviews WHERE id = ? LIMIT 1', [safeReviewId]);
  if (!existing) throw notFound('Review not found');
  if (existing.user_id !== userId) throw forbidden('You can only edit your own review');

  await query('UPDATE reviews SET rating = ?, title = ?, comment = ? WHERE id = ?', [
    safeRating,
    cleanTitle(title),
    cleanComment(comment),
    safeReviewId,
  ]);

  await recalculateProductRating(existing.product_id);
  return findReviewById(safeReviewId);
}

async function deleteReview({ reviewId, userId, isAdmin = false }) {
  const safeReviewId = asInt(reviewId, 'reviewId', { min: 1 });

  const existing = await queryOne('SELECT id, user_id, product_id FROM reviews WHERE id = ? LIMIT 1', [safeReviewId]);
  if (!existing) throw notFound('Review not found');
  if (!isAdmin && existing.user_id !== userId) throw forbidden('You can only delete your own review');

  await query('DELETE FROM reviews WHERE id = ?', [safeReviewId]);
  await recalculateProductRating(existing.product_id);
  return { id: safeReviewId };
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

async function listReviewsForProduct(productId, viewerId = null) {
  const safeProductId = asInt(productId, 'productId', { min: 1 });

  const rows = await query(
    `SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.comment, r.created_at, r.updated_at,
            u.name AS author_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ?
     ORDER BY r.created_at DESC`,
    [safeProductId]
  );

  return rows.map((row) => shapeReview(row, viewerId));
}

async function listAllReviews({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(asInt(limit, 'limit', { min: 1, max: 200 }), 1), 200);
  const safeOffset = Math.max(asInt(offset, 'offset', { min: 0 }), 0);

  const rows = await query(
    `SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.comment, r.created_at, r.updated_at,
            u.name AS author_name, p.name AS product_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset]
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

/**
 * HARDENED: the value handed to the client is HTML-encoded, so it can only ever
 * be displayed as text no matter what is stored in the column.
 */
function shapeReview(row, viewerId = null) {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    authorName: row.author_name,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    commentHtml: escapeHtml(row.comment ?? ''),
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
};
