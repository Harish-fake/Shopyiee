'use strict';

/**
 * Behaviour of the deliberately weak implementations versus their hardened
 * counterparts.
 *
 * The suite runs in both modes and asserts the outcome that the active mode is
 * supposed to produce, so the same file documents both behaviours:
 *
 *     npm test            -> APP_MODE=development, the weak paths are live
 *     npm run test:secure -> APP_MODE=secure, only the hardened paths are used
 *
 * Every assertion is read-only or creates a record that is removed again in
 * afterAll.  Nothing here is destructive: no DROP, no TRUNCATE, no DELETE of
 * pre-existing rows, and no attempt to reach anything outside the application.
 */

const { newAgent, signIn, withCsrf, closePool, config } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

const weakPathsLive = !config.isSecureMode;

let token;

afterAll(async () => {
  await fixtures.cleanup();
  await closePool();
});

async function signedInAgent(options = {}) {
  const user = await fixtures.createUser(options);
  const agent = newAgent();
  token = await signIn(agent, user.email, user.password);
  return { agent, user };
}

// ---------------------------------------------------------------------------
// 1. SQL injection in catalogue search
// ---------------------------------------------------------------------------
describe('catalogue search: SQL injection', () => {
  const BOOLEAN_PAYLOAD = "' OR '1'='1";

  it('lets a boolean payload change the meaning of the WHERE clause when the weak path is live', async () => {
    const response = await newAgent().get(
      `/api/products/search?q=${encodeURIComponent(BOOLEAN_PAYLOAD)}&limit=60`
    );

    expect(response.status).toBe(200);

    if (weakPathsLive) {
      // The clause becomes `... LIKE '%' OR '1'='1%' ...`, which matches every
      // active product rather than the ones containing the search term.
      expect(response.body.data.items.length).toBeGreaterThan(40);
    } else {
      // APP_MODE=secure routes /search through the parameterised implementation.
      expect(response.body.data.items).toHaveLength(0);
    }
  });

  it('never lets the same payload through the parameterised endpoint', async () => {
    const response = await newAgent().get(
      `/api/products/search-safe?q=${encodeURIComponent(BOOLEAN_PAYLOAD)}&limit=60`
    );

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
  });

  it('surfaces a database error for a malformed quote only on the weak path', async () => {
    const response = await newAgent().get(`/api/products/search?q=${encodeURIComponent("'")}`);

    if (weakPathsLive) {
      // The value reaches the parser and the statement fails.
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      // The driver message quotes the offending SQL, so it must stay in the
      // server log rather than travelling back to the client.
      expect(response.body.error.message).toBe('Something went wrong. Please try again.');
      expect(JSON.stringify(response.body)).not.toMatch(/SELECT|LIKE|FROM|ORDER BY|node_modules|\.js:/i);
    } else {
      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(0);
    }
  });

  it('rejects destructive keywords instead of executing them, and keeps serving', async () => {
    const attempt = await newAgent().get(
      `/api/products/search?q=${encodeURIComponent('x; DROP TABLE users')}`
    );

    if (weakPathsLive) {
      // The keyword denylist is the safety rail around the injectable statement.
      expect(attempt.status).toBe(400);
      expect(attempt.body.error.code).toBe('BAD_REQUEST');
    } else {
      // Parameterised: the whole string is simply a search term that matches
      // nothing, and no statement is ever executed from it.
      expect(attempt.status).toBe(200);
      expect(attempt.body.data.items).toHaveLength(0);
    }

    // Either way the API and its data are intact.
    const health = await newAgent().get('/api/health');
    expect(health.status).toBe(200);

    const stillThere = await newAgent().get('/api/products?limit=1');
    expect(stillThere.body.data.items.length).toBeGreaterThan(0);
  });

  it('never reaches another schema', async () => {
    const attempt = await newAgent().get(
      `/api/products/search?q=${encodeURIComponent('information_schema.tables')}`
    );

    if (weakPathsLive) {
      expect(attempt.status).toBe(400);
      expect(attempt.body.error.code).toBe('BAD_REQUEST');
    } else {
      expect(attempt.status).toBe(200);
      expect(attempt.body.data.items).toHaveLength(0);
    }
  });

  it('treats a LIKE wildcard as a literal character only on the hardened endpoint', async () => {
    const weak = await newAgent().get('/api/products/search?q=%25&limit=60');
    const safe = await newAgent().get('/api/products/search-safe?q=%25&limit=60');

    expect(weak.status).toBe(200);
    expect(safe.status).toBe(200);

    if (weakPathsLive) {
      // The unescaped '%' widens the pattern to the whole catalogue.
      expect(weak.body.data.items.length).toBeGreaterThan(40);
    }

    // The escaped version can only match text that really contains a '%'.
    expect(safe.body.data.items.length).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// 2. Reflected cross-site scripting in the search echo
// ---------------------------------------------------------------------------
describe('search echo: reflected XSS', () => {
  const PAYLOAD = '<img src=x onerror=alert(1)>';

  it('echoes the search term unencoded when the weak path is live', async () => {
    const response = await newAgent().get(
      `/api/products/search?q=${encodeURIComponent(PAYLOAD)}`
    );

    expect(response.status).toBe(200);

    if (weakPathsLive) {
      expect(response.body.data.query).toBe(PAYLOAD);
    } else {
      expect(response.body.data.query).not.toContain('<img');
      expect(response.body.data.query).toContain('&lt;img');
    }
  });

  it('always encodes the echo on the parameterised endpoint', async () => {
    const response = await newAgent().get(
      `/api/products/search-safe?q=${encodeURIComponent(PAYLOAD)}`
    );

    expect(response.status).toBe(200);
    expect(response.body.data.query).not.toContain('<img');
    expect(response.body.data.query).toContain('&lt;img');
  });
});

// ---------------------------------------------------------------------------
// 3. Stored cross-site scripting through product reviews
// ---------------------------------------------------------------------------
describe('review rendering: stored XSS', () => {
  const PAYLOAD = '<img src=x onerror=alert(1)>';

  it('stores the markup verbatim when the weak path is live, and sanitises it otherwise', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      agent.post('/api/reviews').send({ productId: product.id, rating: 5, comment: PAYLOAD }),
      token
    );

    expect(created.status).toBe(201);

    const rendered = created.body.data.review.commentHtml;

    if (weakPathsLive) {
      // Rendered through dangerouslySetInnerHTML in the storefront, so the
      // handler fires for every visitor who opens the product page.
      expect(rendered).toBe(PAYLOAD);
      expect(rendered).toContain('onerror=');
    } else {
      expect(rendered).not.toContain('<img');
      expect(rendered).not.toContain('onerror=');
    }
  });

  it('escapes the markup on the public review listing in secure mode', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    await withCsrf(
      agent.post('/api/reviews').send({ productId: product.id, rating: 5, comment: PAYLOAD }),
      token
    );

    const listing = await newAgent().get(`/api/reviews/product/${product.id}`);
    const rendered = listing.body.data.items[0].commentHtml;

    if (weakPathsLive) {
      expect(rendered).toBe(PAYLOAD);
    } else {
      expect(rendered).not.toContain('<img');
    }
  });

  it('keeps a benign formatting tag usable when the secure renderer is active', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      agent.post('/api/reviews').send({
        productId: product.id,
        rating: 4,
        comment: 'Great value <b>and</b> quick delivery.',
      }),
      token
    );

    expect(created.status).toBe(201);
    expect(created.body.data.review.commentHtml).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. Price tampering at checkout
// ---------------------------------------------------------------------------
describe('checkout: price tampering', () => {
  it('ignores a client-supplied price and total on the hardened route', async () => {
    const { agent, user } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 1799, stock: 5 });
    const balanceBefore = await fixtures.balanceOf(user.id);

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({
        items: [{ productId: product.id, quantity: 1, price: 1 }],
        total: 1,
        shippingFee: 0,
        shipping: {
          name: 'Test Shopper',
          phone: '9000000000',
          address: '1 Test Lane',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      }),
      token
    );

    expect(response.status).toBe(201);

    const { order } = response.body.data;
    expect(Number(order.subtotal)).toBe(1799);
    expect(Number(order.total)).toBe(1799 + Number(order.shippingFee));
    expect(Number(order.total)).not.toBe(1);

    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(balanceBefore - Number(order.total), 2);
  });

  it('lets the client dictate the amount when the weak path is live', async () => {
    const { agent, user } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 1799, stock: 5 });
    const balanceBefore = await fixtures.balanceOf(user.id);

    const response = await withCsrf(
      agent.post('/api/checkout').send({
        items: [{ productId: product.id, quantity: 1, price: 1 }],
        total: 1,
        shipping: {
          name: 'Test Shopper',
          phone: '9000000000',
          address: '1 Test Lane',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      }),
      token
    );

    expect(response.status).toBe(201);

    const { order } = response.body.data;

    if (weakPathsLive) {
      // The wallet is debited the amount the browser asked for.
      expect(Number(order.total)).toBe(1);
      expect(await fixtures.balanceOf(user.id)).toBeCloseTo(balanceBefore - 1, 2);
    } else {
      // APP_MODE=secure: /checkout prices from MySQL like /checkout-secure.
      expect(Number(order.total)).toBe(1799 + Number(order.shippingFee));
      expect(await fixtures.balanceOf(user.id)).toBeCloseTo(balanceBefore - Number(order.total), 2);
    }
  });

  it('never debits more than the order is worth on the hardened route', async () => {
    const { agent, user } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 250, stock: 4 });
    const balanceBefore = await fixtures.balanceOf(user.id);

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({
        items: [{ productId: product.id, quantity: 2, price: 999999 }],
        total: 999999,
        shipping: {
          name: 'Test Shopper',
          phone: '9000000000',
          address: '1 Test Lane',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      }),
      token
    );

    expect(response.status).toBe(201);
    const expected = 500 + Number(response.body.data.order.shippingFee);
    expect(Number(response.body.data.order.total)).toBe(expected);
    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(balanceBefore - expected, 2);
  });
});

