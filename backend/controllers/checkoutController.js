'use strict';

/**
 * Checkout endpoints.
 *
 *   POST /api/checkout          - the route the storefront calls.  The pricing
 *                                 implementation is selected by APP_MODE.
 *   POST /api/checkout-secure   - always prices the order from MySQL.  Present
 *                                 in every mode so the two behaviours can be
 *                                 compared directly.
 *   POST /api/checkout/preview  - read-only totals for the order summary shown
 *                                 on the checkout page.
 *
 * See docs/security-testing.md.
 */

const config = require('../config/env');
const cartService = require('../services/cartService');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

function resolveCheckout() {
  return config.isSecureMode
    ? require('../secure/secureCheckout')
    : require('../vulnerabilities/vulnerableCheckout');
}

/** Fall back to the stored cart when the client sends no item list. */
async function resolveItems(req) {
  const submitted = req.body?.items;

  if (Array.isArray(submitted) && submitted.length > 0) {
    return submitted.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      // Present on the request but ignored by the hardened implementation.
      price: item.price,
    }));
  }

  const cart = await cartService.getCart(req.user.id);
  if (!cart.items.length) throw badRequest('Your cart is empty');

  return cart.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    price: item.unitPrice,
  }));
}

/** POST /api/checkout */
const checkout = asyncHandler(async (req, res) => {
  const implementation = resolveCheckout();
  const items = await resolveItems(req);

  const order = await implementation.checkout({
    userId: req.user.id,
    items,
    total: req.body?.total,
    shippingFee: req.body?.shippingFee,
    shipping: req.body?.shipping ?? {},
    notes: req.body?.notes ?? null,
  });

  res.status(201).json({ success: true, data: { order } });
});

/** POST /api/checkout-secure */
const checkoutSecure = asyncHandler(async (req, res) => {
  const secureCheckout = require('../secure/secureCheckout');
  const items = await resolveItems(req);

  const order = await secureCheckout.checkout({
    userId: req.user.id,
    items,
    shipping: req.body?.shipping ?? {},
    notes: req.body?.notes ?? null,
  });

  res.status(201).json({ success: true, data: { order } });
});

/**
 * POST /api/checkout/preview
 * Returns the totals the server would charge. Used to render the order summary.
 */
const preview = asyncHandler(async (req, res) => {
  const secureCheckout = require('../secure/secureCheckout');
  const items = await resolveItems(req);

  // `normaliseItems` validates ids and quantities without writing anything.
  const normalised = secureCheckout.normaliseItems(items);
  const pricing = require('../services/pricingService');
  const { query } = require('../config/db');

  const placeholders = normalised.map(() => '?').join(', ');
  const rows = await query(
    `SELECT id, name, image, price, stock FROM products WHERE id IN (${placeholders})`,
    normalised.map((item) => item.productId)
  );

  const catalogue = new Map(rows.map((row) => [row.id, row]));

  const lines = normalised.map((item) => {
    const product = catalogue.get(item.productId);
    const unitPrice = product ? pricing.round(Number.parseFloat(product.price)) : 0;
    return {
      productId: item.productId,
      productName: product?.name ?? null,
      productImage: product?.image ?? null,
      unitPrice,
      quantity: item.quantity,
      lineTotal: pricing.lineTotal(unitPrice, item.quantity),
      stock: product?.stock ?? 0,
      available: Boolean(product) && product.stock >= item.quantity,
    };
  });

  const totals = pricing.summarise(lines);

  res.json({
    success: true,
    data: { lines, ...totals, freeShippingThreshold: pricing.FREE_SHIPPING_THRESHOLD },
  });
});

module.exports = { checkout, checkoutSecure, preview };
