'use strict';

/**
 * MySQL connection pool.
 *
 * The application deliberately uses raw `mysql2` rather than an ORM so that the
 * parameterised and non-parameterised query paths stay explicit and readable.
 *
 * The pool is created with `namedPlaceholders` disabled on purpose: every query
 * that uses placeholders does so with positional `?` markers, which keeps the
 * difference between the safe and unsafe implementations easy to audit.
 */

const mysql = require('mysql2/promise');
const config = require('./env');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  // `undefined` means a plaintext connection, which is what a local loopback
  // instance uses.  Managed providers set DB_SSL=true - see config/env.js.
  ssl: config.db.ssl,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  dateStrings: false,
  // Return DECIMAL columns as strings so monetary values never lose precision
  // through a float round-trip.  Services convert explicitly where needed.
  decimalNumbers: false,
  supportBigNumbers: true,
  bigNumberStrings: false,
});

if (config.db.ssl && config.db.ssl.rejectUnauthorized === false) {
  logger.warn(
    'Database TLS certificate verification is disabled (DB_SSL_REJECT_UNAUTHORIZED=false). ' +
      'The connection is encrypted but the server is not authenticated - do not use this ' +
      'outside a throwaway environment.'
  );
}

/**
 * Run a query on a pooled connection.
 *
 * @param {string} sql    SQL text, optionally containing `?` placeholders.
 * @param {Array}  params Values bound to the placeholders.  Passing values here
 *                        (rather than concatenating them into `sql`) is what
 *                        makes a query safe against injection.
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Run a query and return only the first row (or null). */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Execute a set of statements inside a single transaction.
 *
 * The callback receives a dedicated connection.  Anything it returns is passed
 * back to the caller once the transaction commits.
 */
async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Transaction rollback failed', { message: rollbackError.message });
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Lightweight connectivity probe used at start-up. */
async function checkConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    const [rows] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version');
    return rows[0];
  } finally {
    connection.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, queryOne, withTransaction, checkConnection, closePool };
