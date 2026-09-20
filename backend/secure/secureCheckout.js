'use strict';

/**
 * Hardened checkout.
 *
 * Order of operations:
 *
 *   1. Validate the shape of the request (ids are integers, quantities are
 *      bounded positive integers).  Any client-supplied price or total is
 *      discarded outright.
 *   2. Load the products being purchased from MySQL.
 *   3. Verify each product exists, is active and has enough stock.
 *   4. Recalculate every line total and the order total on the server.
 *   5. Re-read the wallet balance inside the transaction and confirm funds.
 *   6. Write the order, its line items, the stock movements, the wallet entry
 *      and the balance change as a single atomic unit.
 *
 * Used when APP_MODE=secure and mounted at `POST /api/checkout-secure` in every
 * mode so the two implementations can be compared.
 */

const { query, queryOne, withTransaction } = require('../config/db');
const pricing = require('../services/pricingService');
const { orderNumber, transactionReference } = require('../utils/reference');
const { badRequest, notFound, unprocessable } = require('../utils/errors');
const { asInt, asString } = require('../utils/validators');
const logger = require('../utils/logger');

/** Normalise and validate the submitted item list. */
function normaliseItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw badRequest('Your cart is empty');
  }
  if (rawItems.length > 50) {
    throw badRequest('An order cannot contain more than 50 distinct products');
  }

  const merged = new Map();

  for (const item of rawItems) {
    const productId = asInt(item?.productId, 'items[].productId', { min: 1 });
    const quantity = asInt(item?.quantity, 'items[].quantity', { min: 1, max: 99 });

    // Fold repeated lines for the same product into one.
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }

  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function normaliseShipping(raw = {}) {
  const shipping = {
    name: raw.name ? asString(raw.name, 'shipping.name', { min: 2, max: 120 }) : null,
    phone: raw.phone ? asString(raw.phone, 'shipping.phone', { min: 6, max: 30 }) : null,
    address: raw.address ? asString(raw.address, 'shipping.address', { min: 4, max: 255 }) : null,
    city: raw.city ? asString(raw.city, 'shipping.city', { min: 2, max: 80 }) : null,
    state: raw.state ? asString(raw.state, 'shipping.state', { min: 2, max: 80 }) : null,
    postalCode: raw.postalCode ? asString(raw.postalCode, 'shipping.postalCode', { min: 3, max: 20 }) : null,
  };
  return shipping;
}

async function checkout({ userId, items, shipping = {}, notes = null }) {
  const requested = normaliseItems(items);
  const address = normaliseShipping(shipping);

  // ---- Load authoritative product data ------------------------------------
  const placeholders = requested.map(() => '?').join(', ');
  const rows = await query(
    `SELECT id, name, image, price, stock, is_active
     FROM products
     WHERE id IN (${placeholders})`,
    requested.map((item) => item.productId)
  );

  const catalogue = new Map(rows.map((row) => [row.id, row]));

  const lines = [];
  for (const item of requested) {
    const product = catalogue.get(item.productId);
    if (!product) throw notFound(`Product ${item.productId} is no longer available`);
    if (!product.is_active) throw unprocessable(`Product ${item.productId} is not available for purchase`);

    const unitPrice = pricing.round(Number.parseFloat(product.price));
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw unprocessable(`Product ${item.productId} has an invalid price`);
    }

    if (product.stock < item.quantity) {
      throw unprocessable(`Only ${product.stock} unit(s) of "${product.name}" remain in stock`);
    }

    lines.push({
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      unitPrice,
      quantity: item.quantity,
      lineTotal: pricing.lineTotal(unitPrice, item.quantity),
    });
  }

  // ---- Server-side totals --------------------------------------------------
  const totals = pricing.summarise(lines);

  const orderId = await withTransaction(async (connection) => {
    // Lock the account row so concurrent checkouts cannot overspend.
    const [userRows] = await connection.execute(
      'SELECT id, wallet_balance FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (!userRows.length) throw unprocessable('Account not found');

    const balance = pricing.round(Number.parseFloat(userRows[0].wallet_balance));
    if (balance < totals.total) {
      throw unprocessable(
        `Insufficient wallet balance. Order total is ${totals.total.toFixed(2)} but the balance is ${balance.toFixed(2)}.`
      );
    }

    // Re-check stock inside the transaction to close the race window.
    for (const line of lines) {
      const [stockRows] = await connection.execute(
        'SELECT stock FROM products WHERE id = ? FOR UPDATE',
        [line.productId]
      );
      const available = stockRows[0]?.stock ?? 0;
      if (available < line.quantity) {
        throw unprocessable(`"${line.productName}" sold out while the order was being placed`);
      }
    }

    const number = orderNumber();

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
         (user_id, order_number, subtotal, shipping_fee, discount, total, status, payment_status,
          shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_postal_code, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'PROCESSING', 'PAID', ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        number,
        totals.subtotal,
        totals.shippingFee,
        totals.discount,
        totals.total,
        address.name,
        address.phone,
        address.address,
        address.city,
        address.state,
        address.postalCode,
        notes ? asString(notes, 'notes', { min: 1, max: 255 }) : null,
      ]
    );

    const newOrderId = orderResult.insertId;

    for (const line of lines) {
      await connection.execute(
        `INSERT INTO order_items
           (order_id, product_id, product_name, product_image, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          newOrderId,
          line.productId,
          line.productName,
          line.productImage,
          line.unitPrice,
          line.quantity,
          line.lineTotal,
        ]
      );

      await connection.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [line.quantity, line.productId]);
    }

    const newBalance = pricing.round(balance - totals.total);

    await connection.execute(
      `INSERT INTO transactions (user_id, order_id, type, amount, balance_after, description, reference)
       VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?)`,
      [
        userId,
        newOrderId,
        totals.total,
        newBalance,
        `Payment for order ${number}`,
        transactionReference('TXN'),
      ]
    );

    await connection.execute('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, userId]);

    // Remove exactly the products that were purchased from the cart.
    await connection.execute(
      `DELETE FROM cart_items WHERE user_id = ? AND product_id IN (${lines.map(() => '?').join(', ')})`,
      [userId, ...lines.map((line) => line.productId)]
    );

    return newOrderId;
  });

  logger.info('Checkout completed', { userId, orderId, total: totals.total, mode: 'secure' });

  return loadOrder(orderId, userId);
}

/**
 * Load an order.
 *
 * When `ownerId` is supplied the query is scoped to that account, so the
 * function cannot be used to read somebody else's order.
 */
async function loadOrder(orderId, ownerId = null) {
  const params = [orderId];
  let sql = `SELECT o.*, u.name AS customer_name, u.email AS customer_email
             FROM orders o JOIN users u ON u.id = o.user_id
             WHERE o.id = ?`;
  if (ownerId !== null) {
    sql += ' AND o.user_id = ?';
    params.push(ownerId);
  }
  sql += ' LIMIT 1';

  const order = await queryOne(sql, params);
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

module.exports = { checkout, loadOrder, normaliseItems, normaliseShipping };
