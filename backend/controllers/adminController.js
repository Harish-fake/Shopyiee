'use strict';

/**
 * Administration endpoints.
 *
 * Authorization for these routes is applied in `routes/adminRoutes.js`:
 * `GET /api/admin/users` uses the mode-dependent gate described in
 * docs/security-testing.md, while every other route uses the hardened gate and
 * the hardened ownership rules.
 */

const authService = require('../services/authService');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const walletService = require('../services/walletService');
const reviewService = require('../services/reviewRenderer');
const asyncHandler = require('../utils/asyncHandler');
const { asInt, asMoney, asString, asEnum } = require('../utils/validators');
const { badRequest } = require('../utils/errors');

/** GET /api/admin/stats */
const stats = asyncHandler(async (_req, res) => {
  const [dashboard, inventory] = await Promise.all([
    orderService.getDashboardStats(),
    productService.getInventory({ lowStockThreshold: 10 }),
  ]);

  res.json({
    success: true,
    data: {
      ...dashboard,
      lowStockItems: inventory.lowStock.slice(0, 8),
    },
  });
});

/** GET /api/admin/users */
const listUsers = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;

  const items = await authService.listUsers({
    limit: query.limit ?? 100,
    offset: query.offset ?? 0,
    search: query.search ?? null,
  });

  res.json({ success: true, data: { items, total: await authService.countUsers() } });
});

/** GET /api/admin/users-secure - identical payload, hardened gate. */
const listUsersSecure = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;

  const items = await authService.listUsers({
    limit: query.limit ?? 100,
    offset: query.offset ?? 0,
    search: query.search ?? null,
  });

  res.json({ success: true, data: { items, total: await authService.countUsers() } });
});

/** GET /api/admin/orders */
const listOrders = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;

  const result = await orderService.listAllOrders({
    page: query.page ?? 1,
    limit: query.limit ?? 25,
    status: query.status ?? null,
    search: query.search ?? null,
  });

  res.json({
    success: true,
    data: {
      items: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(Math.ceil(result.total / result.limit), 1),
      },
    },
  });
});

/** PUT /api/admin/orders/:id/status */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const status = asEnum(req.body.status, orderService.VALID_STATUSES, 'status');
  const order = await orderService.updateStatus(Number(req.params.id), status);
  res.json({ success: true, data: { order } });
});

/** POST /api/admin/orders/:id/cancel */
const cancelOrder = asyncHandler(async (req, res) => {
  const result = await orderService.cancelOrder(Number(req.params.id), { isAdmin: true });
  res.json({ success: true, data: result });
});

/** GET /api/admin/products */
const listProducts = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;

  const result = await productService.listProducts({
    page: query.page ?? 1,
    limit: query.limit ?? 25,
    sort: query.sort ?? 'newest',
    includeInactive: true,
  });

  res.json({
    success: true,
    data: {
      items: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(Math.ceil(result.total / result.limit), 1),
      },
    },
  });
});

/** Validate the payload for creating or updating a product. */
function readProductPayload(body, { partial = false } = {}) {
  const payload = {};

  const assign = (key, value) => {
    if (value !== undefined) payload[key] = value;
  };

  assign('name', body.name === undefined ? undefined : asString(body.name, 'name', { min: 2, max: 200 }));
  assign(
    'description',
    body.description === undefined ? undefined : asString(body.description, 'description', { min: 1, max: 4000 })
  );
  assign('brand', body.brand === undefined ? undefined : asString(body.brand, 'brand', { min: 1, max: 100 }));
  assign('price', body.price === undefined ? undefined : asMoney(body.price, 'price'));
  assign(
    'originalPrice',
    body.originalPrice === undefined || body.originalPrice === null
      ? undefined
      : asMoney(body.originalPrice, 'originalPrice')
  );
  assign('stock', body.stock === undefined ? undefined : asInt(body.stock, 'stock', { min: 0, max: 1_000_000 }));
  assign(
    'categoryId',
    body.categoryId === undefined ? undefined : asInt(body.categoryId, 'categoryId', { min: 1 })
  );
  assign('image', body.image === undefined ? undefined : asString(body.image, 'image', { min: 1, max: 255 }));
  assign('isFeatured', body.isFeatured === undefined ? undefined : Boolean(body.isFeatured));
  assign('isActive', body.isActive === undefined ? undefined : Boolean(body.isActive));

  if (!partial) {
    for (const required of ['name', 'price', 'categoryId']) {
      if (payload[required] === undefined) throw badRequest(`${required} is required`);
    }
  }

  return payload;
}

/** POST /api/admin/products */
const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(readProductPayload(req.body));
  res.status(201).json({ success: true, data: { product } });
});

/** PUT /api/admin/products/:id */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(Number(req.params.id), readProductPayload(req.body, { partial: true }));
  res.json({ success: true, data: { product } });
});

/** DELETE /api/admin/products/:id */
const deleteProduct = asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(Number(req.params.id));
  res.json({ success: true, data: result });
});

/** GET /api/admin/reviews */
const listReviews = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;
  const items = await reviewService.listAllReviews({
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  });
  res.json({ success: true, data: { items, total: items.length } });
});

/** DELETE /api/admin/reviews/:id */
const deleteReview = asyncHandler(async (req, res) => {
  const result = await reviewService.deleteReview({
    reviewId: Number(req.params.id),
    userId: req.user.id,
    isAdmin: true,
  });
  res.json({ success: true, data: result });
});

/** GET /api/admin/transactions */
const listTransactions = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;
  const result = await walletService.listAllTransactions({
    limit: query.limit ?? 100,
    offset: query.offset ?? 0,
  });
  res.json({ success: true, data: result });
});

/** GET /api/admin/inventory */
const inventory = asyncHandler(async (_req, res) => {
  const result = await productService.getInventory({ lowStockThreshold: 10 });
  res.json({ success: true, data: result });
});

module.exports = {
  stats,
  listUsers,
  listUsersSecure,
  listOrders,
  updateOrderStatus,
  cancelOrder,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listReviews,
  deleteReview,
  listTransactions,
  inventory,
};
