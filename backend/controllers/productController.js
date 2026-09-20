'use strict';

/**
 * Catalogue endpoints.
 *
 * Two search routes are exposed:
 *
 *   GET /api/products/search       - the route the storefront calls.  The
 *                                    implementation is selected by APP_MODE.
 *   GET /api/products/search-safe  - always uses the parameterised query, so
 *                                    the two behaviours can be compared in any
 *                                    mode.  See docs/security-testing.md.
 */

const config = require('../config/env');
const productService = require('../services/productService');
const reviewService = require('../services/reviewRenderer');
const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/errors');

/**
 * Resolve the search implementation for the current mode.
 * `require` is used lazily so the unused module is never loaded.
 */
function resolveSearch() {
  return config.isSecureMode
    ? require('../secure/secureSearch')
    : require('../vulnerabilities/vulnerableSearch');
}

function parseSearchFilters(source = {}) {
  return {
    q: source.q ?? '',
    categoryId: source.categoryId ?? '',
    minPrice: source.minPrice ?? '',
    maxPrice: source.maxPrice ?? '',
    sort: source.sort ?? 'newest',
    page: source.page ?? 1,
    limit: source.limit ?? 12,
  };
}

/** GET /api/products */
const list = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;
  const listing = await productService.listProducts({
    page: query.page ?? 1,
    limit: query.limit ?? 12,
    categoryId: query.categoryId ?? null,
    sort: query.sort ?? 'newest',
  });

  res.json({
    success: true,
    data: {
      items: listing.items,
      pagination: {
        page: listing.page,
        limit: listing.limit,
        total: listing.total,
        totalPages: Math.max(Math.ceil(listing.total / listing.limit), 1),
      },
    },
  });
});

/** GET /api/products/featured */
const featured = asyncHandler(async (req, res) => {
  const items = await productService.getFeaturedProducts(Number.parseInt(req.query.limit, 10) || 8);
  res.json({ success: true, data: { items } });
});

/** GET /api/products/new-arrivals */
const newArrivals = asyncHandler(async (req, res) => {
  const items = await productService.getNewArrivals(Number.parseInt(req.query.limit, 10) || 8);
  res.json({ success: true, data: { items } });
});

/** GET /api/products/top-rated */
const topRated = asyncHandler(async (req, res) => {
  const items = await productService.getTopRatedProducts(Number.parseInt(req.query.limit, 10) || 8);
  res.json({ success: true, data: { items } });
});

/** GET /api/products/search?q= */
const search = asyncHandler(async (req, res) => {
  const filters = parseSearchFilters(req.query);
  const implementation = resolveSearch();

  const [{ rows }, total] = await Promise.all([
    implementation.searchProducts(filters),
    implementation.countProducts(filters),
  ]);

  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 12, 1), 60);
  const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);

  res.json({
    success: true,
    data: {
      // The storefront shows "Results for <query>" using this value.
      query: implementation.echoQuery(filters.q),
      items: rows.map(productService.mapProduct),
      filters: {
        q: filters.q,
        categoryId: filters.categoryId || null,
        minPrice: filters.minPrice || null,
        maxPrice: filters.maxPrice || null,
        sort: filters.sort,
      },
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    },
  });
});

/** GET /api/products/search-safe?q= */
const searchSafe = asyncHandler(async (req, res) => {
  const filters = parseSearchFilters(req.query);
  const implementation = require('../secure/secureSearch');

  const [{ rows }, total] = await Promise.all([
    implementation.searchProducts(filters),
    implementation.countProducts(filters),
  ]);

  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 12, 1), 60);
  const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);

  res.json({
    success: true,
    data: {
      query: implementation.echoQuery(filters.q),
      items: rows.map(productService.mapProduct),
      filters: {
        q: filters.q,
        categoryId: filters.categoryId || null,
        minPrice: filters.minPrice || null,
        maxPrice: filters.maxPrice || null,
        sort: filters.sort,
      },
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    },
  });
});

/** GET /api/products/:id */
const detail = asyncHandler(async (req, res) => {
  const id = req.params.id;

  const product = /^\d+$/.test(id)
    ? await productService.getProductById(Number(id))
    : await productService.getProductBySlug(id);

  if (!product) throw notFound('Product not found');

  const [reviews, related] = await Promise.all([
    reviewService.listReviewsForProduct(product.id, req.user?.id ?? null),
    productService.getRelatedProducts(product.id, product.categoryId, 4),
  ]);

  res.json({ success: true, data: { product, reviews, related } });
});

module.exports = { list, featured, newArrivals, topRated, search, searchSafe, detail };
