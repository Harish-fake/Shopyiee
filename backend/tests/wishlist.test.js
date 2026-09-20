'use strict';

/** Saved items: adding, removing and moving a saved product into the cart. */

const { newAgent, signIn, withCsrf, closePool } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

let token;

afterAll(async () => {
  await fixtures.cleanup();
  await closePool();
});

async function signedInAgent() {
  const user = await fixtures.createUser();
  const agent = newAgent();
  token = await signIn(agent, user.email, user.password);
  return { agent, user };
}

describe('wishlist', () => {
  it('starts empty', async () => {
    const { agent } = await signedInAgent();
    const response = await agent.get('/api/wishlist');

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
    expect(response.body.data.total).toBe(0);
  });

  it('refuses anonymous access', async () => {
    const response = await newAgent().get('/api/wishlist');
    expect(response.status).toBe(401);
  });

  it('saves a product and lists it back', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    const added = await withCsrf(agent.post('/api/wishlist').send({ productId: product.id }), token);

    expect(added.status).toBe(201);
    expect(added.body.data.total).toBe(1);
    expect(added.body.data.items[0].productId).toBe(product.id);

    const listed = await agent.get('/api/wishlist');
    expect(listed.body.data.items).toHaveLength(1);
  });

  it('refuses to save the same product twice', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    await withCsrf(agent.post('/api/wishlist').send({ productId: product.id }), token);
    const duplicate = await withCsrf(agent.post('/api/wishlist').send({ productId: product.id }), token);

    expect(duplicate.status).toBe(409);
  });

  it('refuses a product that does not exist', async () => {
    const { agent } = await signedInAgent();
    const response = await withCsrf(agent.post('/api/wishlist').send({ productId: 99999999 }), token);

    expect(response.status).toBe(404);
  });

  it('removes a saved product', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    await withCsrf(agent.post('/api/wishlist').send({ productId: product.id }), token);
    const removed = await withCsrf(agent.delete(`/api/wishlist/${product.id}`), token);

    expect(removed.status).toBe(200);
    expect(removed.body.data.total).toBe(0);
  });

  it('moves a saved product into the cart and takes it off the list', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct({ price: 800, stock: 12 });

    await withCsrf(agent.post('/api/wishlist').send({ productId: product.id }), token);
    const moved = await withCsrf(
      agent.post(`/api/wishlist/${product.id}/move-to-cart`).send({ quantity: 2 }),
      token
    );

    expect(moved.status).toBe(200);

    const cart = await agent.get('/api/cart');
    expect(cart.body.data.cart.items).toHaveLength(1);
    expect(cart.body.data.cart.items[0].quantity).toBe(2);

    const wishlist = await agent.get('/api/wishlist');
    expect(wishlist.body.data.items).toHaveLength(0);
  });

  it('keeps one account\'s list separate from another\'s', async () => {
    const first = await signedInAgent();
    const product = await fixtures.createProduct();
    await withCsrf(first.agent.post('/api/wishlist').send({ productId: product.id }), token);

    const second = await signedInAgent();
    const listed = await second.agent.get('/api/wishlist');

    expect(listed.body.data.items).toHaveLength(0);
  });
});
