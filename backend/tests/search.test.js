'use strict';

/**
 * Catalogue search.
 *
 * Functional coverage for both search endpoints.  The security difference
 * between them is asserted separately in security-behaviour.test.js.
 */

const { newAgent, closePool } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

const agent = newAgent();

afterAll(async () => {
  await fixtures.cleanup();
  await closePool();
});

describe('GET /api/products/search', () => {
  it('finds products by keyword', async () => {
    const response = await agent.get('/api/products/search?q=laptop');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.query).toBe('laptop');
  });

  it('matches on the brand as well as the name', async () => {
    const response = await agent.get('/api/products/search?q=Vista');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.items.some((item) => item.brand === 'Vista')).toBe(true);
  });

  it('matches text that only appears in the description', async () => {
    const response = await agent.get('/api/products/search?q=sapphire');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(
      response.body.data.items.some((item) => String(item.description).toLowerCase().includes('sapphire'))
    ).toBe(true);
  });

  it('returns an empty result set when nothing matches', async () => {
    const response = await agent.get('/api/products/search?q=zzzznoresultszzzz');

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
    expect(response.body.data.pagination.total).toBe(0);
  });

  it('filters by category', async () => {
    const categoryId = await fixtures.anyCategoryId();
    const response = await agent.get(`/api/products/search?categoryId=${categoryId}&limit=60`);

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    for (const item of response.body.data.items) {
      expect(item.categoryId).toBe(categoryId);
    }
  });

  it('filters by price band', async () => {
    const response = await agent.get('/api/products/search?minPrice=1000&maxPrice=5000&limit=60');

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    for (const item of response.body.data.items) {
      expect(Number(item.price)).toBeGreaterThanOrEqual(1000);
      expect(Number(item.price)).toBeLessThanOrEqual(5000);
    }
  });

  it('sorts by price ascending', async () => {
    const response = await agent.get('/api/products/search?q=&sort=price-asc&limit=60');

    const prices = response.body.data.items.map((item) => Number(item.price));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('paginates', async () => {
    const first = await agent.get('/api/products/search?q=&limit=5&page=1');
    const second = await agent.get('/api/products/search?q=&limit=5&page=2');

    expect(first.body.data.pagination.page).toBe(1);
    expect(second.body.data.pagination.page).toBe(2);
    expect(first.body.data.items).toHaveLength(5);
  });
});

describe('GET /api/products/search-safe', () => {
  it('returns the same products as the standard endpoint for an ordinary keyword', async () => {
    const standard = await agent.get('/api/products/search?q=laptop');
    const safe = await agent.get('/api/products/search-safe?q=laptop');

    expect(safe.status).toBe(200);
    expect(safe.body.data.items.map((item) => item.id).sort()).toEqual(
      standard.body.data.items.map((item) => item.id).sort()
    );
  });

  it('treats a LIKE wildcard as a literal character', async () => {
    // '%' is a wildcard in SQL.  The hardened implementation escapes it, so it
    // can only match a product whose own text contains a percent sign - one
    // description reads "99% sRGB".  It must never widen to the whole
    // catalogue the way the unescaped version does.
    const response = await agent.get('/api/products/search-safe?q=%25&limit=60');

    expect(response.status).toBe(200);
    const items = response.body.data.items;

    expect(items.length).toBeLessThan(10);
    for (const item of items) {
      const haystack = `${item.name} ${item.description ?? ''} ${item.brand ?? ''}`;
      expect(haystack).toContain('%');
    }
  });

  it('treats an underscore as a literal character', async () => {
    const response = await agent.get('/api/products/search-safe?q=_&limit=60');

    expect(response.status).toBe(200);
    const items = response.body.data.items;

    expect(items.length).toBeLessThan(10);
    for (const item of items) {
      const haystack = `${item.name} ${item.description ?? ''} ${item.brand ?? ''}`;
      expect(haystack).toContain('_');
    }
  });

  it('filters and sorts exactly like the standard endpoint', async () => {
    const categoryId = await fixtures.anyCategoryId();
    const response = await agent.get(
      `/api/products/search-safe?categoryId=${categoryId}&minPrice=1000&sort=price-desc&limit=60`
    );

    expect(response.status).toBe(200);
    const prices = response.body.data.items.map((item) => Number(item.price));
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
  });
});
