'use strict';

/**
 * Keeps the denormalised `rating` / `review_count` columns on `products` in
 * step with the `reviews` table.  Shared by both the standard and hardened
 * review paths - it contains no rendering logic.
 */

const { pool } = require('../config/db');

async function recalculateProductRating(productId, connection = pool) {
  await connection.execute(
    `UPDATE products p
     LEFT JOIN (
       SELECT product_id, COUNT(*) AS total, ROUND(AVG(rating), 2) AS average
       FROM reviews
       WHERE product_id = ?
       GROUP BY product_id
     ) r ON r.product_id = p.id
     SET p.review_count = COALESCE(r.total, 0),
         p.rating = COALESCE(r.average, 0.00)
     WHERE p.id = ?`,
    [productId, productId]
  );
}

module.exports = { recalculateProductRating };
