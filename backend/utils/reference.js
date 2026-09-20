'use strict';

/**
 * Human-readable reference generators for orders and wallet entries.
 * These identifiers are cosmetic - the primary keys remain numeric.
 */

const crypto = require('crypto');

function orderNumber() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomInt(100000, 999999);
  return `ORD-${year}-${suffix}`;
}

function transactionReference(prefix = 'TXN') {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = crypto.randomInt(1000, 9999);
  return `${prefix}-${stamp}-${suffix}`;
}

module.exports = { orderNumber, transactionReference };
