'use strict';

/**
 * ===========================================================================
 *  INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING
 *  DO NOT USE THIS IMPLEMENTATION IN PRODUCTION
 * ===========================================================================
 *
 * Catalogue search built by concatenating user input directly into the SQL
 * statement.  This module exists so that the difference between an unsafe and a
 * safe query can be reviewed side by side; `../secure/secureSearch.js` contains
 * the parameterised equivalent.
 *
 * Safety rails that keep the exercise non-destructive:
 *
 *   1. The connection pool is created with `multipleStatements: false`
 *      (mysql2's default), so a stacked query such as `'; DROP TABLE ...`
 *      cannot be executed even though it is accepted as input.
 *   2. `assertReadOnly()` rejects input containing data-definition or
 *      data-modification keywords before the statement is sent to MySQL.
 *      Boolean-based, UNION-based and error-based inference remain fully
 *      available, which is what the exercise is about.
 *   3. Only SELECT statements are ever constructed here.
 *
 * This file is loaded only when APP_MODE is `development` or `testing`.
 * See docs/security-testing.md.
 */

const { query } = require('../config/db');
const { badRequest } = require('../utils/errors');
const logger = require('../utils/logger');

const SORTABLE = {
  newest: 'p.created_at DESC',
  oldest: 'p.created_at ASC',
  'price-asc': 'p.price ASC',
  'price-desc': 'p.price DESC',
  'rating-desc': 'p.rating DESC',
  'name-asc': 'p.name ASC',
};

const FORBIDDEN_KEYWORDS = [
  'drop', 'delete', 'truncate', 'update', 'insert', 'replace', 'alter',
  'create', 'grant', 'revoke', 'rename', 'load_file', 'outfile', 'dumpfile',
  'shutdown', 'sleep', 'benchmark', 'information_schema', 'into',
];

/**
 * Safety rail - see note 2 above.  Keeps the exercise focused on read-only
 * inference techniques and prevents accidental damage to the sample data.
 */
function assertReadOnly(value, fieldName) {
  const lowered = String(value).toLowerCase();
  const hit = FORBIDDEN_KEYWORDS.find((keyword) => lowered.includes(keyword));
  if (hit) {
    logger.warn('Search input rejected by read-only safety rail', { fieldName, keyword: hit });
    throw badRequest('The search term contains unsupported keywords.');
  }
  return value;
}

const BASE_SELECT = `
  SELECT
    p.id, p.name, p.slug, p.description, p.brand, p.price, p.original_price,
    p.stock, p.category_id, p.image, p.rating, p.review_count, p.is_featured,
    c.name AS category_name, c.slug AS category_slug
  FROM products p
  JOIN categories c ON c.id = p.category_id
`;

/**
 * Search the catalogue.
 *
 * @returns {Promise<{rows: Array, sql: string}>}
 */
async function searchProducts(filters = {}) {
  const {
    q = '',
    categoryId = '',
    minPrice = '',
    maxPrice = '',
    sort = 'newest',
    page = 1,
    limit = 12,
  } = filters;

  // ---- INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING -------------
  // Every filter below is interpolated straight into the statement.  A value
  // such as  ' OR '1'='1  changes the meaning of the WHERE clause.
  let sql = `${BASE_SELECT} WHERE p.is_active = 1`;

  if (q) {
    const term = assertReadOnly(q, 'q');
    sql += ` AND (p.name LIKE '%${term}%' OR p.description LIKE '%${term}%' OR p.brand LIKE '%${term}%')`;
  }

  if (categoryId) {
    sql += ` AND p.category_id = ${assertReadOnly(categoryId, 'categoryId')}`;
  }

  if (minPrice !== '' && minPrice !== undefined && minPrice !== null) {
    sql += ` AND p.price >= ${assertReadOnly(minPrice, 'minPrice')}`;
  }

  if (maxPrice !== '' && maxPrice !== undefined && maxPrice !== null) {
    sql += ` AND p.price <= ${assertReadOnly(maxPrice, 'maxPrice')}`;
  }
  // --------------------------------------------------------------------------

  sql += ` ORDER BY ${SORTABLE[sort] || SORTABLE.newest}`;

  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 12, 1), 60);
  const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
  sql += ` LIMIT ${safeLimit} OFFSET ${(safePage - 1) * safeLimit}`;

  logger.debug('Catalogue search executed', { mode: 'development', sql });

  const rows = await query(sql);
  return { rows, sql };
}

/** Total row count for pagination. */
async function countProducts(filters = {}) {
  const { q = '', categoryId = '', minPrice = '', maxPrice = '' } = filters;

  let sql = 'SELECT COUNT(*) AS total FROM products p WHERE p.is_active = 1';

  if (q) {
    const term = assertReadOnly(q, 'q');
    sql += ` AND (p.name LIKE '%${term}%' OR p.description LIKE '%${term}%' OR p.brand LIKE '%${term}%')`;
  }
  if (categoryId) sql += ` AND p.category_id = ${assertReadOnly(categoryId, 'categoryId')}`;
  if (minPrice !== '' && minPrice !== undefined) sql += ` AND p.price >= ${assertReadOnly(minPrice, 'minPrice')}`;
  if (maxPrice !== '' && maxPrice !== undefined) sql += ` AND p.price <= ${assertReadOnly(maxPrice, 'maxPrice')}`;

  const rows = await query(sql);
  return rows[0]?.total ?? 0;
}

/**
 * ===========================================================================
 *  INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING
 *  DO NOT USE THIS IMPLEMENTATION IN PRODUCTION
 * ===========================================================================
 *
 * The search term is echoed back to the client verbatim, without HTML encoding.
 * The storefront inserts this value into the results heading, so a crafted
 * query string is reflected into the rendered page.
 *
 * The safe counterpart is `secureSearch.echoQuery()`.
 */
function echoQuery(q) {
  return q === undefined || q === null ? '' : String(q);
}

module.exports = { searchProducts, countProducts, echoQuery, SORTABLE };
