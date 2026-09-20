'use strict';

/**
 * Account management.
 *
 * Passwords are hashed with bcrypt (cost factor 10) and compared using the
 * library's constant-time comparison.  The plain-text password is never stored,
 * logged or returned.
 */

const bcrypt = require('bcryptjs');
const { query, queryOne, withTransaction } = require('../config/db');
const config = require('../config/env');
const { conflict, notFound, unauthorized, badRequest } = require('../utils/errors');
const { transactionReference } = require('../utils/reference');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = 10;

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    walletBalance: Number.parseFloat(row.wallet_balance),
    phone: row.phone,
    address: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    createdAt: row.created_at,
  };
}

async function findByEmail(email) {
  return queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
}

async function findById(id) {
  return queryOne(
    `SELECT id, name, email, role, wallet_balance, phone, address_line, city, state, postal_code, country, created_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
}

/**
 * Create an account.
 *
 * The starting wallet balance is a simulated figure stored in MySQL; there is
 * no connection to any real payment system.
 */
async function register({ name, email, password, phone = null }) {
  const existing = await findByEmail(email);
  if (existing) throw conflict('An account with that email address already exists');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const openingBalance = config.wallet.startingBalance;

  const userId = await withTransaction(async (connection) => {
    const [result] = await connection.execute(
      `INSERT INTO users (name, email, password_hash, role, wallet_balance, phone)
       VALUES (?, ?, ?, 'USER', ?, ?)`,
      [name, email, passwordHash, openingBalance, phone]
    );

    await connection.execute(
      `INSERT INTO transactions (user_id, order_id, type, amount, balance_after, description, reference)
       VALUES (?, NULL, 'DEPOSIT', ?, ?, 'Wallet opened', ?)`,
      [result.insertId, openingBalance, openingBalance, transactionReference('TXN-OPEN')]
    );

    return result.insertId;
  });

  logger.info('Account registered', { userId, email });

  return mapUser(await findById(userId));
}

/**
 * Verify credentials.
 *
 * The same generic message is returned whether the address is unknown or the
 * password is wrong, so the endpoint cannot be used to enumerate accounts.
 */
async function authenticate({ email, password }) {
  const row = await findByEmail(email);

  if (!row) {
    // Perform a dummy comparison so the response time does not reveal whether
    // the account exists.
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    logger.warn('Failed sign-in attempt', { email, reason: 'unknown-account' });
    throw unauthorized('Incorrect email address or password');
  }

  if (!row.is_active) {
    logger.warn('Failed sign-in attempt', { userId: row.id, reason: 'disabled-account' });
    throw unauthorized('This account has been disabled');
  }

  const matches = await bcrypt.compare(password, row.password_hash);
  if (!matches) {
    logger.warn('Failed sign-in attempt', { userId: row.id, reason: 'bad-password' });
    throw unauthorized('Incorrect email address or password');
  }

  logger.info('Sign-in successful', { userId: row.id, role: row.role });
  return mapUser(row);
}

/** Replace the account password after verifying the current one. */
async function changePassword({ userId, currentPassword, newPassword }) {
  const row = await queryOne('SELECT id, password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!row) throw notFound('Account not found');

  const matches = await bcrypt.compare(currentPassword, row.password_hash);
  if (!matches) throw unauthorized('Your current password is incorrect');

  if (currentPassword === newPassword) {
    throw badRequest('The new password must be different from the current one');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

  logger.info('Password changed', { userId });
  return true;
}

/** Update the stored profile details. */
async function updateProfile({ userId, name, phone, address, city, state, postalCode }) {
  await query(
    `UPDATE users
     SET name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         address_line = COALESCE(?, address_line),
         city = COALESCE(?, city),
         state = COALESCE(?, state),
         postal_code = COALESCE(?, postal_code)
     WHERE id = ?`,
    [name ?? null, phone ?? null, address ?? null, city ?? null, state ?? null, postalCode ?? null, userId]
  );

  return mapUser(await findById(userId));
}

async function listUsers({ limit = 100, offset = 0, search = null } = {}) {
  const params = [];
  let sql = `SELECT id, name, email, role, wallet_balance, phone, city, state, country, is_active, created_at
             FROM users`;
  if (search) {
    sql += ' WHERE name LIKE ? OR email LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await query(sql, params);
  return rows.map((row) => ({ ...mapUser(row), isActive: Boolean(row.is_active) }));
}

async function countUsers() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM users');
  return row?.total ?? 0;
}

module.exports = {
  register,
  authenticate,
  changePassword,
  updateProfile,
  findById,
  findByEmail,
  listUsers,
  countUsers,
  mapUser,
  BCRYPT_ROUNDS,
};
