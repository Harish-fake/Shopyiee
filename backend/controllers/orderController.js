'use strict';

/**
 * Order history.
 *
 * The single-order endpoint demonstrates how an object reference can be
 * dereferenced without an ownership check.  In `development` / `testing` the
 * lookup is performed by primary key only; in `secure` mode the same endpoint
 * is scoped to the signed-in account, and the difference is a single line.
 *
 * The hardened variant is also reachable at `GET /api/orders/:id/secure` in
 * every mode.  See docs/security-testing.md.
 */

const config = require('../config/env');
const orderService = require('../services/orderService');
const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/errors');
const logger = require('../utils/logger');

/** GET /api/orders */
const list = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;

  const result = await orderService.listOrdersForUser(req.user.id, {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    status: query.status ?? null,
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

/**
 * GET /api/orders/:id
 *
 * INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING (development and
 * testing modes only): the order is loaded by primary key with no check that it
 * belongs to the requesting account.  `GET /api/orders/:id/secure` below always
 * applies the ownership predicate.
 */
const detail = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) throw notFound('Order not found');

  const order = config.isSecureMode
    ? await orderService.getOrderForUser(orderId, req.user.id)
    : await orderService.getOrderById(orderId); // <- no ownership filter

  if (!order) throw notFound('Order not found');

  res.json({ success: true, data: { order } });
});

/** GET /api/orders/:id/secure - always scoped to the signed-in account. */
const detailSecure = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) throw notFound('Order not found');

  const order = await orderService.getOrderForUser(orderId, req.user.id);
  if (!order) throw notFound('Order not found');

  logger.debug('Order read via hardened path', { userId: req.user.id, orderId });

  res.json({ success: true, data: { order } });
});

/** POST /api/orders/:id/cancel */
const cancel = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  const result = await orderService.cancelOrder(orderId, { userId: req.user.id, isAdmin: false });
  res.json({ success: true, data: result });
});

module.exports = { list, detail, detailSecure, cancel };
