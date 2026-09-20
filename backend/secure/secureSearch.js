'use strict';

/**
 * Hardened catalogue search.
 *
 * Every value that originates from the client is bound to a `?` placeholder and
 * executed through a prepared statement, so the database treats it purely as
 * data.  Sorting is resolved against a fixed allow-list and pagination is
 * coerced to integers.
 *
 * This module is used when APP_MODE=secure and is also mounted at
 * `GET /api/products/search-safe` in every mode so the two implementations can
 * be compared directly.
 */

const { query } = require('../config/db');
const { asInt, asMoney, asString } = require('../utils/validators');
const { escapeHtml } = require('../utils/encoding');

const SORTABLE = {
  newest: 'p.created_at DESC',
  oldest: 'p.created_at ASC',
  'price-asc': 'p.price ASC',
  'price-desc': 'p.price DESC',
  'rating-desc': 'p.rating DESC',
  'name-asc': 'p.name ASC',
};

const BASE_SELECT = `
  SELECT
    p.id, p.name, p.slug, p.description, p.brand, p.price, p.original_price,
    p.stock, p.category_id, p.image, p.rating, p.review_count, p.is_featured,
    c.name AS category_name, c.slug AS category_slug
  FROM products p
  JOIN categories c ON c.id = p.category_id
`;

/**
 * Build the WHERE fragment and its bound parameters.
 * The SQL text never contains client data - only `?` markers.
 */
function buildFilters(filters = {}) {
  const clauses = ['p.is_active = 1'];
  const params = [];

  const rawQuery = filters.q;
  if (rawQuery !== undefined && rawQuery !== null && String(rawQuery).trim() !== '') {
    const term = asString(String(rawQuery), 'q', { min: 1, max: 100 });
    // Escape LIKE wildcards so a literal % does not widen the match.
    const like = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    clauses.push('(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)');
    params.push(like, like, like);
  }

  if (filters.categoryId !== undefined && filters.categoryId !== '' && filters.categoryId !== null) {
    clauses.push('p.category_id = ?');
    params.push(asInt(filters.categoryId, 'categoryId', { min: 1, max: 4_294_967_295 }));
  }

  if (filters.minPrice !== undefined && filters.minPrice !== '' && filters.minPrice !== null) {
    clauses.push('p.price >= ?');
    params.push(asMoney(filters.minPrice, 'minPrice'));
  }

  if (filters.maxPrice !== undefined && filters.maxPrice !== '' && filters.maxPrice !== null) {
    clauses.push('p.price <= ?');
    params.push(asMoney(filters.maxPrice, 'maxPrice'));
  }

  return { where: clauses.join(' AND '), params };
}

function resolveSort(sort) {
  return SORTABLE[sort] || SORTABLE.newest;
}

async function searchProducts(filters = {}) {
  const { where, params } = buildFilters(filters);

  const limit = Math.min(Math.max(asInt(filters.limit ?? 12, 'limit', { min: 1, max: 60 }), 1), 60);
  const page = Math.max(asInt(filters.page ?? 1, 'page', { min: 1, max: 10_000 }), 1);
  const offset = (page - 1) * limit;

  const sql = `${BASE_SELECT} WHERE ${where} ORDER BY ${resolveSort(filters.sort)} LIMIT ? OFFSET ?`;

  const rows = await query(sql, [...params, limit, offset]);
  return { rows, sql };
}

async function countProducts(filters = {}) {
  const { where, params } = buildFilters(filters);
  const rows = await query(`SELECT COUNT(*) AS total FROM products p WHERE ${where}`, params);
  return rows[0]?.total ?? 0;
}

/**
 * HTML-encode the echoed search term.
 *
 * The storefront displays "Results for <term>"; encoding here means the value
 * can never be parsed as markup, whatever the client sends.
 */
function echoQuery(q) {
  return escapeHtml(q === undefined || q === null ? '' : String(q));
}

module.exports = { searchProducts, countProducts, echoQuery, SORTABLE };
