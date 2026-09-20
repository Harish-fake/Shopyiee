'use strict';

/**
 * Database-backed shopping cart.
 *
 * The cart lives in MySQL rather than in the browser, so the server always
 * knows what is being purchased.  Totals returned to the client are computed
 * here for display; checkout recalculates them independently.
 */

const { query, queryOne } = require('../config/db');
const pricing = require('./pricingService');
const { notFound, badRequest, unprocessable } = require('../utils/errors');

const MAX_QUANTITY_PER_LINE = 99;

function mapLine(row) {
  const unitPrice = Number.parseFloat(row.price);
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    slug: row.slug,
    image: row.image,
    brand: row.brand,
    unitPrice,
    quantity: row.quantity,
    lineTotal: pricing.lineTotal(unitPrice, row.quantity),
    stock: row.stock,
    inStock: row.stock > 0,
  };
}

async function getCart(userId) {
  const rows = await query(
    `SELECT ci.id, ci.product_id, ci.quantity,
            p.name, p.slug, p.image, p.brand, p.price, p.stock
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = ? AND p.is_active = 1
     ORDER BY ci.created_at ASC`,
    [userId]
  );

  const items = rows.map(mapLine);
  const totals = pricing.summarise(items);

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    distinctCount: items.length,
    ...totals,
    freeShippingThreshold: pricing.FREE_SHIPPING_THRESHOLD,
  };
}

async function addItem(userId, productId, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) throw badRequest('Quantity must be a positive whole number');
  if (quantity > MAX_QUANTITY_PER_LINE) throw badRequest(`You can order at most ${MAX_QUANTITY_PER_LINE} of one item`);

  const product = await queryOne('SELECT id, name, stock, is_active FROM products WHERE id = ? LIMIT 1', [productId]);
  if (!product) throw notFound('Product not found');
  if (!product.is_active) throw unprocessable('This product is no longer available');

  const existing = await queryOne(
    'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? LIMIT 1',
    [userId, productId]
  );

  const desired = (existing?.quantity ?? 0) + quantity;
  if (desired > MAX_QUANTITY_PER_LINE) {
    throw badRequest(`You can order at most ${MAX_QUANTITY_PER_LINE} of one item`);
  }

  // Stock is authoritative in the catalogue, not in the request.  The hardened
  // checkout re-checks it inside the transaction, but refusing an impossible
  // basket here keeps the cart honest.
  if (product.stock < desired) {
    throw badRequest(
      product.stock === 0
        ? `"${product.name}" is out of stock`
        : `Only ${product.stock} unit(s) of "${product.name}" are available`
    );
  }

  if (existing) {
    await query('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?', [desired, existing.id, userId]);
  } else {
    await query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [
      userId,
      productId,
      quantity,
    ]);
  }

  return getCart(userId);
}

async function updateItem(userId, cartItemId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) throw badRequest('Quantity must be a positive whole number');
  if (quantity > MAX_QUANTITY_PER_LINE) throw badRequest(`You can order at most ${MAX_QUANTITY_PER_LINE} of one item`);

  // Scoping the lookup to the signed-in account means another user's cart row
  // cannot be read or modified even if its id is guessed.
  const line = await queryOne(
    `SELECT ci.id, p.name, p.stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.id = ? AND ci.user_id = ?
      LIMIT 1`,
    [cartItemId, userId]
  );

  if (!line) throw notFound('That item is not in your cart');

  if (line.stock < quantity) {
    throw badRequest(
      line.stock === 0
        ? `"${line.name}" is out of stock`
        : `Only ${line.stock} unit(s) of "${line.name}" are available`
    );
  }

  await query('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?', [
    quantity,
    cartItemId,
    userId,
  ]);

  return getCart(userId);
}

async function removeItem(userId, cartItemId) {
  const result = await query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [cartItemId, userId]);
  if (result.affectedRows === 0) throw notFound('That item is not in your cart');
  return getCart(userId);
}

async function clear(userId) {
  await query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
  return getCart(userId);
}

async function countItems(userId) {
  const row = await queryOne('SELECT COALESCE(SUM(quantity), 0) AS total FROM cart_items WHERE user_id = ?', [userId]);
  return Number(row?.total ?? 0);
}

module.exports = { getCart, addItem, updateItem, removeItem, clear, countItems, MAX_QUANTITY_PER_LINE };
