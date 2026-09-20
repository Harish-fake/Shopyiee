'use strict';

/**
 * Route smoke test.
 *
 * Every route the application registers is discovered by walking Express's own
 * router stack rather than from a hand-maintained list, so a new endpoint is
 * covered the moment it is mounted and this suite can never silently fall
 * behind the code.
 *
 * Each route is then called once per role - anonymous, customer, administrator.
 * The assertion is deliberately narrow: the response must not be a 5xx and must
 * be a well-formed JSON envelope.  That is the whole point of this suite - it
 * answers "does anything crash or return something a client cannot parse?"
 *
 * What it does NOT do is check business behaviour; the twelve behavioural
 * suites cover that.  Keeping the two concerns apart is what lets this file
 * sweep the entire surface without needing a valid payload for every route.
 *
 * Side effects: none.  Path parameters are substituted with an id that does not
 * exist, and request bodies are deliberately incomplete so validation rejects
 * them before any row is written.
 */

const { app, newAgent, signIn, withCsrf, closePool } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

/** An id that is guaranteed not to exist, so writes always target nothing. */
const MISSING_ID = 999999;

/** Incomplete on purpose - validation rejects it, so nothing is ever created. */
const INCOMPLETE_BODY = {};

/** Joins a mount prefix and a route path without doubling separators. */
function joinPath(prefix, path) {
  const full = `${prefix}${path}`.replace(/\/{2,}/g, '/');
  return full.length > 1 && full.endsWith('/') ? full.slice(0, -1) : full;
}

/**
 * Reads the route table out of the live application.
 *
 * `layer.route` marks a concrete endpoint; a nested router is identified by a
 * `router` layer whose handler carries its own stack.  The mount path is
 * recovered from the layer's regular expression, which is the only place
 * Express records it.
 */
function registeredRoutes() {
  const routes = [];

  function walk(stack, prefix) {
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
        for (const method of methods) {
          routes.push({ method: method.toUpperCase(), path: joinPath(prefix, layer.route.path) });
        }
        continue;
      }

      if (layer.name === 'router' && layer.handle?.stack) {
        let mount = '';
        const source = layer.regexp?.source ?? '';

        if (source && source !== '^\\/?$' && source !== '^\\/?(?=\\/|$)') {
          mount = source
            .replace(/^\^\\\//, '/')
            .replace(/\\\/\?\(\?=\\\/\|\$\)\??$/, '')
            .replace(/\\\//g, '/')
            .replace(/\$$/, '');
        }

        walk(layer.handle.stack, joinPath(prefix, mount));
      }
    }
  }

  walk(app._router.stack, '');
  return routes;
}

const ROUTES = registeredRoutes();

/**
 * Routes that end the session they are called with.
 *
 * These are swept last.  `POST /api/auth/logout` succeeds unconditionally, so
 * calling it mid-sweep would leave every subsequent route answering 401 - the
 * statuses would still be "not a 5xx" and the suite would still pass, but it
 * would stop exercising authorization and could hide a real regression behind
 * a wall of 401s.
 */
const SESSION_ENDING = new Set(['POST /api/auth/logout']);

ROUTES.sort((a, b) => {
  const rank = (r) => (SESSION_ENDING.has(`${r.method} ${r.path}`) ? 1 : 0);
  return rank(a) - rank(b);
});

/** Swaps every `:param` for an id that cannot exist. */
function materialise(path) {
  return path.replace(/:[A-Za-z0-9_]+/g, String(MISSING_ID));
}

const HAS_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Issues one request and returns the observed status. */
async function probe(agent, route, csrfToken) {
  const url = materialise(route.path);

  let builder = agent[route.method.toLowerCase()](url);

  if (HAS_BODY.has(route.method)) {
    builder = builder.send(INCOMPLETE_BODY);
  }

  builder = withCsrf(builder, csrfToken);

  const response = await builder;

  // The contract every client relies on.
  expect(typeof response.body).toBe('object');
  expect(response.body).not.toBeNull();
  expect(typeof response.body.success).toBe('boolean');
  expect(response.status).toBeLessThan(500);

  return response.status;
}

