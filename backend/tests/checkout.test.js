'use strict';

/**
 * Checkout.
 *
 * Both routes are covered here:
 *
 *   POST /api/checkout          - the route the storefront calls; the pricing
 *                                 implementation is chosen by APP_MODE.
 *   POST /api/checkout-secure   - always prices the order from MySQL.
 *
 * The price-tampering difference between the two is asserted in
 * security-behaviour.test.js.
 */

const { newAgent, signIn, withCsrf, closePool, config } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

const SHIPPING = {
  name: 'Test Shopper',
  phone: '9000000000',
  address: '1 Test Lane',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
};

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

describe('POST /api/checkout', () => {
  it('places an order, debits the wallet and reduces stock', async () => {
    const { agent, user } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 1200, stock: 8 });
    const balanceBefore = await fixtures.balanceOf(user.id);

    const response = await withCsrf(
      agent.post('/api/checkout').send({
        items: [{ productId: product.id, quantity: 2, price: 1200 }],
        shipping: SHIPPING,
      }),
      token
    );

    expect(response.status).toBe(201);

    const { order } = response.body.data;
    expect(order.orderNumber).toMatch(/^ORD-\d{4}-\d+$/);
    expect(Number(order.subtotal)).toBe(2400);
    // The total is the server's subtotal plus whatever shipping it applied, in
    // both modes - only the source of the figures differs.
    expect(Number(order.total)).toBeCloseTo(Number(order.subtotal) + Number(order.shippingFee), 2);
    expect(order.status).toBe('PROCESSING');
    expect(order.paymentStatus).toBe('PAID');
    expect(order.items).toHaveLength(1);

    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(balanceBefore - Number(order.total), 2);
    expect(await fixtures.stockOf(product.id)).toBe(6);
  });

  it('records a purchase entry in the wallet ledger', async () => {
    const { agent } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 500, stock: 5 });

    const placed = await withCsrf(
      agent.post('/api/checkout').send({
        items: [{ productId: product.id, quantity: 1, price: 500 }],
        shipping: SHIPPING,
      }),
      token
    );

    const ledger = await agent.get('/api/wallet/transactions');
    const purchase = ledger.body.data.items.find((entry) => entry.type === 'PURCHASE');

    expect(purchase).toBeDefined();
    expect(Number(purchase.amount)).toBeCloseTo(Number(placed.body.data.order.total), 2);
  });

  it('refuses an order the wallet cannot cover', async () => {
    const { agent } = await signedInAgent({ balance: 100 });
    const product = await fixtures.createProduct({ price: 9000, stock: 5 });

    const response = await withCsrf(
      agent.post('/api/checkout').send({
        items: [{ productId: product.id, quantity: 1, price: 9000 }],
        shipping: SHIPPING,
      }),
      token
    );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNPROCESSABLE');
  });

  it('refuses an empty order', async () => {
    const { agent } = await signedInAgent();
    const response = await withCsrf(agent.post('/api/checkout').send({ items: [] }), token);

    expect(response.status).toBe(400);
  });

  it('falls back to the stored cart when no item list is sent', async () => {
    const { agent } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 300, stock: 5 });

    await withCsrf(agent.post('/api/cart').send({ productId: product.id, quantity: 2 }), token);

    const response = await withCsrf(agent.post('/api/checkout').send({ shipping: SHIPPING }), token);

    expect(response.status).toBe(201);
    expect(response.body.data.order.items).toHaveLength(1);
    expect(Number(response.body.data.order.subtotal)).toBe(600);
  });

  it('refuses an empty cart when no item list is sent', async () => {
    const { agent } = await signedInAgent();
    const response = await withCsrf(agent.post('/api/checkout').send({ shipping: SHIPPING }), token);

    expect(response.status).toBe(400);
  });

  it('refuses anonymous checkout', async () => {
    const response = await newAgent()
      .post('/api/checkout')
      .send({ items: [{ productId: 1, quantity: 1, price: 1 }] });

    expect(response.status).toBe(401);
  });
});

