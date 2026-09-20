'use strict';

/**
 * Catalogue access.
 *
 * Every query in this module is parameterised.  Search lives in
 * `secure/secureSearch.js` and `vulnerabilities/vulnerableSearch.js` because
 * those two implementations are deliberately kept apart.
 */

const { query, queryOne } = require('../config/db');
const { notFound, badRequest, conflict } = require('../utils/errors');

const SELECT_FIELDS = `
  p.id, p.name, p.slug, p.description, p.brand, p.price, p.original_price,
  p.stock, p.category_id, p.image, p.rating, p.review_count, p.is_featured,
  p.is_active, p.created_at, p.updated_at,
  c.name AS category_name, c.slug AS category_slug
`;

function mapProduct(row) {
  if (!row) return null;
  const price = Number.parseFloat(row.price);
  const originalPrice = row.original_price === null ? null : Number.parseFloat(row.original_price);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    brand: row.brand,
    price,
    originalPrice,
    discountPercent: originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0,
    stock: row.stock,
    inStock: row.stock > 0,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    image: row.image,
    rating: Number.parseFloat(row.rating),
    reviewCount: row.review_count,
    isFeatured: Boolean(row.is_featured),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

/** Paginated catalogue listing. */
async function listProducts({ page = 1, limit = 12, categoryId = null, sort = 'newest', includeInactive = false } = {}) {
  const SORTS = {
    newest: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
    'price-asc': 'p.price ASC',
    'price-desc': 'p.price DESC',
    'rating-desc': 'p.rating DESC',
    'name-asc': 'p.name ASC',
  };

  const clauses = [];
  const params = [];

  if (!includeInactive) clauses.push('p.is_active = 1');
  if (categoryId) {
    clauses.push('p.category_id = ?');
    params.push(categoryId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = SORTS[sort] || SORTS.newest;
  const offset = (page - 1) * limit;

  const rows = await query(
    `SELECT ${SELECT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM products p ${where}`,
    params
  );

  return { items: rows.map(mapProduct), total: countRow?.total ?? 0, page, limit };
}

async function getProductById(id, { includeInactive = false } = {}) {
  const row = await queryOne(
    `SELECT ${SELECT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? ${includeInactive ? '' : 'AND p.is_active = 1'} LIMIT 1`,
    [id]
  );
  return mapProduct(row);
}

async function getProductBySlug(slug) {
  const row = await queryOne(
    `SELECT ${SELECT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ? AND p.is_active = 1 LIMIT 1`,
    [slug]
  );
  return mapProduct(row);
}

/** Other products in the same category. */
async function getRelatedProducts(productId, categoryId, limit = 4) {
  const rows = await query(
    `SELECT ${SELECT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = ? AND p.id <> ? AND p.is_active = 1
     ORDER BY p.rating DESC, p.created_at DESC LIMIT ?`,
    [categoryId, productId, limit]
  );
  return rows.map(mapProduct);
}

async function getFeaturedProducts(limit = 8) {
  const rows = await query(
    `SELECT ${SELECT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.is_featured = 1 AND p.is_active = 1
     ORDER BY p.rating DESC LIMIT ?`,
    [limit]
  );
  return rows.map(mapProduct);
}

async function getNewArrivals(limit = 8) {
  const rows = await query(
    `SELECT ${SELECT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 ORDER BY p.created_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(mapProduct);
}

/** Products the account has not reviewed yet, used for the review form. */
async function getTopRatedProducts(limit = 8) {
  const rows = await query(
    `SELECT ${SELECT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 AND p.review_count > 0
     ORDER BY p.rating DESC, p.review_count DESC LIMIT ?`,
    [limit]
  );
  return rows.map(mapProduct);
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

async function createProduct(input) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  if (!slug) throw badRequest('A product slug could not be derived from the name');

  const existing = await queryOne('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
  if (existing) throw conflict('A product with that name already exists');

  const category = await queryOne('SELECT id FROM categories WHERE id = ? LIMIT 1', [input.categoryId]);
  if (!category) throw badRequest('The selected category does not exist');

  const result = await query(
    `INSERT INTO products
       (name, slug, description, brand, price, original_price, stock, category_id, image, is_featured, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      slug,
      input.description ?? null,
      input.brand ?? null,
      input.price,
      input.originalPrice ?? null,
      input.stock ?? 0,
      input.categoryId,
      input.image ?? null,
      input.isFeatured ? 1 : 0,
      input.isActive === undefined ? 1 : input.isActive ? 1 : 0,
    ]
  );

  return getProductById(result.insertId, { includeInactive: true });
}

async function updateProduct(id, input) {
  const existing = await queryOne('SELECT id FROM products WHERE id = ? LIMIT 1', [id]);
  if (!existing) throw notFound('Product not found');

  if (input.categoryId !== undefined) {
    const category = await queryOne('SELECT id FROM categories WHERE id = ? LIMIT 1', [input.categoryId]);
    if (!category) throw badRequest('The selected category does not exist');
  }

  await query(
    `UPDATE products SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       brand = COALESCE(?, brand),
       price = COALESCE(?, price),
       original_price = COALESCE(?, original_price),
       stock = COALESCE(?, stock),
       category_id = COALESCE(?, category_id),
       image = COALESCE(?, image),
       is_featured = COALESCE(?, is_featured),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [
      input.name ?? null,
      input.description ?? null,
      input.brand ?? null,
      input.price ?? null,
      input.originalPrice ?? null,
      input.stock ?? null,
      input.categoryId ?? null,
      input.image ?? null,
      input.isFeatured === undefined ? null : input.isFeatured ? 1 : 0,
      input.isActive === undefined ? null : input.isActive ? 1 : 0,
      id,
    ]
  );

  return getProductById(id, { includeInactive: true });
}

/**
 * Remove a product.
 *
 * Order history keeps its own snapshot of each line, so deleting a catalogue
 * entry does not damage past orders.  A soft delete is used instead of a hard
 * delete so that existing carts and wishlists stay coherent.
 */
async function deleteProduct(id) {
  const existing = await queryOne('SELECT id FROM products WHERE id = ? LIMIT 1', [id]);
  if (!existing) throw notFound('Product not found');

  await query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
  return { id, deleted: true };
}

async function countProducts() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM products WHERE is_active = 1');
  return row?.total ?? 0;
}

async function getInventory({ lowStockThreshold = 10 } = {}) {
  const rows = await query(
    `SELECT ${SELECT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 ORDER BY p.stock ASC`
  );
  const items = rows.map(mapProduct);
  return { items, lowStock: items.filter((item) => item.stock <= lowStockThreshold) };
}

module.exports = {
  mapProduct,
  slugify,
  listProducts,
  getProductById,
  getProductBySlug,
  getRelatedProducts,
  getFeaturedProducts,
  getNewArrivals,
  getTopRatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  countProducts,
  getInventory,
};