// ---------------------------------------------------------------------------
// 5. Client-controlled role cookie
// ---------------------------------------------------------------------------
describe('administrator gate: client-controlled role cookie', () => {
  it('is refused for a customer on the hardened endpoint in every mode', async () => {
    const { agent } = await signedInAgent();

    const response = await agent
      .get('/api/admin/users-secure')
      .set('Cookie', 'lab_role=admin');

    expect(response.status).toBe(403);
  });

  it('is honoured by the mode-dependent gate only while the weak path is live', async () => {
    const { agent } = await signedInAgent();

    const withoutCookie = await agent.get('/api/admin/users');
    expect(withoutCookie.status).toBe(403);

    const withCookie = await agent.get('/api/admin/users').set('Cookie', 'lab_role=admin');

    if (weakPathsLive) {
      expect(withCookie.status).toBe(200);
      expect(withCookie.body.data.items.length).toBeGreaterThan(0);
      // The same response a real administrator receives.
      expect(withCookie.body.data.items[0]).toHaveProperty('email');
    } else {
      expect(withCookie.status).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Direct object reference on order retrieval
// ---------------------------------------------------------------------------
describe('order retrieval: direct object reference', () => {
  it('is scoped to the caller on the hardened route in every mode', async () => {
    const owner = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 800, stock: 5 });

    const placed = await withCsrf(
      owner.agent.post('/api/checkout-secure').send({
        items: [{ productId: product.id, quantity: 1 }],
        shipping: {
          name: 'Test Shopper',
          phone: '9000000000',
          address: '1 Test Lane',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      }),
      token
    );
    const orderId = placed.body.data.order.id;

    const stranger = await signedInAgent();
    const response = await stranger.agent.get(`/api/orders/${orderId}/secure`);

    expect(response.status).toBe(404);
  });

  it('leaks another customer\'s order through the standard route only while the weak path is live', async () => {
    const owner = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 800, stock: 5 });

    const placed = await withCsrf(
      owner.agent.post('/api/checkout-secure').send({
        items: [{ productId: product.id, quantity: 1 }],
        shipping: {
          name: 'Test Shopper',
          phone: '9000000000',
          address: '1 Test Lane',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      }),
      token
    );
    const order = placed.body.data.order;

    const stranger = await signedInAgent();
    const response = await stranger.agent.get(`/api/orders/${order.id}`);

    if (weakPathsLive) {
      expect(response.status).toBe(200);
      expect(response.body.data.order.orderNumber).toBe(order.orderNumber);
      expect(response.body.data.order.userId).toBe(owner.user.id);
    } else {
      expect(response.status).toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Response hygiene
// ---------------------------------------------------------------------------
describe('response hygiene', () => {
  it('never leaks configuration or stack traces from a rejected request', async () => {
    const response = await newAgent().get('/api/products?limit=not-a-number');

    expect(response.status).toBe(400);
    const serialised = JSON.stringify(response.body);
    expect(serialised).not.toMatch(/DB_PASSWORD|SESSION_SECRET|mysql:\/\//i);
    expect(serialised).not.toMatch(/node_modules|\.js:\d+/);
  });

  it('does not advertise the framework', async () => {
    const response = await newAgent().get('/api/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('sets the security headers the hardened configuration relies on', async () => {
    const response = await newAgent().get('/api/health');

    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });
});
