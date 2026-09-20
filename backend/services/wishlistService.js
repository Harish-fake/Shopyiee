'use strict';

/** Saved-for-later list. */

const { query, queryOne } = require('../config/db');
const pricing = require('./pricingService');
const { notFound, conflict } = require('../utils/errors');

async function list(userId) {
  const rows = await query(
    `SELECT w.id, w.created_at, w.product_id,
            p.name, p.slug, p.image, p.brand, p.price, p.original_price, p.stock, p.rating, p.review_count
     FROM wishlist w
     JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ? AND p.is_active = 1
     ORDER BY w.created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    name: row.name,
    slug: row.slug,
    image: row.image,
    brand: row.brand,
    price: Number.parseFloat(row.price),
    originalPrice: row.original_price === null ? null : Number.parseFloat(row.original_price),
    stock: row.stock,
    inStock: row.stock > 0,
    rating: Number.parseFloat(row.rating),
    reviewCount: row.review_count,
    addedAt: row.created_at,
  }));
}

async function add(userId, productId) {
  const product = await queryOne('SELECT id, is_active FROM products WHERE id = ? LIMIT 1', [productId]);
  if (!product || !product.is_active) throw notFound('Product not found');

  const existing = await queryOne('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ? LIMIT 1', [
    userId,
    productId,
  ]);
  if (existing) throw conflict('That product is already on your wishlist');

  await query('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)', [userId, productId]);
  return list(userId);
}

async function remove(userId, productId) {
  const result = await query('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [userId, productId]);
  if (result.affectedRows === 0) throw notFound('That product is not on your wishlist');
  return list(userId);
}

/** Move a saved product into the cart and take it off the wishlist. */
async function moveToCart(userId, productId, quantity = 1) {
  const cartService = require('./cartService');

  const product = await queryOne('SELECT id, stock, is_active FROM products WHERE id = ? LIMIT 1', [productId]);
  if (!product || !product.is_active) throw notFound('Product not found');

  await cartService.addItem(userId, productId, quantity);
  await query('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [userId, productId]);

  return { cart: await cartService.getCart(userId), wishlist: await list(userId) };
}

async function count(userId) {
  const row = await queryOne('SELECT COUNT(*) AS total FROM wishlist WHERE user_id = ?', [userId]);
  return row?.total ?? 0;
}

/** Product ids currently saved, used to render the heart icon state. */
async function savedProductIds(userId) {
  const rows = await query('SELECT product_id FROM wishlist WHERE user_id = ?', [userId]);
  return rows.map((row) => row.product_id);
}

module.exports = { list, add, remove, moveToCart, count, savedProductIds, pricing };
