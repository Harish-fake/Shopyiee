'use strict';

/**
 * Simulated wallet.
 *
 * This is a self-contained ledger stored in MySQL.  There is no connection to
 * any bank, card network, payment gateway or cryptocurrency system - the
 * "balance" is a number in a table and deposits are fictional.
 */

const { query, queryOne, withTransaction } = require('../config/db');
const pricing = require('./pricingService');
const { transactionReference } = require('../utils/reference');
const { notFound, badRequest } = require('../utils/errors');
const logger = require('../utils/logger');

const MAX_DEPOSIT = 100000;

function mapTransaction(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number ?? null,
    type: row.type,
    amount: Number.parseFloat(row.amount),
    balanceAfter: Number.parseFloat(row.balance_after),
    description: row.description,
    reference: row.reference,
    createdAt: row.created_at,
  };
}

async function getBalance(userId) {
  const row = await queryOne('SELECT wallet_balance FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!row) throw notFound('Account not found');
  return pricing.round(Number.parseFloat(row.wallet_balance));
}

async function getWallet(userId) {
  const [balance, summary, recent] = await Promise.all([
    getBalance(userId),
    queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount END), 0) AS deposited,
         COALESCE(SUM(CASE WHEN type = 'PURCHASE' THEN amount END), 0) AS spent,
         COALESCE(SUM(CASE WHEN type = 'REFUND' THEN amount END), 0) AS refunded,
         COUNT(*) AS entries
       FROM transactions WHERE user_id = ?`,
      [userId]
    ),
    listTransactions(userId, { limit: 5 }),
  ]);

  return {
    balance,
    currency: 'INR',
    currencyLabel: 'ShopSphere Credits',
    summary: {
      totalDeposited: pricing.round(Number.parseFloat(summary?.deposited ?? 0)),
      totalSpent: pricing.round(Number.parseFloat(summary?.spent ?? 0)),
      totalRefunded: pricing.round(Number.parseFloat(summary?.refunded ?? 0)),
      entries: Number(summary?.entries ?? 0),
    },
    recentTransactions: recent.items,
  };
}

async function listTransactions(userId, { limit = 50, offset = 0, type = null } = {}) {
  const params = [userId];
  let where = 'WHERE t.user_id = ?';
  if (type) {
    where += ' AND t.type = ?';
    params.push(type);
  }

  const rows = await query(
    `SELECT t.*, o.order_number
     FROM transactions t
     LEFT JOIN orders o ON o.id = t.order_id
     ${where}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const countRow = await queryOne(`SELECT COUNT(*) AS total FROM transactions t ${where}`, params);

  return { items: rows.map(mapTransaction), total: countRow?.total ?? 0 };
}

/**
 * Add simulated funds.
 * A deposit is a database write and nothing else - no external service is
 * contacted at any point.
 */
async function deposit(userId, amount, description = 'Wallet top-up') {
  const value = pricing.round(amount);
  if (!Number.isFinite(value) || value <= 0) throw badRequest('Deposit amount must be greater than zero');
  if (value > MAX_DEPOSIT) throw badRequest(`A single top-up cannot exceed ${MAX_DEPOSIT.toLocaleString('en-IN')}`);

  const result = await withTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!rows.length) throw notFound('Account not found');

    const balance = pricing.round(Number.parseFloat(rows[0].wallet_balance));
    const newBalance = pricing.round(balance + value);

    await connection.execute('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, userId]);
    await connection.execute(
      `INSERT INTO transactions (user_id, order_id, type, amount, balance_after, description, reference)
       VALUES (?, NULL, 'DEPOSIT', ?, ?, ?, ?)`,
      [userId, value, newBalance, description, transactionReference('TXN-DEP')]
    );

    return newBalance;
  });

  logger.info('Wallet top-up recorded', { userId, amount: value });

  return { balance: result, added: value };
}

/** Recent purchases shown alongside the balance. */
async function getRecentPurchases(userId, limit = 5) {
  const rows = await query(
    `SELECT o.id, o.order_number, o.total, o.status, o.created_at,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o
     WHERE o.user_id = ?
     ORDER BY o.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    total: Number.parseFloat(row.total),
    status: row.status,
    itemCount: Number(row.item_count),
    createdAt: row.created_at,
  }));
}

async function listAllTransactions({ limit = 100, offset = 0 } = {}) {
  const rows = await query(
    `SELECT t.*, o.order_number, u.name AS user_name, u.email AS user_email
     FROM transactions t
     LEFT JOIN orders o ON o.id = t.order_id
     JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const countRow = await queryOne('SELECT COUNT(*) AS total FROM transactions');

  return {
    items: rows.map((row) => ({
      ...mapTransaction(row),
      userName: row.user_name,
      userEmail: row.user_email,
    })),
    total: countRow?.total ?? 0,
  };
}

module.exports = {
  getBalance,
  getWallet,
  listTransactions,
  deposit,
  getRecentPurchases,
  listAllTransactions,
  MAX_DEPOSIT,
};
