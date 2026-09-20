'use strict';

/**
 * API route table.  Everything is mounted under `/api`.
 *
 *   /api/auth/*
 *   /api/products/*        (includes /search and /search-safe)
 *   /api/categories/*
 *   /api/cart/*
 *   /api/orders/*
 *   /api/reviews/*
 *   /api/wishlist/*
 *   /api/wallet/*
 *   /api/checkout/*        (plus POST /api/checkout-secure)
 *   /api/admin/*
 */

const express = require('express');
const config = require('../config/env');

const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const cartRoutes = require('./cartRoutes');
const orderRoutes = require('./orderRoutes');
const reviewRoutes = require('./reviewRoutes');
const wishlistRoutes = require('./wishlistRoutes');
const walletRoutes = require('./walletRoutes');
const checkoutRoutes = require('./checkoutRoutes');
const adminRoutes = require('./adminRoutes');

const checkoutController = require('../controllers/checkoutController');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

/** Liveness probe. */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'shopsphere-api',
      time: new Date().toISOString(),
      // The active mode is reported outside production-like configurations
      // only; it is operational information, not part of the storefront.
      ...(config.isProductionLike ? {} : { mode: config.appMode }),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/wallet', walletRoutes);
router.use('/checkout', checkoutRoutes);

/**
 * Hardened checkout.  Available in every mode so that the parameterised,
 * server-priced implementation can be exercised alongside the standard route.
 * See docs/security-testing.md.
 */
router.post('/checkout-secure', requireAuth, csrfProtection(), checkoutController.checkoutSecure);

router.use('/admin', adminRoutes);

module.exports = router;
