'use strict';

/** Category browsing. */

const categoryService = require('../services/categoryService');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/categories */
const list = asyncHandler(async (_req, res) => {
  const items = await categoryService.listCategories();
  res.json({ success: true, data: { items } });
});

/** GET /api/categories/:id */
const detail = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const category = /^\d+$/.test(id)
    ? await categoryService.getCategoryById(Number(id))
    : await categoryService.getCategoryBySlug(id);

  if (!category) {
    return res.status(404).json({ success: false, error: { message: 'Category not found', code: 'NOT_FOUND' } });
  }

  res.json({ success: true, data: { category } });
});

/** GET /api/categories/:id/products */
const products = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const query = req.validatedQuery ?? req.query;

  const category = /^\d+$/.test(id)
    ? await categoryService.getCategoryById(Number(id))
    : await categoryService.getCategoryBySlug(id);

  if (!category) {
    return res.status(404).json({ success: false, error: { message: 'Category not found', code: 'NOT_FOUND' } });
  }

  const listing = await categoryService.getCategoryProducts(category.id, {
    page: query.page ?? 1,
    limit: query.limit ?? 12,
    sort: query.sort ?? 'newest',
  });

  res.json({
    success: true,
    data: {
      category: listing.category,
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

module.exports = { list, detail, products };
