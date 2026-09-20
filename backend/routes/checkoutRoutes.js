'use strict';

const express = require('express');
const checkoutController = require('../controllers/checkoutController');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { writeLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(requireAuth);

/**
 * Read-only totals for the order summary.
 * Declared before the bare POST so the literal segment matches first.
 */
router.post('/preview', csrfProtection(), checkoutController.preview);

/**
 * Place an order.
 *
 * The request may carry `items[].price` and `total` - the storefront sends the
 * prices it displayed.  Whether those values are honoured depends on APP_MODE;
 * see docs/security-testing.md.
 */
router.post('/', writeLimiter, csrfProtection(), checkoutController.checkout);

module.exports = router;
