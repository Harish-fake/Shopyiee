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
const { forbidden } = require('./utils/errors');
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
// The restrictive policy below is documented in docs/security-testing.md.
// ENABLE_SECURITY_HEADERS=false removes these headers entirely for the
// deliberately vulnerable sandbox that render.yaml deploys, where an
// ordinary-looking, header-free API is the point.
if (config.security.enableSecurityHeaders) {
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
}

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

      /*
       * A rejected origin is a configuration mistake, not a server fault, so it
       * is answered as a deliberate 403 rather than by throwing.  Throwing here
       * produced a 500 "Something went wrong", which is misleading in two ways:
       * it tells the operator the application is broken when only
       * FRONTEND_ORIGIN is wrong, and it fills the error log with what looks
       * like a crash on every request from the browser.
       */
      logger.warn('Request refused: origin is not in the CORS allow-list', {
        origin,
        allowed: config.frontendOrigin,
      });

      return callback(
        forbidden(
          'This origin is not allowed to call the API. ' +
            'Check the FRONTEND_ORIGIN setting on the server.'
        )
      );
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
      sameSite: config.security.cookieSameSite,
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
