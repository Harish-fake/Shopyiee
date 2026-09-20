'use strict';

/** Catalogue browsing: listing, filtering, sorting, detail pages, categories. */

const { newAgent, closePool } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

const agent = newAgent();

afterAll(async () => {
  await fixtures.cleanup();
  await closePool();
});

describe('GET /api/products', () => {
  it('returns a page of products with pagination metadata', async () => {
    const response = await agent.get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThan(0);

    const { pagination } = response.body.data;
    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBe(12);
    expect(pagination.total).toBeGreaterThanOrEqual(45);
  });

  it('exposes the fields the storefront renders', async () => {
    const { body } = await agent.get('/api/products?limit=1');
    const product = body.data.items[0];

    for (const field of ['id', 'name', 'slug', 'price', 'stock', 'image', 'categoryId', 'rating']) {
      expect(product).toHaveProperty(field);
    }
  });

  it('paginates', async () => {
    const first = await agent.get('/api/products?limit=5&page=1');
    const second = await agent.get('/api/products?limit=5&page=2');

    expect(first.body.data.items).toHaveLength(5);
    expect(second.body.data.items).toHaveLength(5);

    const firstIds = first.body.data.items.map((item) => item.id);
    const secondIds = second.body.data.items.map((item) => item.id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it('filters by category', async () => {
    const categoryId = await fixtures.anyCategoryId();
    const response = await agent.get(`/api/products?categoryId=${categoryId}&limit=60`);

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    for (const product of response.body.data.items) {
      expect(product.categoryId).toBe(categoryId);
    }
  });

  it('sorts by price in both directions', async () => {
    const ascending = await agent.get('/api/products?sort=price-asc&limit=60');
    const descending = await agent.get('/api/products?sort=price-desc&limit=60');

    const ascPrices = ascending.body.data.items.map((item) => Number(item.price));
    const descPrices = descending.body.data.items.map((item) => Number(item.price));

    expect([...ascPrices].sort((a, b) => a - b)).toEqual(ascPrices);
    expect([...descPrices].sort((a, b) => b - a)).toEqual(descPrices);
  });

  it('rejects an out-of-range page size rather than silently ignoring it', async () => {
    const response = await agent.get('/api/products?limit=100000');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('falls back to a safe default for an unknown sort key', async () => {
    const response = await agent.get('/api/products?sort=; DROP TABLE products');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });
});

describe('GET /api/products/:id', () => {
  it('returns a product with its reviews and related items', async () => {
    const { body } = await agent.get('/api/products?limit=1');
    const product = body.data.items[0];

    const response = await agent.get(`/api/products/${product.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.product.id).toBe(product.id);
    expect(Array.isArray(response.body.data.reviews)).toBe(true);
    expect(Array.isArray(response.body.data.related)).toBe(true);
  });

  it('resolves a product by slug as well as by id', async () => {
    const { body } = await agent.get('/api/products?limit=1');
    const product = body.data.items[0];

    const response = await agent.get(`/api/products/${product.slug}`);

    expect(response.status).toBe(200);
    expect(response.body.data.product.id).toBe(product.id);
  });

  it('answers 404 for an unknown identifier', async () => {
    const response = await agent.get('/api/products/99999999');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not treat an unknown slug as a numeric identifier', async () => {
    const response = await agent.get('/api/products/no-such-product');

    expect(response.status).toBe(404);
  });
});

describe('catalogue highlights', () => {
  it('returns featured products', async () => {
    const response = await agent.get('/api/products/featured');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });

  it('returns new arrivals', async () => {
    const response = await agent.get('/api/products/new-arrivals');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });

  it('returns the top rated products in descending rating order', async () => {
    const response = await agent.get('/api/products/top-rated');

    expect(response.status).toBe(200);
    const ratings = response.body.data.items.map((item) => Number(item.rating));
    expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
  });
});

describe('GET /api/categories', () => {
  it('lists the categories with their product counts', async () => {
    const response = await agent.get('/api/categories');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBe(7);

    for (const category of response.body.data.items) {
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('slug');
      expect(Number(category.productCount ?? category.product_count ?? 0)).toBeGreaterThan(0);
    }
  });

  it('returns a single category', async () => {
    const categoryId = await fixtures.anyCategoryId();
    const response = await agent.get(`/api/categories/${categoryId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.category.id).toBe(categoryId);
  });

  it('returns the products inside a category', async () => {
    const categoryId = await fixtures.anyCategoryId();
    const response = await agent.get(`/api/categories/${categoryId}/products`);

    expect(response.status).toBe(200);
    expect(response.body.data.category.id).toBe(categoryId);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });

  it('answers 404 for an unknown category', async () => {
    const response = await agent.get('/api/categories/99999999');

    expect(response.status).toBe(404);
  });
});

describe('GET /api/health', () => {
  it('reports that the API is up', async () => {
    const response = await agent.get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });
});
