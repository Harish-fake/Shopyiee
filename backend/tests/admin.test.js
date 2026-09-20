'use strict';

/**
 * Administration area.
 *
 * Every route here is expected to be reachable only by an account whose
 * `users.role` is ADMIN.  The authorization assertions that specifically probe
 * the mode-dependent gate live in authorization.test.js.
 */

const { newAgent, signIn, withCsrf, closePool } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

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

const adminAgent = () => signedInAgent({ role: 'ADMIN' });

describe('GET /api/admin/stats', () => {
  it('summarises the store for an administrator', async () => {
    const { agent } = await adminAgent();
    const response = await agent.get('/api/admin/stats');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('totalUsers');
    expect(response.body.data).toHaveProperty('totalProducts');
    expect(response.body.data).toHaveProperty('totalOrders');
    expect(response.body.data).toHaveProperty('totalSales');
    expect(response.body.data).toHaveProperty('pendingOrders');
    expect(response.body.data).toHaveProperty('lowStockItems');
    expect(Array.isArray(response.body.data.lowStockItems)).toBe(true);
  });
});

describe('GET /api/admin/orders', () => {
  it('lists orders with pagination', async () => {
    const { agent } = await adminAgent();
    const response = await agent.get('/api/admin/orders?limit=5');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.pagination.limit).toBe(5);
  });

  it('filters by status', async () => {
    const { agent } = await adminAgent();
    const response = await agent.get('/api/admin/orders?status=DELIVERED&limit=50');

    expect(response.status).toBe(200);
    for (const order of response.body.data.items) {
      expect(order.status).toBe('DELIVERED');
    }
  });

  it('rejects an unknown status filter instead of quietly returning everything', async () => {
    const { agent } = await adminAgent();
    const response = await agent.get('/api/admin/orders?status=NOT_A_STATUS');

    // Failing closed matters: silently dropping the filter would show an
    // operator a full order list while they believed it was filtered.
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('treats an empty status filter as no filter', async () => {
    const { agent } = await adminAgent();
    const response = await agent.get('/api/admin/orders?status=&limit=5');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });
});

describe('PUT /api/admin/orders/:id/status', () => {
  it('moves an order through the fulfilment states', async () => {
    const customer = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 600, stock: 4 });

    const placed = await withCsrf(
      customer.agent.post('/api/checkout-secure').send({
        items: [{ productId: product.id, quantity: 1 }],
        shipping: { name: 'Test Shopper', phone: '9000000000', address: '1 Test Lane', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' },
      }),
      token
    );
    const orderId = placed.body.data.order.id;

    const { agent } = await adminAgent();
    const response = await withCsrf(
      agent.put(`/api/admin/orders/${orderId}/status`).send({ status: 'SHIPPED' }),
      token
    );

    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe('SHIPPED');
  });

  it('rejects a status outside the allowed set', async () => {
    const { agent } = await adminAgent();
    const response = await withCsrf(
      agent.put('/api/admin/orders/1/status').send({ status: 'TELEPORTED' }),
      token
    );

    expect(response.status).toBe(400);
  });
});

describe('product administration', () => {
  it('creates, updates and soft-deletes a product', async () => {
    const { agent } = await adminAgent();
    const categoryId = await fixtures.anyCategoryId();
    const name = `${fixtures.PREFIX} Admin Gadget`;

    const created = await withCsrf(
      agent.post('/api/admin/products').send({
        name,
        description: 'Created by the automated administration test.',
        brand: 'ShopSphere Labs',
        price: 2499,
        stock: 12,
        categoryId,
      }),
      token
    );

    expect(created.status).toBe(201);
    const productId = created.body.data.product.id;
    expect(created.body.data.product.slug).toMatch(/^zztest-/);

    const updated = await withCsrf(
      agent.put(`/api/admin/products/${productId}`).send({ price: 1999, stock: 20 }),
      token
    );

    expect(updated.status).toBe(200);
    expect(Number(updated.body.data.product.price)).toBe(1999);
    expect(Number(updated.body.data.product.stock)).toBe(20);

    const removed = await withCsrf(agent.delete(`/api/admin/products/${productId}`), token);
    expect(removed.status).toBe(200);

    // Soft delete: the row survives but disappears from the storefront.
    const storefront = await newAgent().get(`/api/products/${productId}`);
    expect(storefront.status).toBe(404);
  });

  it('requires a name, price and category', async () => {
    const { agent } = await adminAgent();
    const response = await withCsrf(agent.post('/api/admin/products').send({ name: 'Incomplete' }), token);

    expect(response.status).toBe(400);
  });

  it('rejects a negative price', async () => {
    const { agent } = await adminAgent();
    const categoryId = await fixtures.anyCategoryId();

    const response = await withCsrf(
      agent.post('/api/admin/products').send({
        name: `${fixtures.PREFIX} Negative`,
        price: -100,
        categoryId,
      }),
      token
    );

    expect(response.status).toBe(400);
  });

  it('rejects an unknown category', async () => {
    const { agent } = await adminAgent();

    const response = await withCsrf(
      agent.post('/api/admin/products').send({
        name: `${fixtures.PREFIX} Orphan`,
        price: 100,
        categoryId: 99999999,
      }),
      token
    );

    expect(response.status).toBe(400);
  });

  it('lists the catalogue and the low-stock report', async () => {
    const { agent } = await adminAgent();

    const catalogue = await agent.get('/api/admin/products?limit=5');
    expect(catalogue.status).toBe(200);
    expect(catalogue.body.data.items.length).toBeGreaterThan(0);

    const inventory = await agent.get('/api/admin/inventory');
    expect(inventory.status).toBe(200);
    expect(Array.isArray(inventory.body.data.lowStock)).toBe(true);
  });
});

describe('review moderation', () => {
  it('lists reviews and deletes one', async () => {
    const customer = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      customer.agent.post('/api/reviews').send({
        productId: product.id,
        rating: 1,
        comment: 'Moderate me',
      }),
      token
    );
    const reviewId = created.body.data.review.id;

    const { agent } = await adminAgent();
    const listed = await agent.get('/api/admin/reviews?limit=50');
    expect(listed.status).toBe(200);
    expect(listed.body.data.items.some((item) => item.id === reviewId)).toBe(true);

    const removed = await withCsrf(agent.delete(`/api/admin/reviews/${reviewId}`), token);
    expect(removed.status).toBe(200);
  });
});

describe('wallet ledger', () => {
  it('lists transactions for an administrator', async () => {
    const { agent } = await adminAgent();
    const response = await agent.get('/api/admin/transactions?limit=10');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });
});

describe('customer administration', () => {
  it('lists customers without exposing password hashes', async () => {
    const { agent } = await adminAgent();
    const response = await agent.get('/api/admin/users?limit=50');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toMatch(/\$2[aby]\$/);
  });
});
