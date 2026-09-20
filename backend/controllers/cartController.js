'use strict';

/** Shopping cart. Every operation is scoped to the signed-in account. */

const cartService = require('../services/cartService');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/cart */
const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.id);
  res.json({ success: true, data: { cart } });
});

/** POST /api/cart */
const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const cart = await cartService.addItem(req.user.id, productId, quantity ?? 1);
  res.status(201).json({ success: true, data: { cart } });
});

/** PUT /api/cart/:id */
const updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cart = await cartService.updateItem(req.user.id, Number(req.params.id), quantity);
  res.json({ success: true, data: { cart } });
});

/** DELETE /api/cart/:id */
const removeItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeItem(req.user.id, Number(req.params.id));
  res.json({ success: true, data: { cart } });
});

/** DELETE /api/cart */
const clear = asyncHandler(async (req, res) => {
  const cart = await cartService.clear(req.user.id);
  res.json({ success: true, data: { cart } });
});

module.exports = { getCart, addItem, updateItem, removeItem, clear };
