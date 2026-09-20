'use strict';

/**
 * Database bootstrap.
 *
 *   npm run db:init              apply schema.sql, grants.sql and seed.sql
 *   npm run db:init -- --managed skip grants.sql (the host creates the account)
 *   npm run db:reset             drop everything and reload the sample data
 *                      (idempotent - a populated database is left alone)
 *   npm run db:reset   drop and recreate every table, then reload the sample
 *                      data set
 *
 * The application itself connects as the restricted `shop_app` account, which
 * only holds SELECT/INSERT/UPDATE/DELETE.  Creating tables therefore needs an
 * account with DDL rights, supplied through the admin credentials below.
 *
 *   DB_ADMIN_USER      default: root
 *   DB_ADMIN_PASSWORD  default: DB_ROOT_PASSWORD
 *
 * This script opens its connection with `multipleStatements` enabled because it
 * executes two whole .sql files.  The application pool deliberately does not.
 */

const fs = require('node:fs');
const path = require('node:path');

const mysql = require('mysql2/promise');
const { escape: sqlEscape } = require('mysql2');

const config = require('../config/env');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_FILE = path.join(REPO_ROOT, 'database', 'schema.sql');
const SEED_FILE = path.join(REPO_ROOT, 'database', 'seed.sql');
const GRANTS_FILE = path.join(REPO_ROOT, 'database', 'grants.sql');

/** The literal that grants.sql ships with for the application account. */
const PASSWORD_PLACEHOLDER = "'change_me_app_password'";

const flags = new Set(process.argv.slice(2));
const reset = flags.has('--reset');
const schemaOnly = flags.has('--schema-only');
const seedOnly = flags.has('--seed-only');

/**
 * Set on hosts where the database account is created by the provider rather
 * than by us.  Skips database/grants.sql and the ALTER USER that follows it,
 * both of which a managed MySQL service refuses.  See docs/deployment.md.
 */
const managed = flags.has('--managed');

function readSqlFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function tableExists(connection, database, table) {
  const [rows] = await connection.query(
    'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [database, table]
  );
  return rows[0].total > 0;
}

async function rowCount(connection, database, table) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${database}\`.\`${table}\``);
  return rows[0].total;
}

async function main() {
  const database = config.db.database;
  const adminUser = process.env.DB_ADMIN_USER || 'root';
  const adminPassword = process.env.DB_ADMIN_PASSWORD ?? process.env.DB_ROOT_PASSWORD ?? '';

  log(`ShopSphere database bootstrap`);
  log(`  target   ${config.db.host}:${config.db.port}/${database}`);
  log(`  admin    ${adminUser}`);
  log(`  mode     ${reset ? 'reset (drop and reload)' : 'init (idempotent)'}`);

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: adminUser,
    password: adminPassword,
    ssl: config.db.ssl,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
  });

  try {
    const hasSchema = await tableExists(connection, database, 'products');
    const productCount = hasSchema ? await rowCount(connection, database, 'products') : 0;

    const applySchema = reset || !hasSchema || schemaOnly;
    const applySeed = !schemaOnly && (reset || !hasSchema || productCount === 0);

    if (!applySchema && !applySeed) {
      log(`\nNothing to do - ${database} already holds ${productCount} product(s).`);
      log(`Use "npm run db:reset" to drop everything and reload the sample data.`);
      return;
    }

    if (applySchema) {
      log('\n[1/3] applying database/schema.sql');
      await connection.query(readSqlFile(SCHEMA_FILE));
      log('      tables created');
    } else {
      log('\n[1/3] schema already present, skipping');
    }

    /*
     * Creating the application account is only possible where we administer the
     * server.  Managed providers (Aiven, PlanetScale, ...) create the account
     * for you and reject CREATE USER and GRANT, so `--managed` skips this step
     * and the ALTER USER below.
     */
    if (managed) {
      log('[2/3] managed host - the provider creates the database account, skipping');
    } else if (applySchema) {
      log('[2/3] applying database/grants.sql');
      const grantsSql = readSqlFile(GRANTS_FILE)
        // Bind the application account to the configured password.
        .split(PASSWORD_PLACEHOLDER)
        .join(sqlEscape(config.db.password));

      await connection.query(grantsSql);
      log('      application account configured');
    } else {
      log('[2/3] application account already configured, skipping');
    }

    if (applySeed) {
      log('[3/3] applying database/seed.sql');
      await connection.query(readSqlFile(SEED_FILE));
      log('      sample catalogue loaded');
    } else {
      log('[3/3] sample data already present, skipping');
    }

    // Make sure the application account can actually reach the data.  Not
    // permitted on a managed host, where the provider owns the account.
    if (!managed) {
      await connection.query(
        `ALTER USER '${config.db.user}'@'%' IDENTIFIED BY ${sqlEscape(config.db.password)}`
      );
      await connection.query(`FLUSH PRIVILEGES`);
    }

    const summary = [];
    for (const table of ['users', 'categories', 'products', 'orders', 'order_items', 'reviews', 'wishlist', 'transactions']) {
      summary.push(`${table}=${await rowCount(connection, database, table)}`);
    }

    log(`\nDone. ${summary.join('  ')}`);
    log(`\nDemo accounts`);
    log(`  administrator  ${process.env.SEED_ADMIN_EMAIL || 'admin@shopsphere.test'}`);
    log(`  customer       ${process.env.SEED_USER_EMAIL || 'priya@example.test'}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  process.stderr.write(`\ndb:init failed - ${error.message}\n`);
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    process.stderr.write('Set DB_ADMIN_USER / DB_ADMIN_PASSWORD to an account with DDL rights.\n');
  }
  process.exit(1);
});