/** Probes every route with one agent and fails loudly if anything 5xx's. */
async function sweepAll(agent, who, csrfToken) {
  const statuses = new Map();
  const failures = [];

  for (const route of ROUTES) {
    const label = `${route.method} ${materialise(route.path)}`;

    try {
      const status = await probe(agent, route, csrfToken);
      statuses.set(status, (statuses.get(status) ?? 0) + 1);
    } catch (error) {
      failures.push(`${label} -> ${error.message.split('\n')[0]}`);
    }
  }

  if (failures.length) {
    throw new Error(
      `${failures.length} route(s) did not behave for ${who}:\n  ${failures.join('\n  ')}`
    );
  }

  const summary = [...statuses.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([status, count]) => `${status}×${count}`)
    .join('  ');

  // eslint-disable-next-line no-console
  console.log(`    ${who.padEnd(14)} ${summary}`);

  return statuses;
}

afterAll(async () => {
  await fixtures.cleanup();
  await closePool();
});

describe('route coverage', () => {
  it('discovers the full route table', () => {
    // Guards the walker itself: if the stack shape ever changes and this
    // returns nothing, every assertion below would pass vacuously.
    expect(ROUTES.length).toBeGreaterThanOrEqual(50);

    const paths = ROUTES.map((r) => r.path);
    expect(paths).toContain('/api/health');
    expect(paths).toContain('/api/products/search');
    expect(paths).toContain('/api/checkout');
    expect(paths).toContain('/api/admin/users');
  });

  it('never 5xxs for an anonymous visitor', async () => {
    const statuses = await sweepAll(newAgent(), 'anonymous', null);

    // The sweep has to be doing real work: a healthy number of public routes
    // answer, and the protected ones turn the visitor away rather than
    // accidentally serving them.
    expect(statuses.get(200) ?? 0).toBeGreaterThanOrEqual(10);
    expect(statuses.get(401) ?? 0).toBeGreaterThanOrEqual(20);
  });

  it('never 5xxs for a signed-in customer', async () => {
    const user = await fixtures.createUser({ role: 'USER' });
    const agent = newAgent();
    const token = await signIn(agent, user.email, user.password);

    const statuses = await sweepAll(agent, 'customer', token);

    expect(statuses.get(200) ?? 0).toBeGreaterThanOrEqual(18);

    // Every administrator route must refuse a plain customer.  This is the
    // assertion that would catch a broken authorization check.
    expect(statuses.get(403) ?? 0).toBeGreaterThanOrEqual(10);
  });

  it('never 5xxs for an administrator', async () => {
    const admin = await fixtures.createUser({ role: 'ADMIN' });
    const agent = newAgent();
    const token = await signIn(agent, admin.email, admin.password);

    const statuses = await sweepAll(agent, 'administrator', token);

    expect(statuses.get(200) ?? 0).toBeGreaterThanOrEqual(25);

    // An administrator is never turned away for who they are.  Anything here
    // means either the session was lost or a role check is inverted.
    expect(statuses.get(401) ?? 0).toBe(0);
    expect(statuses.get(403) ?? 0).toBe(0);
  });

  it('rejects every write from an anonymous visitor', async () => {
    const agent = newAgent();
    const writes = ROUTES.filter((r) => r.method !== 'GET' && r.path.startsWith('/api/'));

    expect(writes.length).toBeGreaterThan(10);

    for (const route of writes) {
      // Signing out is the one write that is deliberately open and idempotent:
      // it must succeed when there is no session to end, and it must not reveal
      // whether one existed.  Every other write needs a session.
      if (route.path === '/api/auth/logout') continue;

      const response = await agent[route.method.toLowerCase()](materialise(route.path)).send(
        INCOMPLETE_BODY
      );

      // Validation errors (400) and "sign in first" (401) are both acceptable;
      // a 2xx is not.
      expect([400, 401, 403, 404, 422]).toContain(response.status);
    }
  });
});
