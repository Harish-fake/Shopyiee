'use strict';

const express = require('express');
const categoryController = require('../controllers/categoryController');
const { validate } = require('../middleware/validate');
const { asInt } = require('../utils/validators');

const router = express.Router();

router.get('/', categoryController.list);

router.get('/:id', categoryController.detail);

router.get(
  '/:id/products',
  validate({
    query: {
      page: (value) => (value === undefined ? 1 : asInt(value, 'page', { min: 1, max: 10000 })),
      limit: (value) => (value === undefined ? 12 : asInt(value, 'limit', { min: 1, max: 60 })),
      sort: (value) =>
        ['newest', 'oldest', 'price-asc', 'price-desc', 'rating-desc', 'name-asc'].includes(value)
          ? value
          : 'newest',
    },
  }),
  categoryController.products
);

module.exports = router;
