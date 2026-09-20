'use strict';

/**
 * ===========================================================================
 *  INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING
 *  DO NOT USE THIS IMPLEMENTATION IN PRODUCTION
 * ===========================================================================
 *
 * Checkout.
 *
 * The request body carries `items[].price` and a `total`.  A well-behaved
 * client sends the prices it displayed, but the server must never rely on them.
 * This implementation does: the amounts used to build the order and to debit
 * the wallet come straight from the request.
 *
 * Consequences for testing:
 *   - `items[].price` overrides the catalogue price per line.
 *   - `total`, when present, overrides the computed order total entirely.
 *   - Stock is decremented but never checked before the purchase.
 *
 * `../secure/secureCheckout.js` is the counterpart that prices every line from
 * MySQL inside a transaction.  Loaded only when APP_MODE is `development` or
 * `testing`.  See docs/security-testing.md.
 */

const { pool, query, queryOne, withTransaction } = require('../config/db');
const { orderNumber, transactionReference } = require('../utils/reference');
const { badRequest, unprocessable } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Place an order.
 *
 * @param {object} request
 * @param {number} request.userId
 * @param {Array}  request.items      [{ productId, quantity, price }]
 * @param {number} [request.total]    Client-supplied order total.
 * @param {number} [request.shippingFee]
 * @param {object} [request.shipping] Address block.
 */
async function checkout({ userId, items = [], total, shippingFee = 0, shipping = {}, notes = null }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Your cart is empty');
  }

  // ---- INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING -------------
  // Line prices are taken from the request body.  Compare with
  // secureCheckout, which reads every price from the products table.
  const lines = items.map((item) => {
    const quantity = Number.parseInt(item.quantity, 10) || 1;
    const unitPrice = Number.parseFloat(item.price); // <- trusted client value
    const lineTotal = Number.isFinite(unitPrice) ? unitPrice * quantity : 0;

    return {
      productId: item.productId,
      quantity,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      lineTotal,
    };
  });

  const computedSubtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  // The client may also dictate the final total.  A value lower than the
  // subtotal is accepted without question.
  const appliedTotal = total !== undefined && total !== null && total !== ''
    ? Number.parseFloat(total)
    : computedSubtotal + Number.parseFloat(shippingFee || 0);

  if (!Number.isFinite(appliedTotal)) throw badRequest('Invalid order total');
  // --------------------------------------------------------------------------

  const orderId = await withTransaction(async (connection) => {
    const [userRows] = await connection.execute('SELECT id, wallet_balance FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!userRows.length) throw unprocessable('Account not found');

    const balance = Number.parseFloat(userRows[0].wallet_balance);
    if (balance < appliedTotal) {
      throw unprocessable('Insufficient wallet balance for this order');
    }

    const number = orderNumber();

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
         (user_id, order_number, subtotal, shipping_fee, discount, total, status, payment_status,
          shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_postal_code, notes)
       VALUES (?, ?, ?, ?, 0, ?, 'PROCESSING', 'PAID', ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        number,
        computedSubtotal,
        Number.parseFloat(shippingFee || 0),
        appliedTotal,
        shipping.name ?? null,
        shipping.phone ?? null,
        shipping.address ?? null,
        shipping.city ?? null,
        shipping.state ?? null,
        shipping.postalCode ?? null,
        notes,
      ]
    );

    const orderIdValue = orderResult.insertId;

    for (const line of lines) {
      // Snapshot whatever the client told us the product was.
      const [productRows] = await connection.execute(
        'SELECT name, image, stock FROM products WHERE id = ? LIMIT 1',
        [line.productId]
      );
      const product = productRows[0] || {};

      await connection.execute(
        `INSERT INTO order_items
           (order_id, product_id, product_name, product_image, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderIdValue,
          line.productId ?? null,
          product.name ?? `Item #${line.productId}`,
          product.image ?? null,
          line.unitPrice,
          line.quantity,
          line.lineTotal,
        ]
      );

      // Stock is decremented without first checking that it is available.
      await connection.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [line.quantity, line.productId]);
    }

    const newBalance = Math.round((balance - appliedTotal) * 100) / 100;

    await connection.execute(
      `INSERT INTO transactions (user_id, order_id, type, amount, balance_after, description, reference)
       VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?)`,
      [
        userId,
        orderIdValue,
        appliedTotal,
        newBalance,
        `Payment for order ${number}`,
        transactionReference('TXN'),
      ]
    );

    await connection.execute('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, userId]);

    // The cart is emptied by the caller; this path only handles the order.
    return orderIdValue;
  });

  logger.info('Checkout completed', { userId, orderId, total: appliedTotal, mode: 'development' });

  return loadOrder(orderId);
}

async function loadOrder(orderId) {
  const order = await queryOne(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ? LIMIT 1`,
    [orderId]
  );
  if (!order) return null;

  const items = await query(
    'SELECT id, product_id, product_name, product_image, unit_price, quantity, line_total FROM order_items WHERE order_id = ?',
    [orderId]
  );

  return {
    id: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    subtotal: Number.parseFloat(order.subtotal),
    shippingFee: Number.parseFloat(order.shipping_fee),
    discount: Number.parseFloat(order.discount),
    total: Number.parseFloat(order.total),
    status: order.status,
    paymentStatus: order.payment_status,
    shipping: {
      name: order.shipping_name,
      phone: order.shipping_phone,
      address: order.shipping_address,
      city: order.shipping_city,
      state: order.shipping_state,
      postalCode: order.shipping_postal_code,
    },
    notes: order.notes,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      productImage: item.product_image,
      unitPrice: Number.parseFloat(item.unit_price),
      quantity: item.quantity,
      lineTotal: Number.parseFloat(item.line_total),
    })),
  };
}

module.exports = { checkout, loadOrder, pool };
