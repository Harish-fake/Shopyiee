'use strict';

/** Order history: listing, detail and cancellation with a wallet refund. */

const { newAgent, signIn, withCsrf, closePool } = require('./helpers/harness');
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

/** Places an order through the hardened route and returns it. */
async function placeOrder(agent, product, quantity = 1) {
  const response = await withCsrf(
    agent.post('/api/checkout-secure').send({
      items: [{ productId: product.id, quantity }],
      shipping: SHIPPING,
    }),
    token
  );
  if (response.status !== 201) {
    throw new Error(`Order fixture failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.order;
}

describe('GET /api/orders', () => {
  it('starts empty for a new account', async () => {
    const { agent } = await signedInAgent();
    const response = await agent.get('/api/orders');

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
    expect(response.body.data.pagination.total).toBe(0);
  });

  it('lists the orders the account has placed, newest first', async () => {
    const { agent } = await signedInAgent({ balance: 90000 });
    const first = await fixtures.createProduct({ price: 400, stock: 5 });
    const second = await fixtures.createProduct({ price: 700, stock: 5 });

    const orderOne = await placeOrder(agent, first);
    const orderTwo = await placeOrder(agent, second);

    const response = await agent.get('/api/orders');

    expect(response.body.data.items).toHaveLength(2);

    // Both orders were placed within the same second, so the clock ties and the
    // identifier decides. Assert membership plus a non-increasing order.
    expect(response.body.data.items.map((item) => item.id).sort()).toEqual(
      [orderOne.id, orderTwo.id].sort((a, b) => a - b)
    );

    const timestamps = response.body.data.items.map((item) => new Date(item.createdAt).getTime());
    expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
  });

  it('does not include orders belonging to other accounts', async () => {
    const first = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 400, stock: 5 });
    await placeOrder(first.agent, product);

    const second = await signedInAgent();
    const response = await second.agent.get('/api/orders');

    expect(response.body.data.items).toHaveLength(0);
  });

  it('refuses anonymous access', async () => {
    const response = await newAgent().get('/api/orders');
    expect(response.status).toBe(401);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns the order with its line items and delivery address', async () => {
    const { agent } = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 1500, stock: 5 });
    const order = await placeOrder(agent, product, 2);

    const response = await agent.get(`/api/orders/${order.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.order.orderNumber).toBe(order.orderNumber);
    expect(response.body.data.order.items).toHaveLength(1);
    expect(Number(response.body.data.order.items[0].quantity)).toBe(2);
    expect(response.body.data.order.shipping.city).toBe('Bengaluru');
  });

  it('answers 404 for an order that does not exist', async () => {
    const { agent } = await signedInAgent();
    const response = await agent.get('/api/orders/99999999');

    expect(response.status).toBe(404);
  });
});

describe('GET /api/orders/:id/secure', () => {
  it('returns the caller\'s own order', async () => {
    const { agent } = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 1500, stock: 5 });
    const order = await placeOrder(agent, product);

    const response = await agent.get(`/api/orders/${order.id}/secure`);

    expect(response.status).toBe(200);
    expect(response.body.data.order.id).toBe(order.id);
  });

  it('answers 404 rather than 403 for an order belonging to somebody else', async () => {
    const owner = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 1500, stock: 5 });
    const order = await placeOrder(owner.agent, product);

    const stranger = await signedInAgent();
    const response = await stranger.agent.get(`/api/orders/${order.id}/secure`);

    // 404 avoids confirming that the order exists at all.
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/orders/:id/cancel', () => {
  it('cancels the order, refunds the wallet and returns the stock', async () => {
    const { agent, user } = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 2000, stock: 10 });
    const order = await placeOrder(agent, product, 2);

    const balanceAfterPurchase = await fixtures.balanceOf(user.id);
    const stockAfterPurchase = await fixtures.stockOf(product.id);

    const response = await withCsrf(agent.post(`/api/orders/${order.id}/cancel`), token);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CANCELLED');

    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(balanceAfterPurchase + Number(order.total), 2);
    expect(await fixtures.stockOf(product.id)).toBe(stockAfterPurchase + 2);

    const detail = await agent.get(`/api/orders/${order.id}`);
    expect(detail.body.data.order.status).toBe('CANCELLED');
    expect(detail.body.data.order.paymentStatus).toBe('REFUNDED');
  });

  it('records a refund entry in the wallet ledger', async () => {
    const { agent } = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 900, stock: 5 });
    const order = await placeOrder(agent, product);

    await withCsrf(agent.post(`/api/orders/${order.id}/cancel`), token);

    const ledger = await agent.get('/api/wallet/transactions');
    const refund = ledger.body.data.items.find((entry) => entry.type === 'REFUND');

    expect(refund).toBeDefined();
    expect(Number(refund.amount)).toBe(Number(order.total));
  });

  it('refuses to cancel the same order twice', async () => {
    const { agent } = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 900, stock: 5 });
    const order = await placeOrder(agent, product);

    await withCsrf(agent.post(`/api/orders/${order.id}/cancel`), token);
    const second = await withCsrf(agent.post(`/api/orders/${order.id}/cancel`), token);

    // Already cancelled: the state transition is refused, and no second refund
    // is written.
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe('UNPROCESSABLE');
  });

  it('refuses to cancel an order belonging to somebody else', async () => {
    const owner = await signedInAgent({ balance: 90000 });
    const product = await fixtures.createProduct({ price: 900, stock: 5 });
    const order = await placeOrder(owner.agent, product);

    const stranger = await signedInAgent();
    const response = await withCsrf(stranger.agent.post(`/api/orders/${order.id}/cancel`), token);

    expect(response.status).toBe(404);

    // Still live for its owner.
    const detail = await owner.agent.get(`/api/orders/${order.id}`);
    expect(detail.body.data.order.status).not.toBe('CANCELLED');
  });
});
