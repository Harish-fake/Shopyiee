'use strict';

/**
 * Fixture factory.
 *
 * Every record a suite creates is tagged with a unique `zztest-` prefix and
 * registered for cleanup, so the sample catalogue that ships in seed.sql is
 * never mutated and the suites can be run repeatedly.
 *
 * Nothing here drops, truncates or otherwise destroys existing data - the only
 * rows removed are the ones this module created.
 */

const bcrypt = require('bcryptjs');

const { query } = require('../../config/db');

const PREFIX = 'zztest';

let sequence = 0;
let cachedCategoryId = null;

const created = { users: new Set(), products: new Set() };

function uniqueToken(label) {
  sequence += 1;
  return `${PREFIX}-${Date.now().toString(36)}-${sequence}-${label}`;
}

/** The catalogue needs at least one category before fixtures can be created. */
async function anyCategoryId() {
  if (cachedCategoryId === null) {
    const rows = await query('SELECT id FROM categories ORDER BY id LIMIT 1');
    if (!rows.length) {
      throw new Error('No categories found. Apply the schema and seed first: npm run db:init');
    }
    cachedCategoryId = rows[0].id;
  }
  return cachedCategoryId;
}

/**
 * Creates a throwaway account.
 *
 * @param {object}  options
 * @param {'USER'|'ADMIN'} options.role
 * @param {number}  options.balance  Simulated wallet balance.
 * @param {boolean} options.active   Set false to model a disabled account.
 */
async function createUser({
  role = 'USER',
  balance = 100000,
  password = 'TestPass#2024',
  name = 'Test Shopper',
  active = true,
} = {}) {
  const email = `${uniqueToken('user')}@shopsphere.test`;

  // A low bcrypt cost keeps the suite quick; production hashing is unchanged.
  const hash = bcrypt.hashSync(password, 4);

  const result = await query(
    `INSERT INTO users
       (name, email, password_hash, role, wallet_balance, phone,
        address_line, city, state, postal_code, is_active)
     VALUES (?, ?, ?, ?, ?, '9000000000', '1 Test Lane', 'Bengaluru', 'Karnataka', '560001', ?)`,
    [name, email, hash, role, balance, active ? 1 : 0]
  );

  created.users.add(result.insertId);

  return { id: result.insertId, email, password, role, name };
}

/** Creates a throwaway catalogue item. */
async function createProduct({ price = 1000, stock = 25, name = 'Test Widget', categoryId } = {}) {
  const slug = uniqueToken('product');
  const category = categoryId ?? (await anyCategoryId());

  const result = await query(
    `INSERT INTO products
       (name, slug, description, brand, price, original_price, stock,
        category_id, image, rating, review_count, is_featured, is_active)
     VALUES (?, ?, 'Fixture product created by the automated test suite.',
             'ShopSphere Labs', ?, ?, ?, ?, '/images/products/placeholder.svg', 0, 0, 0, 1)`,
    [name, slug, price, price, stock, category]
  );

  created.products.add(result.insertId);

  return { id: result.insertId, slug, price, stock, name, categoryId: category };
}

/** Current simulated wallet balance. */
async function balanceOf(userId) {
  const rows = await query('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
  return Number.parseFloat(rows[0]?.wallet_balance ?? 0);
}

/** Current stock level. */
async function stockOf(productId) {
  const rows = await query('SELECT stock FROM products WHERE id = ?', [productId]);
  return rows.length ? rows[0].stock : null;
}

/**
 * Removes everything this module created.
 *
 * Rows are matched by the `zztest-` prefix, which also covers accounts created
 * through `POST /api/auth/register` during a suite.  Nothing that ships in
 * seed.sql can match, so the sample catalogue is never touched.  Safe to call
 * more than once.
 */
async function cleanup() {
  for (const id of created.products) {
    await query('DELETE FROM products WHERE id = ?', [id]);
  }
  for (const id of created.users) {
    await query('DELETE FROM users WHERE id = ?', [id]);
  }

  // Belt and braces for records created by the API rather than this module.
  await query('DELETE FROM products WHERE slug LIKE ?', [`${PREFIX}-%`]);
  await query('DELETE FROM users WHERE email LIKE ?', [`${PREFIX}-%`]);

  created.products.clear();
  created.users.clear();
}

module.exports = {
  PREFIX,
  createUser,
  createProduct,
  anyCategoryId,
  balanceOf,
  stockOf,
  cleanup,
};
