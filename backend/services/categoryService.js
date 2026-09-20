'use strict';

/** Category listing and per-category product counts. */

const { query, queryOne } = require('../config/db');
const { notFound } = require('../utils/errors');
const { mapProduct, listProducts } = require('./productService');

function mapCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    image: row.image,
    productCount: row.product_count === undefined ? undefined : Number(row.product_count),
  };
}

async function listCategories() {
  const rows = await query(
    `SELECT c.id, c.name, c.slug, c.description, c.image,
            COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
     GROUP BY c.id, c.name, c.slug, c.description, c.image
     ORDER BY c.name ASC`
  );
  return rows.map(mapCategory);
}

async function getCategoryById(id) {
  const row = await queryOne(
    `SELECT c.id, c.name, c.slug, c.description, c.image,
            COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
     WHERE c.id = ?
     GROUP BY c.id, c.name, c.slug, c.description, c.image
     LIMIT 1`,
    [id]
  );
  return mapCategory(row);
}

async function getCategoryBySlug(slug) {
  const row = await queryOne(
    `SELECT c.id, c.name, c.slug, c.description, c.image,
            COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
     WHERE c.slug = ?
     GROUP BY c.id, c.name, c.slug, c.description, c.image
     LIMIT 1`,
    [slug]
  );
  return mapCategory(row);
}

async function getCategoryProducts(id, options = {}) {
  const category = await getCategoryById(id);
  if (!category) throw notFound('Category not found');

  const listing = await listProducts({ ...options, categoryId: id });
  return { category, ...listing, items: listing.items.map(mapProduct) };
}

async function countCategories() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM categories');
  return row?.total ?? 0;
}

module.exports = {
  listCategories,
  getCategoryById,
  getCategoryBySlug,
  getCategoryProducts,
  countCategories,
  mapCategory,
};
