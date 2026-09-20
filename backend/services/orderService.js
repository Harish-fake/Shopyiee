'use strict';

/**
 * Order history and fulfilment.
 *
 * `getOrderForUser` always scopes the lookup to the signed-in account.  The
 * deliberately vulnerable read path used for the authorization exercise is
 * kept separately in `controllers/orderController.js` and is never used when
 * APP_MODE=secure.
 */

const { query, queryOne, withTransaction } = require('../config/db');
const pricing = require('./pricingService');
const { transactionReference } = require('../utils/reference');
const { notFound, badRequest, unprocessable } = require('../utils/errors');
const logger = require('../utils/logger');

const VALID_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

function mapOrderRow(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    subtotal: Number.parseFloat(row.subtotal),
    shippingFee: Number.parseFloat(row.shipping_fee),
    discount: Number.parseFloat(row.discount),
    total: Number.parseFloat(row.total),
    status: row.status,
    paymentStatus: row.payment_status,
    shipping: {
      name: row.shipping_name,
      phone: row.shipping_phone,
      address: row.shipping_address,
      city: row.shipping_city,
      state: row.shipping_state,
      postalCode: row.shipping_postal_code,
    },
    notes: row.notes,
    itemCount: row.item_count === undefined ? undefined : Number(row.item_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function attachItems(orders) {
  if (!orders.length) return orders;

  const ids = orders.map((order) => order.id);
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await query(
    `SELECT id, order_id, product_id, product_name, product_image, unit_price, quantity, line_total
     FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    ids
  );

  const byOrder = new Map();
  for (const row of rows) {
    if (!byOrder.has(row.order_id)) byOrder.set(row.order_id, []);
    byOrder.get(row.order_id).push({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      productImage: row.product_image,
      unitPrice: Number.parseFloat(row.unit_price),
      quantity: row.quantity,
      lineTotal: Number.parseFloat(row.line_total),
    });
  }

  return orders.map((order) => ({ ...order, items: byOrder.get(order.id) ?? [] }));
}

const ORDER_SELECT = `
  SELECT o.*, u.name AS customer_name, u.email AS customer_email,
         (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
  FROM orders o
  JOIN users u ON u.id = o.user_id
`;

/** Orders belonging to one account. */
async function listOrdersForUser(userId, { page = 1, limit = 20, status = null } = {}) {
  const params = [userId];
  let where = 'WHERE o.user_id = ?';
  if (status) {
    where += ' AND o.status = ?';
    params.push(status);
  }

  const offset = (page - 1) * limit;
  const rows = await query(
    `${ORDER_SELECT} ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const countRow = await queryOne(`SELECT COUNT(*) AS total FROM orders o ${where}`, params);

  return {
    items: await attachItems(rows.map(mapOrderRow)),
    total: countRow?.total ?? 0,
    page,
    limit,
  };
}

/** Single order, scoped to the owning account. */
async function getOrderForUser(orderId, userId) {
  const row = await queryOne(`${ORDER_SELECT} WHERE o.id = ? AND o.user_id = ? LIMIT 1`, [orderId, userId]);
  if (!row) return null;
  const [order] = await attachItems([mapOrderRow(row)]);
  return order;
}

/** Single order without an ownership filter - used by the hardened admin view. */
async function getOrderById(orderId) {
  const row = await queryOne(`${ORDER_SELECT} WHERE o.id = ? LIMIT 1`, [orderId]);
  if (!row) return null;
  const [order] = await attachItems([mapOrderRow(row)]);
  return order;
}

async function listAllOrders({ page = 1, limit = 25, status = null, search = null } = {}) {
  const params = [];
  const clauses = [];

  if (status) {
    clauses.push('o.status = ?');
    params.push(status);
  }
  if (search) {
    clauses.push('(o.order_number LIKE ? OR u.email LIKE ? OR u.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rows = await query(
    `${ORDER_SELECT} ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id = o.user_id ${where}`,
    params
  );

  return {
    items: await attachItems(rows.map(mapOrderRow)),
    total: countRow?.total ?? 0,
    page,
    limit,
  };
}

/** Change the fulfilment status of an order. */
async function updateStatus(orderId, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw badRequest(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const existing = await queryOne('SELECT id, user_id, status FROM orders WHERE id = ? LIMIT 1', [orderId]);
  if (!existing) throw notFound('Order not found');

  await query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  logger.info('Order status updated', { orderId, from: existing.status, to: status });

  return getOrderById(orderId);
}

/**
 * Cancel an order and refund the simulated wallet.
 * The refund and the status change happen in one transaction.
 */
async function cancelOrder(orderId, { userId = null, isAdmin = false } = {}) {
  return withTransaction(async (connection) => {
    const params = [orderId];
    let sql = 'SELECT id, user_id, total, status, payment_status, order_number FROM orders WHERE id = ?';
    if (!isAdmin) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    sql += ' FOR UPDATE';

    const [rows] = await connection.execute(sql, params);
    if (!rows.length) throw notFound('Order not found');

    const order = rows[0];
    if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
      throw unprocessable('This order has already been dispatched and cannot be cancelled');
    }
    if (order.status === 'CANCELLED') {
      throw unprocessable('This order has already been cancelled');
    }

    await connection.execute("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", [orderId]);

    if (order.payment_status === 'PAID') {
      const [userRows] = await connection.execute('SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE', [
        order.user_id,
      ]);
      const balance = pricing.round(Number.parseFloat(userRows[0].wallet_balance));
      const refunded = pricing.round(Number.parseFloat(order.total));
      const newBalance = pricing.round(balance + refunded);

      await connection.execute('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, order.user_id]);
      await connection.execute(
        `INSERT INTO transactions (user_id, order_id, type, amount, balance_after, description, reference)
         VALUES (?, ?, 'REFUND', ?, ?, ?, ?)`,
        [
          order.user_id,
          orderId,
          refunded,
          newBalance,
          `Refund for cancelled order ${order.order_number}`,
          transactionReference('TXN-REF'),
        ]
      );
      await connection.execute("UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ?", [orderId]);

      // Return the reserved stock to the catalogue.
      await connection.execute(
        `UPDATE products p
         JOIN order_items oi ON oi.product_id = p.id
         SET p.stock = p.stock + oi.quantity
         WHERE oi.order_id = ?`,
        [orderId]
      );
    }

    logger.info('Order cancelled', { orderId, userId: order.user_id });
    return { id: orderId, status: 'CANCELLED' };
  });
}

/** Aggregate figures for the administration dashboard. */
async function getDashboardStats() {
  const [users, products, orders, sales] = await Promise.all([
    queryOne('SELECT COUNT(*) AS total FROM users'),
    queryOne('SELECT COUNT(*) AS total FROM products WHERE is_active = 1'),
    queryOne(`SELECT
                COUNT(*) AS total,
                SUM(status = 'PENDING') AS pending,
                SUM(status = 'PROCESSING') AS processing,
                SUM(status = 'SHIPPED') AS shipped,
                SUM(status = 'DELIVERED') AS delivered,
                SUM(status = 'CANCELLED') AS cancelled
              FROM orders`),
    queryOne(`SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE payment_status = 'PAID'`),
  ]);

  const lowStock = await queryOne(
    'SELECT COUNT(*) AS total FROM products WHERE is_active = 1 AND stock <= 10'
  );

  return {
    totalUsers: Number(users?.total ?? 0),
    totalProducts: Number(products?.total ?? 0),
    totalOrders: Number(orders?.total ?? 0),
    pendingOrders: Number(orders?.pending ?? 0),
    processingOrders: Number(orders?.processing ?? 0),
    shippedOrders: Number(orders?.shipped ?? 0),
    completedOrders: Number(orders?.delivered ?? 0),
    cancelledOrders: Number(orders?.cancelled ?? 0),
    lowStockProducts: Number(lowStock?.total ?? 0),
    totalSales: pricing.round(Number.parseFloat(sales?.revenue ?? 0)),
  };
}

async function countOrders() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM orders');
  return row?.total ?? 0;
}

module.exports = {
  VALID_STATUSES,
  listOrdersForUser,
  getOrderForUser,
  getOrderById,
  listAllOrders,
  updateStatus,
  cancelOrder,
  getDashboardStats,
  countOrders,
  mapOrderRow,
};
