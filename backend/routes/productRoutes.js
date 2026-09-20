'use strict';

const express = require('express');
const productController = require('../controllers/productController');
const { validate } = require('../middleware/validate');
const { asInt } = require('../utils/validators');

const router = express.Router();

/** Shared coercion for catalogue filters. */
const listQuery = {
  page: (value) => (value === undefined ? 1 : asInt(value, 'page', { min: 1, max: 10000 })),
  limit: (value) => (value === undefined ? 12 : asInt(value, 'limit', { min: 1, max: 60 })),
  categoryId: (value) => (value === undefined || value === '' ? null : asInt(value, 'categoryId', { min: 1 })),
  sort: (value) =>
    ['newest', 'oldest', 'price-asc', 'price-desc', 'rating-desc', 'name-asc'].includes(value)
      ? value
      : 'newest',
};

router.get('/', validate({ query: listQuery }), productController.list);

router.get('/featured', productController.featured);
router.get('/new-arrivals', productController.newArrivals);
router.get('/top-rated', productController.topRated);

/**
 * Catalogue search.
 *
 * The storefront calls /search.  /search-safe always runs the parameterised
 * implementation, so both can be exercised in any mode.
 *
 * Note: these routes are declared before `/:id` so that "search" is never
 * interpreted as a product identifier.
 */
router.get('/search', productController.search);
router.get('/search-safe', productController.searchSafe);

router.get('/:id', productController.detail);

module.exports = router;
