'use strict';

/** Wishlist endpoints. */

const wishlistService = require('../services/wishlistService');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/wishlist */
const list = asyncHandler(async (req, res) => {
  const items = await wishlistService.list(req.user.id);
  res.json({ success: true, data: { items, total: items.length } });
});

/** POST /api/wishlist */
const add = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const items = await wishlistService.add(req.user.id, productId);
  res.status(201).json({ success: true, data: { items, total: items.length } });
});

/** DELETE /api/wishlist/:productId */
const remove = asyncHandler(async (req, res) => {
  const items = await wishlistService.remove(req.user.id, Number(req.params.productId));
  res.json({ success: true, data: { items, total: items.length } });
});

/** POST /api/wishlist/:productId/move-to-cart */
const moveToCart = asyncHandler(async (req, res) => {
  const quantity = req.body?.quantity ?? 1;
  const result = await wishlistService.moveToCart(req.user.id, Number(req.params.productId), quantity);
  res.json({ success: true, data: result });
});

module.exports = { list, add, remove, moveToCart };
