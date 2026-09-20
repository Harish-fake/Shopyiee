'use strict';

/**
 * Authorization.
 *
 * These assertions hold in every mode: the hardened checks resolve the caller's
 * identity from the server-side session and re-read the role from MySQL, so a
 * client cannot influence them.  The mode-dependent behaviour of the
 * deliberately weak gate is covered in security-behaviour.test.js.
 */

const { newAgent, signIn, withCsrf, closePool } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');
const { query } = require('../config/db');

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

const ADMIN_ROUTES = [
  '/api/admin/stats',
  '/api/admin/users',
  '/api/admin/users-secure',
  '/api/admin/orders',
  '/api/admin/products',
  '/api/admin/reviews',
  '/api/admin/transactions',
  '/api/admin/inventory',
];

describe('the administration area', () => {
  it('is closed to anonymous visitors', async () => {
    for (const path of ADMIN_ROUTES) {
      const response = await newAgent().get(path);
      expect(response.status).toBe(401);
    }
  });

  it('is closed to signed-in customers', async () => {
    const { agent } = await signedInAgent();

    for (const path of ADMIN_ROUTES) {
      const response = await agent.get(path);
      expect(response.status).toBe(403);
    }
  });

  it('is open to an administrator', async () => {
    const { agent } = await signedInAgent({ role: 'ADMIN' });

    for (const path of ADMIN_ROUTES) {
      const response = await agent.get(path);
      expect(response.status).toBe(200);
    }
  });

  it('refuses state-changing admin calls from a customer', async () => {
    const { agent } = await signedInAgent();

    const createProduct = await withCsrf(
      agent.post('/api/admin/products').send({ name: 'Sneaky', price: 1, categoryId: 1 }),
      token
    );
    expect(createProduct.status).toBe(403);

    const setStatus = await withCsrf(
      agent.put('/api/admin/orders/1/status').send({ status: 'DELIVERED' }),
      token
    );
    expect(setStatus.status).toBe(403);

    const deleteReview = await withCsrf(agent.delete('/api/admin/reviews/1'), token);
    expect(deleteReview.status).toBe(403);
  });
});

describe('client-controlled role values', () => {
  it('are ignored by the hardened gate', async () => {
    const { agent } = await signedInAgent();

    const response = await agent
      .get('/api/admin/users-secure')
      .set('Cookie', 'lab_role=admin');

    expect(response.status).toBe(403);
  });

  it('are ignored when supplied as a header or query parameter', async () => {
    const { agent } = await signedInAgent();

    const asHeader = await agent.get('/api/admin/stats').set('X-Role', 'ADMIN');
    expect(asHeader.status).toBe(403);

    const asQuery = await agent.get('/api/admin/stats?role=ADMIN&isAdmin=true');
    expect(asQuery.status).toBe(403);
  });
});

describe('the role is authoritative in the database', () => {
  it('revokes access as soon as the account is demoted', async () => {
    const { agent, user } = await signedInAgent({ role: 'ADMIN' });

    expect((await agent.get('/api/admin/stats')).status).toBe(200);

    await query('UPDATE users SET role = ? WHERE id = ?', ['USER', user.id]);

    // The session cookie is unchanged, but the role no longer grants access.
    expect((await agent.get('/api/admin/stats')).status).toBe(403);
  });

  it('grants access as soon as the account is promoted', async () => {
    const { agent, user } = await signedInAgent({ role: 'USER' });

    expect((await agent.get('/api/admin/stats')).status).toBe(403);

    await query('UPDATE users SET role = ? WHERE id = ?', ['ADMIN', user.id]);

    expect((await agent.get('/api/admin/stats')).status).toBe(200);
  });

  it('drops the session when the account is deactivated', async () => {
    const { agent, user } = await signedInAgent({ role: 'ADMIN' });

    expect((await agent.get('/api/admin/stats')).status).toBe(200);

    await query('UPDATE users SET is_active = 0 WHERE id = ?', [user.id]);

    const after = await agent.get('/api/admin/stats');
    expect(after.status).toBe(401);
  });
});

describe('order ownership', () => {
  it('prevents one customer reading another customer\'s order through the hardened route', async () => {
    const owner = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 700, stock: 5 });

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
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('resource ownership', () => {
  it('scopes cart lines to the owning account', async () => {
    const owner = await signedInAgent();
    const product = await fixtures.createProduct({ stock: 10 });

    const added = await withCsrf(
      owner.agent.post('/api/cart').send({ productId: product.id, quantity: 1 }),
      token
    );
    const lineId = added.body.data.cart.items[0].id;

    const stranger = await signedInAgent();
    expect((await withCsrf(stranger.agent.put(`/api/cart/${lineId}`).send({ quantity: 9 }), token)).status).toBe(404);
    expect((await withCsrf(stranger.agent.delete(`/api/cart/${lineId}`), token)).status).toBe(404);
  });

  it('scopes reviews to their author', async () => {
    const author = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      author.agent.post('/api/reviews').send({ productId: product.id, rating: 4, comment: 'Mine' }),
      token
    );
    const reviewId = created.body.data.review.id;

    const stranger = await signedInAgent();
    expect(
      (await withCsrf(stranger.agent.put(`/api/reviews/${reviewId}`).send({ rating: 1, comment: 'Yours no more' }), token))
        .status
    ).toBe(403);
    expect((await withCsrf(stranger.agent.delete(`/api/reviews/${reviewId}`), token)).status).toBe(403);
  });

  it('scopes wallet balances to the owning account', async () => {
    const first = await signedInAgent({ balance: 12345 });
    const second = await signedInAgent({ balance: 67890 });

    const firstWallet = await first.agent.get('/api/wallet');
    const secondWallet = await second.agent.get('/api/wallet');

    expect(Number(firstWallet.body.data.balance)).toBeCloseTo(12345, 2);
    expect(Number(secondWallet.body.data.balance)).toBeCloseTo(67890, 2);
  });
});
