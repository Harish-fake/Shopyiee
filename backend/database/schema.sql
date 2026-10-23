-- ===========================================================================
--  ShopSphere - MySQL schema
--  Database : shopping_store
--  Engine   : InnoDB (all tables) / utf8mb4
--
--  This file is idempotent.  It is executed automatically the first time the
--  MySQL container starts (mounted into /docker-entrypoint-initdb.d) and can
--  also be applied manually:
--
--      mysql -h 127.0.0.1 -P 3306 -u root -p < database/schema.sql
--
--  Relationships
--  -------------
--      users ─┬─< cart_items >─┬─ products ─┬─< order_items
--             ├─< orders ──────┘            ├─< reviews
--             ├─< reviews ──────────────────┤
--             ├─< wishlist ─────────────────┘
--             └─< transactions
--
--      products >── categories
--      sessions (server-side session store, not related to users by FK)
-- ===========================================================================

CREATE DATABASE IF NOT EXISTS `shopping_store`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `shopping_store`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `wishlist`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE `users` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`           VARCHAR(120)  NOT NULL,
  `email`          VARCHAR(190)  NOT NULL,
  `password_hash`  VARCHAR(255)  NOT NULL,
  `role`           ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  `wallet_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `phone`          VARCHAR(30)   DEFAULT NULL,
  `address_line`   VARCHAR(255)  DEFAULT NULL,
  `city`           VARCHAR(80)   DEFAULT NULL,
  `state`          VARCHAR(80)   DEFAULT NULL,
  `postal_code`    VARCHAR(20)   DEFAULT NULL,
  `country`        VARCHAR(80)   NOT NULL DEFAULT 'India',
  `is_active`      TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE `categories` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(120) NOT NULL,
  `slug`        VARCHAR(140) NOT NULL,
  `description` TEXT,
  `image`       VARCHAR(255) DEFAULT NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE `products` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`           VARCHAR(200) NOT NULL,
  `slug`           VARCHAR(220) NOT NULL,
  `description`    TEXT,
  `brand`          VARCHAR(100) DEFAULT NULL,
  `price`          DECIMAL(12,2) NOT NULL,
  `original_price` DECIMAL(12,2) DEFAULT NULL,
  `stock`          INT NOT NULL DEFAULT 0,
  `category_id`    INT UNSIGNED NOT NULL,
  `image`          VARCHAR(255) DEFAULT NULL,
  `rating`         DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `review_count`   INT NOT NULL DEFAULT 0,
  `is_featured`    TINYINT(1) NOT NULL DEFAULT 0,
  `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_price` (`price`),
  KEY `idx_products_featured` (`is_featured`),
  CONSTRAINT `fk_products_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- cart_items  (database-backed cart - one row per user/product pair)
-- ---------------------------------------------------------------------------
CREATE TABLE `cart_items` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `quantity`   INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart_user_product` (`user_id`, `product_id`),
  KEY `idx_cart_product` (`product_id`),
  CONSTRAINT `fk_cart_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cart_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE `orders` (
  `id`                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`              INT UNSIGNED NOT NULL,
  `order_number`         VARCHAR(40) NOT NULL,
  `subtotal`             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `shipping_fee`         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount`             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total`                DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status`               ENUM('PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED')
                         NOT NULL DEFAULT 'PENDING',
  `payment_status`       ENUM('PENDING','PAID','REFUNDED','FAILED')
                         NOT NULL DEFAULT 'PENDING',
  `shipping_name`        VARCHAR(120) DEFAULT NULL,
  `shipping_phone`       VARCHAR(30)  DEFAULT NULL,
  `shipping_address`     VARCHAR(255) DEFAULT NULL,
  `shipping_city`        VARCHAR(80)  DEFAULT NULL,
  `shipping_state`       VARCHAR(80)  DEFAULT NULL,
  `shipping_postal_code` VARCHAR(20)  DEFAULT NULL,
  `notes`                VARCHAR(255) DEFAULT NULL,
  `created_at`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_number` (`order_number`),
  KEY `idx_orders_user` (`user_id`),
  KEY `idx_orders_status` (`status`),
  CONSTRAINT `fk_orders_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- order_items  (line items; product_name/unit_price are snapshotted at
--               purchase time so historical orders stay accurate)
-- ---------------------------------------------------------------------------
CREATE TABLE `order_items` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`      INT UNSIGNED NOT NULL,
  `product_id`    INT UNSIGNED DEFAULT NULL,
  `product_name`  VARCHAR(200) NOT NULL,
  `product_image` VARCHAR(255) DEFAULT NULL,
  `unit_price`    DECIMAL(12,2) NOT NULL,
  `quantity`      INT NOT NULL,
  `line_total`    DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  CONSTRAINT `fk_order_items_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE `reviews` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` INT UNSIGNED NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `rating`     TINYINT NOT NULL DEFAULT 5,
  `title`      VARCHAR(160) DEFAULT NULL,
  `comment`    TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_user_product` (`user_id`, `product_id`),
  KEY `idx_reviews_product` (`product_id`),
  CONSTRAINT `fk_reviews_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reviews_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- wishlist
-- ---------------------------------------------------------------------------
CREATE TABLE `wishlist` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wishlist_user_product` (`user_id`, `product_id`),
  KEY `idx_wishlist_product` (`product_id`),
  CONSTRAINT `fk_wishlist_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wishlist_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- transactions  (simulated wallet ledger - no real money is ever involved)
-- ---------------------------------------------------------------------------
CREATE TABLE `transactions` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED NOT NULL,
  `order_id`      INT UNSIGNED DEFAULT NULL,
  `type`          ENUM('DEPOSIT','PURCHASE','REFUND','ADJUSTMENT') NOT NULL,
  `amount`        DECIMAL(12,2) NOT NULL,
  `balance_after` DECIMAL(12,2) NOT NULL,
  `description`   VARCHAR(255) DEFAULT NULL,
  `reference`     VARCHAR(60)  DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tx_user` (`user_id`),
  KEY `idx_tx_type` (`type`),
  KEY `idx_tx_order` (`order_id`),
  CONSTRAINT `fk_tx_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tx_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- sessions  (server-side session store backing the HTTP-only session cookie)
-- ---------------------------------------------------------------------------
CREATE TABLE `sessions` (
  `session_id` VARCHAR(128) NOT NULL,
  `expires`    BIGINT UNSIGNED NOT NULL,
  `data`       MEDIUMTEXT,
  PRIMARY KEY (`session_id`),
  KEY `idx_sessions_expires` (`expires`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- This file is pure DDL on purpose: it creates the database and its tables and
-- nothing else, so it can be applied to any MySQL-compatible server, including
-- managed hosts where creating users and granting privileges is not permitted.
--
-- The application's own database account is created separately:
--
--   self-hosted / Docker : database/grants.sql
--   managed (Aiven, etc.): the provider creates the account; see
--                          docs/deployment.md
--
-- Sample data lives in database/seed.sql.
-- ---------------------------------------------------------------------------

