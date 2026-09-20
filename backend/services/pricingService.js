'use strict';

/**
 * Pricing rules for the storefront.
 *
 * All monetary values are handled as numbers rounded to two decimal places.
 * The authoritative calculation always happens on the server: the browser may
 * display a total, but it is never the value that is charged.
 */

const FREE_SHIPPING_THRESHOLD = 5000;
const STANDARD_SHIPPING_FEE = 99;

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Total price for a single line. */
function lineTotal(unitPrice, quantity) {
  return round(Number(unitPrice) * Number(quantity));
}

/** Sum of all line totals. */
function subtotal(lines) {
  return round(lines.reduce((sum, line) => sum + lineTotal(line.unitPrice, line.quantity), 0));
}

/** Shipping charge for a given order subtotal. */
function shippingFee(subtotalValue) {
  if (subtotalValue <= 0) return 0;
  return subtotalValue >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
}

/**
 * Produce the authoritative totals for a set of lines.
 * @returns {{subtotal: number, shippingFee: number, discount: number, total: number}}
 */
function summarise(lines, discount = 0) {
  const subtotalValue = subtotal(lines);
  const shipping = shippingFee(subtotalValue);
  const discountValue = round(discount);
  const total = round(Math.max(subtotalValue + shipping - discountValue, 0));
  return { subtotal: subtotalValue, shippingFee: shipping, discount: discountValue, total };
}

module.exports = {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  round,
  lineTotal,
  subtotal,
  shippingFee,
  summarise,
};
