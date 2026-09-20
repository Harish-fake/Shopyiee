'use strict';

/** Customer reviews: writing, editing, deleting and the product rating roll-up. */

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

describe('GET /api/reviews/product/:productId', () => {
  it('is readable without signing in', async () => {
    const product = await fixtures.createProduct();
    const response = await newAgent().get(`/api/reviews/product/${product.id}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data).toHaveProperty('average');
    expect(response.body.data).toHaveProperty('distribution');
  });

  it('returns an empty list for a product with no reviews', async () => {
    const product = await fixtures.createProduct();
    const response = await newAgent().get(`/api/reviews/product/${product.id}`);

    expect(response.body.data.total).toBe(0);
    expect(Number(response.body.data.average)).toBe(0);
  });
});

describe('POST /api/reviews', () => {
  it('writes a review and updates the product rating', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    const response = await withCsrf(
      agent.post('/api/reviews').send({
        productId: product.id,
        rating: 4,
        title: 'Solid purchase',
        comment: 'Arrived on time and works exactly as described.',
      }),
      token
    );

    expect(response.status).toBe(201);
    expect(response.body.data.review.rating).toBe(4);
    expect(response.body.data.review.title).toBe('Solid purchase');
    expect(response.body.data.review.productId).toBe(product.id);

    // The catalogue rating is recalculated from the reviews table.
    const product_after = await newAgent().get(`/api/products/${product.id}`);
    expect(Number(product_after.body.data.product.reviewCount)).toBe(1);
    expect(Number(product_after.body.data.product.rating)).toBe(4);
  });

  it('requires a rating between 1 and 5', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    for (const rating of [0, 6, 99]) {
      const response = await withCsrf(
        agent.post('/api/reviews').send({ productId: product.id, rating, comment: 'Out of range' }),
        token
      );
      expect(response.status).toBe(400);
    }
  });

  it('refuses a second review for the same product', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    await withCsrf(
      agent.post('/api/reviews').send({ productId: product.id, rating: 5, comment: 'First' }),
      token
    );
    const duplicate = await withCsrf(
      agent.post('/api/reviews').send({ productId: product.id, rating: 1, comment: 'Second' }),
      token
    );

    expect(duplicate.status).toBe(400);
  });

  it('refuses a review for a product that does not exist', async () => {
    const { agent } = await signedInAgent();

    const response = await withCsrf(
      agent.post('/api/reviews').send({ productId: 99999999, rating: 5, comment: 'Ghost product' }),
      token
    );

    expect(response.status).toBe(404);
  });

  it('refuses anonymous reviews', async () => {
    const product = await fixtures.createProduct();

    const response = await newAgent()
      .post('/api/reviews')
      .send({ productId: product.id, rating: 5, comment: 'Anonymous' });

    expect(response.status).toBe(401);
  });
});

describe('PUT /api/reviews/:id', () => {
  it('edits your own review', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      agent.post('/api/reviews').send({ productId: product.id, rating: 3, comment: 'It is fine' }),
      token
    );
    const reviewId = created.body.data.review.id;

    const response = await withCsrf(
      agent.put(`/api/reviews/${reviewId}`).send({ rating: 5, comment: 'Actually excellent' }),
      token
    );

    expect(response.status).toBe(200);
    expect(response.body.data.review.rating).toBe(5);
    expect(response.body.data.review.comment).toBe('Actually excellent');
  });

  it('refuses to edit somebody else\'s review', async () => {
    const author = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      author.agent.post('/api/reviews').send({ productId: product.id, rating: 4, comment: 'Mine' }),
      token
    );
    const reviewId = created.body.data.review.id;

    const other = await signedInAgent();
    const response = await withCsrf(
      other.agent.put(`/api/reviews/${reviewId}`).send({ rating: 1, comment: 'Not yours' }),
      token
    );

    expect(response.status).toBe(403);

    // The original content survives.
    const listed = await newAgent().get(`/api/reviews/product/${product.id}`);
    expect(listed.body.data.items[0].comment).toBe('Mine');
  });
});

describe('DELETE /api/reviews/:id', () => {
  it('deletes your own review', async () => {
    const { agent } = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      agent.post('/api/reviews').send({ productId: product.id, rating: 2, comment: 'Not for me' }),
      token
    );
    const reviewId = created.body.data.review.id;

    const response = await withCsrf(agent.delete(`/api/reviews/${reviewId}`), token);

    expect(response.status).toBe(200);

    const listed = await newAgent().get(`/api/reviews/product/${product.id}`);
    expect(listed.body.data.total).toBe(0);
  });

  it('refuses to delete somebody else\'s review as a customer', async () => {
    const author = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      author.agent.post('/api/reviews').send({ productId: product.id, rating: 4, comment: 'Keep me' }),
      token
    );
    const reviewId = created.body.data.review.id;

    const other = await signedInAgent();
    const response = await withCsrf(other.agent.delete(`/api/reviews/${reviewId}`), token);

    expect(response.status).toBe(403);
  });

  it('lets an administrator delete any review', async () => {
    const author = await signedInAgent();
    const product = await fixtures.createProduct();

    const created = await withCsrf(
      author.agent.post('/api/reviews').send({ productId: product.id, rating: 1, comment: 'Remove me' }),
      token
    );
    const reviewId = created.body.data.review.id;

    const admin = await signedInAgent({ role: 'ADMIN' });
    const response = await withCsrf(admin.agent.delete(`/api/reviews/${reviewId}`), token);

    expect(response.status).toBe(200);
  });
});

describe('GET /api/reviews/mine', () => {
  it('lists only the signed-in account\'s reviews', async () => {
    const author = await signedInAgent();
    const product = await fixtures.createProduct();

    await withCsrf(
      author.agent.post('/api/reviews').send({ productId: product.id, rating: 5, comment: 'Mine only' }),
      token
    );

    const mine = await author.agent.get('/api/reviews/mine');
    expect(mine.body.data.total).toBe(1);

    const other = await signedInAgent();
    const theirs = await other.agent.get('/api/reviews/mine');
    expect(theirs.body.data.total).toBe(0);
  });
});
