'use strict';

/**
 * Express application assembly.
 *
 * The middleware order matters: security headers and parsers first, then the
 * session, then the identity loader, then throttling, then the routes.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const config = require('./config/env');
const logger = require('./utils/logger');
const MysqlSessionStore = require('./database/sessionStore');
const { attachUser } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes');

const app = express();

if (config.security.trustProxy) {
  // Required for correct client IPs and secure cookies behind a reverse proxy.
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(
  helmet({
    // The API only ever returns JSON, so a restrictive policy is appropriate.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    // Nothing should ever frame the API.  Helmet defaults to SAMEORIGIN; be
    // explicit so the legacy header matches the `frame-ancestors` directive.
    frameguard: { action: 'deny' },
    hsts: config.security.cookieSecure ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (curl, Postman, ZAP, server-to-server)
      // are always allowed.
      if (!origin) return callback(null, true);
      if (origin === config.frontendOrigin) return callback(null, true);
      // Outside secure mode, accept any origin so that local tooling works.
      if (!config.isSecureMode) return callback(null, true);
      return callback(new Error('Origin not permitted by the CORS policy'));
    },
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Request logging
// ---------------------------------------------------------------------------
if (config.logging.httpFormat !== 'none' && config.nodeEnv !== 'test') {
  app.use(
    morgan(config.logging.httpFormat, {
      skip: (req) => req.path === '/api/health',
    })
  );
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
app.use(
  session({
    name: config.session.name,
    secret: config.session.secret,
    store: new MysqlSessionStore({ ttlMs: config.session.maxAgeMs }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.security.cookieSecure,
      maxAge: config.session.maxAgeMs,
      path: '/',
    },
  })
);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
app.use(attachUser);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api', apiLimiter, apiRoutes);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'ShopSphere API',
      documentation: '/api/health',
    },
  });
});

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

logger.debug('Express application assembled', { appMode: config.appMode });

module.exports = app;
