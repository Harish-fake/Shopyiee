'use strict';

/**
 * Shared test harness.
 *
 * Every suite talks to the running Express application through supertest using
 * a cookie-persisting agent, so sessions, cookies and CSRF behave exactly as
 * they do in a browser.
 *
 * The suite expects a reachable MySQL instance with the schema applied:
 *
 *     npm run db:init
 *     npm test
 */

const request = require('supertest');

const app = require('../../app');
const config = require('../../config/env');
const { closePool } = require('../../config/db');

/** A fresh agent with its own cookie jar. */
function newAgent() {
  return request.agent(app);
}

/**
 * Signs an agent in.
 *
 * The CSRF token is returned as well because state-changing requests must echo
 * it back when the suite runs with APP_MODE=secure.  Outside secure mode the
 * header is ignored, so attaching it unconditionally keeps one code path.
 */
async function signIn(agent, email, password) {
  const response = await agent.post('/api/auth/login').send({ email, password });

  if (response.status !== 200) {
    throw new Error(
      `Sign-in failed for ${email} (${response.status}): ${JSON.stringify(response.body)}`
    );
  }

  let token = response.body?.data?.csrfToken ?? null;

  if (!token) {
    const csrf = await agent.get('/api/auth/csrf');
    token = csrf.body?.data?.csrfToken ?? null;
  }

  return token;
}

/** Attaches the CSRF header when a token is known. */
function withCsrf(builder, token) {
  return token ? builder.set('X-CSRF-Token', token) : builder;
}

/** Pulls the error code out of a failed response. */
function errorCode(response) {
  return response.body?.error?.code ?? null;
}

module.exports = { app, config, newAgent, signIn, withCsrf, errorCode, closePool };