describe('POST /api/checkout-secure', () => {
  it('prices every line from the catalogue and adds shipping', async () => {
    const { agent, user } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 1200, stock: 8 });
    const balanceBefore = await fixtures.balanceOf(user.id);

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({
        items: [{ productId: product.id, quantity: 2 }],
        shipping: SHIPPING,
      }),
      token
    );

    expect(response.status).toBe(201);

    const { order } = response.body.data;
    expect(Number(order.subtotal)).toBe(2400);
    // 2400 is below the free-delivery threshold, so shipping is added.
    expect(Number(order.shippingFee)).toBeGreaterThan(0);
    expect(Number(order.total)).toBe(2400 + Number(order.shippingFee));

    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(balanceBefore - Number(order.total), 2);
    expect(await fixtures.stockOf(product.id)).toBe(6);
  });

  it('waives shipping above the free-delivery threshold', async () => {
    const { agent } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 3000, stock: 5 });

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({
        items: [{ productId: product.id, quantity: 2 }],
        shipping: SHIPPING,
      }),
      token
    );

    expect(Number(response.body.data.order.shippingFee)).toBe(0);
    expect(Number(response.body.data.order.total)).toBe(6000);
  });

  it('refuses more than the available stock', async () => {
    const { agent } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 100, stock: 2 });

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({ items: [{ productId: product.id, quantity: 3 }] }),
      token
    );

    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/stock/i);
    // Nothing was reserved.
    expect(await fixtures.stockOf(product.id)).toBe(2);
  });

  it('refuses a product that does not exist', async () => {
    const { agent } = await signedInAgent({ balance: 50000 });

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({ items: [{ productId: 99999999, quantity: 1 }] }),
      token
    );

    expect(response.status).toBe(404);
  });

  it('refuses a non-numeric product id', async () => {
    const { agent } = await signedInAgent({ balance: 50000 });

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({ items: [{ productId: '1 OR 1=1', quantity: 1 }] }),
      token
    );

    expect(response.status).toBe(400);
  });

  it('refuses a quantity of zero', async () => {
    const { agent } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ stock: 5 });

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({ items: [{ productId: product.id, quantity: 0 }] }),
      token
    );

    expect(response.status).toBe(400);
  });

  it('refuses an order the wallet cannot cover and leaves the balance alone', async () => {
    const { agent, user } = await signedInAgent({ balance: 50 });
    const product = await fixtures.createProduct({ price: 9000, stock: 5 });

    const response = await withCsrf(
      agent.post('/api/checkout-secure').send({ items: [{ productId: product.id, quantity: 1 }] }),
      token
    );

    expect(response.status).toBe(422);
    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(50, 2);
    expect(await fixtures.stockOf(product.id)).toBe(5);
  });

  it('clears the purchased lines from the cart', async () => {
    const { agent } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 400, stock: 10 });

    await withCsrf(agent.post('/api/cart').send({ productId: product.id, quantity: 1 }), token);
    await withCsrf(
      agent.post('/api/checkout-secure').send({
        items: [{ productId: product.id, quantity: 1 }],
        shipping: SHIPPING,
      }),
      token
    );

    const cart = await agent.get('/api/cart');
    expect(cart.body.data.cart.items).toHaveLength(0);
  });
});

describe('POST /api/checkout/preview', () => {
  it('returns server-computed totals without writing anything', async () => {
    const { agent, user } = await signedInAgent({ balance: 50000 });
    const product = await fixtures.createProduct({ price: 1750, stock: 6 });
    const balanceBefore = await fixtures.balanceOf(user.id);

    const response = await withCsrf(
      agent.post('/api/checkout/preview').send({ items: [{ productId: product.id, quantity: 2 }] }),
      token
    );

    expect(response.status).toBe(200);
    expect(response.body.data.lines).toHaveLength(1);
    expect(Number(response.body.data.lines[0].unitPrice)).toBe(1750);
    expect(Number(response.body.data.lines[0].lineTotal)).toBe(3500);
    expect(Number(response.body.data.subtotal)).toBe(3500);

    // Nothing changed.
    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(balanceBefore, 2);
    expect(await fixtures.stockOf(product.id)).toBe(6);
  });

  it('reports the free-delivery threshold the storefront advertises', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ price: 100, stock: 6 });

    const response = await withCsrf(
      agent.post('/api/checkout/preview').send({ items: [{ productId: product.id, quantity: 1 }] }),
      token
    );

    expect(Number(response.body.data.freeShippingThreshold)).toBeGreaterThan(0);
  });
});
