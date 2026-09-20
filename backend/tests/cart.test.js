'use strict';

/** Database-backed cart: adding, updating, removing and server-side totals. */

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

describe('GET /api/cart', () => {
  it('starts empty for a new account', async () => {
    const { agent } = await signedInAgent();
    const response = await agent.get('/api/cart');

    expect(response.status).toBe(200);
    expect(response.body.data.cart.items).toHaveLength(0);
    expect(Number(response.body.data.cart.subtotal)).toBe(0);
    expect(Number(response.body.data.cart.total)).toBe(0);
  });

  it('refuses anonymous access', async () => {
    const response = await newAgent().get('/api/cart');
    expect(response.status).toBe(401);
  });
});

describe('POST /api/cart', () => {
  it('adds a product and prices the line from the catalogue', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ price: 1500, stock: 10 });

    const response = await withCsrf(agent.post('/api/cart').send({ productId: product.id, quantity: 2 }), token);

    expect(response.status).toBe(201);
    const { cart } = response.body.data;
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(product.id);
    expect(cart.items[0].quantity).toBe(2);
    // The unit price comes from MySQL, never from the request body.
    expect(Number(cart.items[0].unitPrice)).toBe(1500);
    expect(Number(cart.items[0].lineTotal)).toBe(3000);
    expect(Number(cart.subtotal)).toBe(3000);
    expect(Number(cart.total)).toBe(3000 + Number(cart.shippingFee));
  });

  it('adds shipping below the free-delivery threshold and waives it above', async () => {
    const { agent } = await signedInAgent();
    const cheap = await fixtures.createProduct({ price: 100, stock: 200 });

    await withCsrf(agent.post('/api/cart').send({ productId: cheap.id, quantity: 1 }), token);
    const small = await agent.get('/api/cart');
    expect(Number(small.body.data.cart.subtotal)).toBeLessThan(5000);
    expect(Number(small.body.data.cart.shippingFee)).toBeGreaterThan(0);

    // 60 x 100 = 6000, comfortably past the free-delivery threshold.
    await withCsrf(agent.post('/api/cart').send({ productId: cheap.id, quantity: 59 }), token);
    const large = await agent.get('/api/cart');
    expect(Number(large.body.data.cart.subtotal)).toBe(6000);
    expect(Number(large.body.data.cart.shippingFee)).toBe(0);
    expect(Number(large.body.data.cart.total)).toBe(6000);
  });

  it('increments the quantity when the same product is added twice', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ stock: 10 });

    await withCsrf(agent.post('/api/cart').send({ productId: product.id, quantity: 1 }), token);
    const response = await withCsrf(
      agent.post('/api/cart').send({ productId: product.id, quantity: 3 }),
      token
    );

    expect(response.body.data.cart.items).toHaveLength(1);
    expect(response.body.data.cart.items[0].quantity).toBe(4);
  });

  it('refuses more than the available stock', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ stock: 3 });

    const response = await withCsrf(
      agent.post('/api/cart').send({ productId: product.id, quantity: 4 }),
      token
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('refuses a quantity of zero or a negative number', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    for (const quantity of [0, -5]) {
      const response = await withCsrf(agent.post('/api/cart').send({ productId: product.id, quantity }), token);
      expect(response.status).toBe(400);
    }
  });

  it('refuses a quantity above the per-line maximum', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ stock: 500 });

    const response = await withCsrf(
      agent.post('/api/cart').send({ productId: product.id, quantity: 500 }),
      token
    );

    expect(response.status).toBe(400);
  });

  it('refuses a product that does not exist', async () => {
    const { agent } = await signedInAgent();

    const response = await withCsrf(agent.post('/api/cart').send({ productId: 99999999, quantity: 1 }), token);

    expect(response.status).toBe(404);
  });

  it('refuses a non-numeric product id instead of treating it as text', async () => {
    const { agent } = await signedInAgent();

    const response = await withCsrf(
      agent.post('/api/cart').send({ productId: '1 OR 1=1', quantity: 1 }),
      token
    );

    expect(response.status).toBe(400);
  });
});

describe('PUT /api/cart/:id', () => {
  it('updates the quantity of a line', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ price: 250, stock: 20 });

    const added = await withCsrf(agent.post('/api/cart').send({ productId: product.id, quantity: 1 }), token);
    const lineId = added.body.data.cart.items[0].id;

    const response = await withCsrf(agent.put(`/api/cart/${lineId}`).send({ quantity: 5 }), token);

    expect(response.status).toBe(200);
    expect(response.body.data.cart.items[0].quantity).toBe(5);
    expect(Number(response.body.data.cart.items[0].lineTotal)).toBe(1250);
  });

  it('refuses a quantity above the available stock', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ stock: 2 });

    const added = await withCsrf(agent.post('/api/cart').send({ productId: product.id, quantity: 1 }), token);
    const lineId = added.body.data.cart.items[0].id;

    const response = await withCsrf(agent.put(`/api/cart/${lineId}`).send({ quantity: 9 }), token);

    expect(response.status).toBe(400);
  });

  it('cannot be used to touch another account\'s cart line', async () => {
    const first = await signedInAgent();
    const product = await fixtures.createProduct({ stock: 10 });

    const added = await withCsrf(
      first.agent.post('/api/cart').send({ productId: product.id, quantity: 1 }),
      token
    );
    const foreignLineId = added.body.data.cart.items[0].id;

    // A second, unrelated account.
    const second = await signedInAgent();
    const response = await withCsrf(
      second.agent.put(`/api/cart/${foreignLineId}`).send({ quantity: 99 }),
      token
    );

    expect(response.status).toBe(404);

    // The original line is untouched.
    const unchanged = await first.agent.get('/api/cart');
    expect(unchanged.body.data.cart.items[0].quantity).toBe(1);
  });
});

describe('DELETE /api/cart', () => {
  it('removes a single line', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ stock: 10 });

    const added = await withCsrf(agent.post('/api/cart').send({ productId: product.id, quantity: 2 }), token);
    const lineId = added.body.data.cart.items[0].id;

    const response = await withCsrf(agent.delete(`/api/cart/${lineId}`), token);

    expect(response.status).toBe(200);
    expect(response.body.data.cart.items).toHaveLength(0);
  });

  it('cannot be used to remove another account\'s cart line', async () => {
    const first = await signedInAgent();
    const product = await fixtures.createProduct({ stock: 10 });

    const added = await withCsrf(
      first.agent.post('/api/cart').send({ productId: product.id, quantity: 1 }),
      token
    );
    const foreignLineId = added.body.data.cart.items[0].id;

    const second = await signedInAgent();
    const response = await withCsrf(second.agent.delete(`/api/cart/${foreignLineId}`), token);

    expect(response.status).toBe(404);
    const stillThere = await first.agent.get('/api/cart');
    expect(stillThere.body.data.cart.items).toHaveLength(1);
  });

  it('empties the whole cart', async () => {
    const { agent } = await signedInAgent();
    const one = await fixtures.createProduct({ stock: 10 });
    const two = await fixtures.createProduct({ stock: 10 });

    await withCsrf(agent.post('/api/cart').send({ productId: one.id, quantity: 1 }), token);
    await withCsrf(agent.post('/api/cart').send({ productId: two.id, quantity: 2 }), token);

    const response = await withCsrf(agent.delete('/api/cart'), token);

    expect(response.status).toBe(200);
    expect(response.body.data.cart.items).toHaveLength(0);
    expect(response.body.data.cart.itemCount).toBe(0);
  });
});
