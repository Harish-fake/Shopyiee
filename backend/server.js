'use strict';

/**
 * Application entry point.
 *
 * Verifies database connectivity before accepting traffic, then starts the HTTP
 * listener and installs shutdown handlers so in-flight requests are allowed to
 * finish and the connection pool is closed cleanly.
 */

const app = require('./app');
const config = require('./config/env');
const { checkConnection, closePool } = require('./config/db');
const logger = require('./utils/logger');

let server;

async function start() {
  let database;

  try {
    database = await checkConnection();
  } catch (error) {
    logger.error('Unable to reach the database - the API will not start', {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      message: error.message,
    });
    process.exit(1);
  }

  logger.info('Database connection established', {
    database: database.db,
    server: database.version,
  });

  server = app.listen(config.port, () => {
    const lines = [
      '',
      '  ShopSphere API',
      `  mode          : ${config.appMode}`,
      `  listening on  : http://localhost:${config.port}`,
      `  storefront    : ${config.frontendOrigin}`,
      `  database      : ${config.db.database} @ ${config.db.host}:${config.db.port}`,
      `  csrf          : ${config.security.enableCsrf ? (config.isSecureMode ? 'enforced' : 'available') : 'disabled'}`,
      `  rate limiting : ${config.security.enableRateLimit ? 'enabled' : 'disabled'}`,
      '',
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use`, { port: config.port });
    } else {
      logger.error('HTTP server error', { message: error.message });
    }
    process.exit(1);
  });
}

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  try {
    await closePool();
  } catch (error) {
    logger.warn('Error while closing the database pool', { message: error.message });
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message });
  process.exit(1);
});

start();
