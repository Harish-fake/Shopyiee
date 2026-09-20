-- ===========================================================================
--  ShopSphere - sample data set
--
--  Everything in this file is fabricated.  The catalogue, the customers, the
--  orders, the reviews and the wallet ledger are all invented for demonstration
--  purposes.  No real people, payment instruments or financial systems are
--  involved - wallet balances are a self-contained simulation stored in MySQL.
--
--  The two account passwords below are demo credentials for a local-only
--  application.  They are intentionally published in the README so that the
--  project can be evaluated; they must never be reused anywhere else.
--
--      administrator : admin@shopsphere.test  / AdminDemo#2024
--      customer      : priya@example.test     / UserDemo#2024
--
-- ===========================================================================

USE `shopping_store`;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `order_items`;
TRUNCATE TABLE `transactions`;
TRUNCATE TABLE `wishlist`;
TRUNCATE TABLE `reviews`;
TRUNCATE TABLE `orders`;
TRUNCATE TABLE `cart_items`;
TRUNCATE TABLE `products`;
TRUNCATE TABLE `categories`;
TRUNCATE TABLE `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
INSERT INTO `users`
  (`id`, `name`, `email`, `password_hash`, `role`, `wallet_balance`, `phone`, `address_line`, `city`, `state`, `postal_code`, `country`, `created_at`)
VALUES
  (1, 'Aarav Menon',   'admin@shopsphere.test', '$2a$10$Wy4Yvwb5yR8VAQTCwcohsuro3jtGLEvdxieza.UT/Aqa9w4abhkxW', 'ADMIN', 25000.00, '+91 98450 11001', '12 Brigade Road',        'Bengaluru', 'Karnataka',   '560001', 'India', DATE_SUB(NOW(), INTERVAL 400 DAY)),
  (2, 'Priya Nair',    'priya@example.test',    '$2a$10$4DXNRxoFbuXP.tvo70j1/.V.ozTFye11na98cD/G5JFJ1cjU6haZy', 'USER',  12806.00, '+91 98450 11002', '48 MG Road, Flat 3B',    'Bengaluru', 'Karnataka',   '560025', 'India', DATE_SUB(NOW(), INTERVAL 320 DAY)),
  (3, 'Arjun Sharma',  'arjun@example.test',    '$2a$10$4DXNRxoFbuXP.tvo70j1/.V.ozTFye11na98cD/G5JFJ1cjU6haZy', 'USER',  20702.00, '+91 98450 11003', '221 Linking Road',       'Mumbai',    'Maharashtra', '400050', 'India', DATE_SUB(NOW(), INTERVAL 275 DAY)),
  (4, 'Meera Iyer',    'meera@example.test',    '$2a$10$4DXNRxoFbuXP.tvo70j1/.V.ozTFye11na98cD/G5JFJ1cjU6haZy', 'USER',  13502.00, '+91 98450 11004', '77 Anna Salai',          'Chennai',   'Tamil Nadu',  '600002', 'India', DATE_SUB(NOW(), INTERVAL 210 DAY)),
  (5, 'Rohit Verma',   'rohit@example.test',    '$2a$10$4DXNRxoFbuXP.tvo70j1/.V.ozTFye11na98cD/G5JFJ1cjU6haZy', 'USER',  16003.00, '+91 98450 11005', '9 Park Street',          'Kolkata',   'West Bengal', '700016', 'India', DATE_SUB(NOW(), INTERVAL 150 DAY)),
  (6, 'Sana Qureshi',  'sana@example.test',     '$2a$10$4DXNRxoFbuXP.tvo70j1/.V.ozTFye11na98cD/G5JFJ1cjU6haZy', 'USER',  20000.00, '+91 98450 11006', '301 Banjara Hills',      'Hyderabad', 'Telangana',   '500034', 'India', DATE_SUB(NOW(), INTERVAL 90 DAY));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
INSERT INTO `categories` (`id`, `name`, `slug`, `description`, `image`) VALUES
  (1, 'Electronics',      'electronics',      'Televisions, audio equipment, cameras and everyday smart devices.',            '/images/categories/electronics.jpg'),
  (2, 'Laptops',          'laptops',          'Ultrabooks, business machines, gaming rigs and creator workstations.',          '/images/categories/laptops.jpg'),
  (3, 'Smartphones',      'smartphones',      'Flagship, mid-range and rugged phones with the latest connectivity.',           '/images/categories/smartphones.jpg'),
  (4, 'Accessories',      'accessories',      'Keyboards, storage, chargers, hubs and everything that completes a setup.',     '/images/categories/accessories.jpg'),
  (5, 'Gaming',           'gaming',           'Mice, headsets, monitors and furniture built for long sessions.',               '/images/categories/gaming.jpg'),
  (6, 'Home Appliances',  'home-appliances',  'Kitchen and household appliances for a smarter home.',                          '/images/categories/home-appliances.jpg'),
  (7, 'Fashion',          'fashion',          'Footwear, outerwear, bags and accessories for everyday wear.',                  '/images/categories/fashion.jpg');

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
INSERT INTO `products`
  (`id`, `name`, `slug`, `description`, `brand`, `price`, `original_price`, `stock`, `category_id`, `image`, `is_featured`, `created_at`)
VALUES
  -- Electronics
  (1,  'Aurora 55" 4K Ultra HD Smart TV', 'aurora-55-4k-smart-tv', 'A 55-inch 4K panel with HDR10+, a 120 Hz refresh rate and a built-in voice assistant. Three HDMI 2.1 ports make it a natural fit for consoles.', 'Aurora', 44999.00, 52999.00, 24, 1, '/images/products/aurora-55-4k-smart-tv.jpg', 1, DATE_SUB(NOW(), INTERVAL 380 DAY)),
  (2,  'Nimbus ANC Wireless Headphones',  'nimbus-anc-headphones', 'Over-ear headphones with hybrid active noise cancellation, 40-hour battery life and multipoint Bluetooth pairing.', 'Nimbus', 8999.00, 11999.00, 65, 1, '/images/products/nimbus-anc-headphones.jpg', 1, DATE_SUB(NOW(), INTERVAL 360 DAY)),
  (3,  'Pulse 360° Bluetooth Speaker',    'pulse-bluetooth-speaker', 'A compact IPX7 speaker that pushes sound in every direction. Pairs with a second unit for true stereo.', 'Pulse', 3499.00, 4499.00, 88, 1, '/images/products/pulse-bluetooth-speaker.jpg', 0, DATE_SUB(NOW(), INTERVAL 340 DAY)),
  (4,  'Zenith Smart Watch Series 6',     'zenith-smart-watch', 'AMOLED always-on display, SpO2 and heart-rate tracking, 5 ATM water resistance and a 10-day battery.', 'Zenith', 12999.00, 15999.00, 42, 1, '/images/products/zenith-smart-watch.jpg', 1, DATE_SUB(NOW(), INTERVAL 330 DAY)),
  (5,  'Orbit 4K Action Camera',          'orbit-action-camera', 'Shoots 4K60 with electronic stabilisation, ships with a waterproof housing rated to 40 m.', 'Orbit', 15999.00, 18999.00, 18, 1, '/images/products/orbit-action-camera.jpg', 0, DATE_SUB(NOW(), INTERVAL 300 DAY)),
  (6,  'Lumen X20 Mirrorless Camera',     'lumen-mirrorless-camera', '24 MP APS-C sensor, 4K video and a flip-out touchscreen. Includes an 18-55 mm kit lens.', 'Lumen', 62999.00, 71999.00, 9, 1, '/images/products/lumen-mirrorless-camera.jpg', 0, DATE_SUB(NOW(), INTERVAL 280 DAY)),

  -- Laptops
  (7,  'Stratos UltraBook 14 (16GB / 512GB)', 'stratos-ultrabook-14', 'A 1.2 kg magnesium chassis with a 14-inch 2.8K display, 16 GB of RAM and a 512 GB NVMe drive. Charges over USB-C.', 'Stratos', 74999.00, 84999.00, 15, 2, '/images/products/stratos-ultrabook-14.jpg', 1, DATE_SUB(NOW(), INTERVAL 370 DAY)),
  (8,  'Titan Gaming Laptop 15 (RTX / 32GB)', 'titan-gaming-laptop-15', '15.6-inch 165 Hz QHD panel, discrete RTX graphics, 32 GB DDR5 and a vapour-chamber cooling system.', 'Titan', 129999.00, 149999.00, 8, 2, '/images/products/titan-gaming-laptop-15.jpg', 1, DATE_SUB(NOW(), INTERVAL 355 DAY)),
  (9,  'Vector Business Laptop 13',       'vector-business-13', 'A 13.3-inch business machine with a spill-resistant keyboard, TPM 2.0 and a fingerprint reader.', 'Vector', 58999.00, 64999.00, 22, 2, '/images/products/vector-business-13.jpg', 0, DATE_SUB(NOW(), INTERVAL 320 DAY)),
  (10, 'Flex 2-in-1 Convertible Laptop',  'flex-2in1-convertible', 'A 360-degree hinge, an active stylus and a 14-inch touchscreen. Folds flat for sketching.', 'Flex', 66999.00, 74999.00, 12, 2, '/images/products/flex-2in1-convertible.jpg', 0, DATE_SUB(NOW(), INTERVAL 260 DAY)),
  (11, 'Creator Pro 16 Studio Laptop',    'creator-pro-16', 'A colour-calibrated 16-inch 4K display, 64 GB of RAM and a 2 TB drive for editing on the move.', 'Creator', 159999.00, 179999.00, 6, 2, '/images/products/creator-pro-16.jpg', 0, DATE_SUB(NOW(), INTERVAL 200 DAY)),
  (12, 'Breeze Chromebook 11',            'breeze-chromebook-11', 'An 11.6-inch cloud-first laptop with a 14-hour battery and a fanless design.', 'Breeze', 24999.00, 28999.00, 30, 2, '/images/products/breeze-chromebook-11.jpg', 0, DATE_SUB(NOW(), INTERVAL 180 DAY)),

  -- Smartphones
  (13, 'Apex Pro Max 5G (256GB)',         'apex-pro-max', 'A 6.8-inch LTPO display, a triple 50 MP camera system and titanium rails. Seven years of OS updates.', 'Apex', 89999.00, 99999.00, 20, 3, '/images/products/apex-pro-max.jpg', 1, DATE_SUB(NOW(), INTERVAL 350 DAY)),
  (14, 'Nova Neo 5G (128GB)',             'nova-neo-5g', 'A 6.5-inch 120 Hz AMOLED phone with a 5000 mAh battery and 67 W fast charging.', 'Nova', 27999.00, 31999.00, 55, 3, '/images/products/nova-neo-5g.jpg', 1, DATE_SUB(NOW(), INTERVAL 300 DAY)),
  (15, 'Pulse Lite 4G (64GB)',            'pulse-lite-4g', 'A dependable everyday phone with a 6.1-inch display, dual SIM and expandable storage.', 'Pulse', 11999.00, 13999.00, 90, 3, '/images/products/pulse-lite-4g.jpg', 0, DATE_SUB(NOW(), INTERVAL 290 DAY)),
  (16, 'Fold X Flip 5G',                  'fold-x-flip', 'A compact flip foldable with a 6.7-inch main display, a cover screen and IPX8 water resistance.', 'Apex', 149999.00, 164999.00, 5, 3, '/images/products/fold-x-flip.jpg', 0, DATE_SUB(NOW(), INTERVAL 160 DAY)),
  (17, 'Terra Rugged 5G',                 'terra-rugged-5g', 'MIL-STD-810H tested, IP68 rated and built with a user-replaceable battery for field work.', 'Terra', 34999.00, 39999.00, 14, 3, '/images/products/terra-rugged-5g.jpg', 0, DATE_SUB(NOW(), INTERVAL 140 DAY)),

  -- Accessories
  (18, 'Clack TKL Mechanical Keyboard',   'clack-mechanical-keyboard', 'A tenkeyless hot-swappable board with tactile switches, PBT keycaps and per-key backlighting.', 'Clack', 5499.00, 6999.00, 74, 4, '/images/products/clack-mechanical-keyboard.jpg', 1, DATE_SUB(NOW(), INTERVAL 330 DAY)),
  (19, 'Glide Wireless Mouse',            'glide-wireless-mouse', 'A 2.4 GHz and Bluetooth mouse with a silent click and a 12-month battery life.', 'Glide', 1799.00, 2299.00, 120, 4, '/images/products/glide-wireless-mouse.jpg', 0, DATE_SUB(NOW(), INTERVAL 320 DAY)),
  (20, 'Port 9-in-1 USB-C Hub',           'port-usbc-hub-9in1', 'Adds HDMI 4K60, gigabit ethernet, SD/microSD readers, three USB-A ports and 100 W pass-through charging.', 'Port', 2999.00, 3799.00, 96, 4, '/images/products/port-usbc-hub-9in1.jpg', 1, DATE_SUB(NOW(), INTERVAL 310 DAY)),
  (21, 'Vault Portable SSD 1TB',          'vault-portable-ssd-1tb', 'A pocket-sized USB 3.2 Gen 2 drive delivering 1050 MB/s reads with hardware encryption.', 'Vault', 8499.00, 9999.00, 40, 4, '/images/products/vault-portable-ssd-1tb.jpg', 0, DATE_SUB(NOW(), INTERVAL 300 DAY)),
  (22, 'Core 16GB DDR5 RAM Kit',          'core-ram-16gb-ddr5', 'A matched 2x8 GB DDR5-5600 kit with an aluminium heat spreader and a lifetime warranty.', 'Core', 6299.00, 7499.00, 58, 4, '/images/products/core-ram-16gb-ddr5.jpg', 0, DATE_SUB(NOW(), INTERVAL 280 DAY)),
  (23, 'Volt 65W GaN Fast Charger',       'volt-65w-gan-charger', 'A gallium-nitride charger with two USB-C ports and one USB-A port, small enough for a jacket pocket.', 'Volt', 2199.00, 2799.00, 130, 4, '/images/products/volt-65w-gan-charger.jpg', 0, DATE_SUB(NOW(), INTERVAL 270 DAY)),
  (24, 'Shield 14" Laptop Sleeve',        'shield-laptop-sleeve-14', 'A water-resistant felt sleeve with a magnetic closure and a separate accessory pocket.', 'Shield', 1299.00, 1699.00, 200, 4, '/images/products/shield-laptop-sleeve-14.jpg', 0, DATE_SUB(NOW(), INTERVAL 250 DAY)),
  (25, 'Focus 1080p Webcam with Mic',     'focus-1080p-webcam', 'A 1080p60 webcam with a dual noise-cancelling microphone array and a privacy shutter.', 'Focus', 3299.00, 3999.00, 64, 4, '/images/products/focus-1080p-webcam.jpg', 0, DATE_SUB(NOW(), INTERVAL 240 DAY)),
  (26, 'Vista 27" 4K IPS Monitor',        'vista-27-4k-monitor', 'A 27-inch 4K IPS panel covering 99% sRGB, with USB-C power delivery and an ergonomic stand.', 'Vista', 27999.00, 32999.00, 16, 4, '/images/products/vista-27-4k-monitor.jpg', 1, DATE_SUB(NOW(), INTERVAL 220 DAY)),
  (27, 'Amp 20000mAh Power Bank',         'amp-power-bank-20000', 'Charges three devices at once with 22.5 W output and a digital charge indicator.', 'Amp', 2499.00, 2999.00, 110, 4, '/images/products/amp-power-bank-20000.jpg', 0, DATE_SUB(NOW(), INTERVAL 200 DAY)),

  -- Gaming
  (28, 'Strike RGB Gaming Mouse',         'strike-gaming-mouse', 'A 26 000 DPI optical sensor, eight programmable buttons and a lightweight honeycomb shell.', 'Strike', 3499.00, 4299.00, 82, 5, '/images/products/strike-gaming-mouse.jpg', 1, DATE_SUB(NOW(), INTERVAL 320 DAY)),
  (29, 'Echo 7.1 Surround Gaming Headset', 'echo-gaming-headset', 'Virtual 7.1 surround sound, a detachable boom microphone and memory-foam ear cushions.', 'Echo', 5999.00, 7499.00, 60, 5, '/images/products/echo-gaming-headset.jpg', 0, DATE_SUB(NOW(), INTERVAL 300 DAY)),
  (30, 'Throne Ergonomic Gaming Chair',   'throne-gaming-chair', 'A high-back chair with four-way lumbar support, a recline lock and cold-cure foam.', 'Throne', 18999.00, 23999.00, 11, 5, '/images/products/throne-gaming-chair.jpg', 0, DATE_SUB(NOW(), INTERVAL 260 DAY)),
  (31, 'Axis Pro Wireless Controller',    'axis-controller-pro', 'Hall-effect sticks, back paddles and a 40-hour battery. Works with PC and consoles.', 'Axis', 4999.00, 5999.00, 48, 5, '/images/products/axis-controller-pro.jpg', 0, DATE_SUB(NOW(), INTERVAL 230 DAY)),
  (32, 'Expanse XXL RGB Mousepad',        'expanse-rgb-mousepad', 'An 800x300 mm stitched cloth surface with a fourteen-zone light bar and a spill-resistant coating.', 'Expanse', 1599.00, 1999.00, 140, 5, '/images/products/expanse-rgb-mousepad.jpg', 0, DATE_SUB(NOW(), INTERVAL 210 DAY)),
  (33, 'Velocity 27" 144Hz Gaming Monitor', 'velocity-144hz-monitor', 'A 27-inch QHD VA panel at 144 Hz with 1 ms response time and FreeSync support.', 'Velocity', 21999.00, 25999.00, 19, 5, '/images/products/velocity-144hz-monitor.jpg', 1, DATE_SUB(NOW(), INTERVAL 190 DAY)),

  -- Home Appliances
  (34, 'Pure Air Purifier 400',           'pure-air-purifier', 'A HEPA H13 purifier covering 400 sq ft with a PM2.5 display and a silent night mode.', 'Pure', 13999.00, 16999.00, 26, 6, '/images/products/pure-air-purifier.jpg', 0, DATE_SUB(NOW(), INTERVAL 280 DAY)),
  (35, 'Sweep Robot Vacuum Cleaner',      'sweep-robot-vacuum', 'Laser navigation, a 2700 Pa suction motor and a self-emptying dock. Maps rooms automatically.', 'Sweep', 24999.00, 29999.00, 13, 6, '/images/products/sweep-robot-vacuum.jpg', 1, DATE_SUB(NOW(), INTERVAL 250 DAY)),
  (36, 'Warm 28L Convection Microwave',   'warm-microwave-28l', 'A 28-litre convection oven with a grill element, 101 auto-cook menus and a child lock.', 'Warm', 15999.00, 18999.00, 17, 6, '/images/products/warm-microwave-28l.jpg', 0, DATE_SUB(NOW(), INTERVAL 220 DAY)),
  (37, 'Brew Espresso Coffee Machine',    'brew-espresso-machine', 'A 15-bar pump machine with a steam wand, a pre-infusion cycle and a removable 1.8 L tank.', 'Brew', 11999.00, 14999.00, 21, 6, '/images/products/brew-espresso-machine.jpg', 0, DATE_SUB(NOW(), INTERVAL 200 DAY)),
  (38, 'Rapid 1.7L Electric Kettle',      'rapid-electric-kettle', 'A 1500 W stainless-steel kettle that boils in under five minutes with auto shut-off.', 'Rapid', 1899.00, 2499.00, 150, 6, '/images/products/rapid-electric-kettle.jpg', 0, DATE_SUB(NOW(), INTERVAL 180 DAY)),
  (39, 'Chill 340L Frost-Free Refrigerator', 'chill-refrigerator-340l', 'A three-door frost-free refrigerator with an inverter compressor and a convertible freezer.', 'Chill', 34999.00, 39999.00, 7, 6, '/images/products/chill-refrigerator-340l.jpg', 0, DATE_SUB(NOW(), INTERVAL 150 DAY)),

  -- Fashion
  (40, 'Trail Running Shoes',             'trail-running-shoes', 'Grippy lugged outsoles, a rock plate and a breathable engineered mesh upper.', 'Trail', 4499.00, 5999.00, 70, 7, '/images/products/trail-running-shoes.jpg', 1, DATE_SUB(NOW(), INTERVAL 260 DAY)),
  (41, 'Rugged Denim Jacket',             'rugged-denim-jacket', 'A mid-wash cotton denim jacket with a corduroy collar and reinforced stitching.', 'Rugged', 3299.00, 4299.00, 45, 7, '/images/products/rugged-denim-jacket.jpg', 0, DATE_SUB(NOW(), INTERVAL 240 DAY)),
  (42, 'Daily Cotton Crew T-Shirt',       'daily-cotton-tshirt', 'A 180 GSM combed-cotton tee with a ribbed crew neck. Available in eight colours.', 'Daily', 899.00, 1299.00, 260, 7, '/images/products/daily-cotton-tshirt.jpg', 0, DATE_SUB(NOW(), INTERVAL 220 DAY)),
  (43, 'Metro Leather Backpack',          'metro-leather-backpack', 'Full-grain leather, a padded 15-inch laptop sleeve and a hidden anti-theft pocket.', 'Metro', 5499.00, 6999.00, 38, 7, '/images/products/metro-leather-backpack.jpg', 0, DATE_SUB(NOW(), INTERVAL 200 DAY)),
  (44, 'Horizon Polarised Sunglasses',    'horizon-sunglasses', 'Polarised UV400 lenses in a lightweight acetate frame with spring hinges.', 'Horizon', 2299.00, 2999.00, 95, 7, '/images/products/horizon-sunglasses.jpg', 0, DATE_SUB(NOW(), INTERVAL 170 DAY)),
  (45, 'Classic Analog Watch',            'classic-analog-watch', 'A 40 mm stainless-steel case, sapphire crystal glass and a genuine leather strap.', 'Classic', 6999.00, 8999.00, 33, 7, '/images/products/classic-analog-watch.jpg', 0, DATE_SUB(NOW(), INTERVAL 140 DAY));

-- ---------------------------------------------------------------------------
-- cart_items  (live carts)
-- ---------------------------------------------------------------------------
INSERT INTO `cart_items` (`user_id`, `product_id`, `quantity`) VALUES
  (2, 18, 1),
  (2, 27, 2),
  (3, 33, 1),
  (6, 40, 1);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
INSERT INTO `orders`
  (`id`, `user_id`, `order_number`, `subtotal`, `shipping_fee`, `discount`, `total`, `status`, `payment_status`,
   `shipping_name`, `shipping_phone`, `shipping_address`, `shipping_city`, `shipping_state`, `shipping_postal_code`, `created_at`)
VALUES
  (1, 2, 'ORD-2026-100001', 77998.00, 0.00, 0.00, 77998.00, 'DELIVERED',  'PAID',     'Priya Nair',   '+91 98450 11002', '48 MG Road, Flat 3B',    'Bengaluru', 'Karnataka',   '560025', DATE_SUB(NOW(), INTERVAL 240 DAY)),
  (2, 2, 'ORD-2026-100002',  9097.00, 99.00, 0.00,  9196.00, 'SHIPPED',    'PAID',     'Priya Nair',   '+91 98450 11002', '48 MG Road, Flat 3B',    'Bengaluru', 'Karnataka',   '560025', DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (3, 3, 'ORD-2026-100003', 29298.00, 0.00, 0.00, 29298.00, 'PROCESSING', 'PAID',     'Arjun Sharma', '+91 98450 11003', '221 Linking Road',       'Mumbai',    'Maharashtra', '400050', DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (4, 3, 'ORD-2026-100004',  2697.00, 49.00, 0.00,  2746.00, 'PENDING',    'PENDING',  'Arjun Sharma', '+91 98450 11003', '221 Linking Road',       'Mumbai',    'Maharashtra', '400050', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (5, 4, 'ORD-2026-100005', 36498.00, 0.00, 0.00, 36498.00, 'DELIVERED',  'PAID',     'Meera Iyer',   '+91 98450 11004', '77 Anna Salai',          'Chennai',   'Tamil Nadu',  '600002', DATE_SUB(NOW(), INTERVAL 180 DAY)),
  (6, 5, 'ORD-2026-100006', 18999.00, 0.00, 0.00, 18999.00, 'CANCELLED',  'REFUNDED', 'Rohit Verma',  '+91 98450 11005', '9 Park Street',          'Kolkata',   'West Bengal', '700016', DATE_SUB(NOW(), INTERVAL 120 DAY)),
  (7, 5, 'ORD-2026-100007', 13997.00, 0.00, 0.00, 13997.00, 'DELIVERED',  'PAID',     'Rohit Verma',  '+91 98450 11005', '9 Park Street',          'Kolkata',   'West Bengal', '700016', DATE_SUB(NOW(), INTERVAL 60 DAY)),
  (8, 6, 'ORD-2026-100008', 13898.00, 0.00, 0.00, 13898.00, 'PENDING',    'PENDING',  'Sana Qureshi', '+91 98450 11006', '301 Banjara Hills',      'Hyderabad', 'Telangana',   '500034', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
INSERT INTO `order_items`
  (`order_id`, `product_id`, `product_name`, `product_image`, `unit_price`, `quantity`, `line_total`)
VALUES
  (1, 7,  'Stratos UltraBook 14 (16GB / 512GB)', 'stratos-ultrabook-14.svg', 74999.00, 1, 74999.00),
  (1, 20, 'Port 9-in-1 USB-C Hub',               'port-usbc-hub-9in1.svg',    2999.00, 1,  2999.00),

  (2, 18, 'Clack TKL Mechanical Keyboard',       'clack-mechanical-keyboard.svg', 5499.00, 1, 5499.00),
  (2, 19, 'Glide Wireless Mouse',                'glide-wireless-mouse.svg',      1799.00, 2, 3598.00),

  (3, 14, 'Nova Neo 5G (128GB)',                 'nova-neo-5g.svg',          27999.00, 1, 27999.00),
  (3, 24, 'Shield 14" Laptop Sleeve',            'shield-laptop-sleeve-14.svg', 1299.00, 1, 1299.00),

  (4, 42, 'Daily Cotton Crew T-Shirt',           'daily-cotton-tshirt.svg',     899.00, 3,  2697.00),

  (5, 26, 'Vista 27" 4K IPS Monitor',            'vista-27-4k-monitor.svg',  27999.00, 1, 27999.00),
  (5, 21, 'Vault Portable SSD 1TB',              'vault-portable-ssd-1tb.svg', 8499.00, 1,  8499.00),

  (6, 30, 'Throne Ergonomic Gaming Chair',       'throne-gaming-chair.svg',  18999.00, 1, 18999.00),

  (7, 2,  'Nimbus ANC Wireless Headphones',      'nimbus-anc-headphones.svg', 8999.00, 1,  8999.00),
  (7, 27, 'Amp 20000mAh Power Bank',             'amp-power-bank-20000.svg',  2499.00, 2,  4998.00),

  (8, 37, 'Brew Espresso Coffee Machine',        'brew-espresso-machine.svg', 11999.00, 1, 11999.00),
  (8, 38, 'Rapid 1.7L Electric Kettle',          'rapid-electric-kettle.svg',  1899.00, 1,  1899.00);

-- ---------------------------------------------------------------------------
-- reviews  (plain text - the stored-rendering behaviour is exercised at
--           runtime by posting new reviews through the API)
-- ---------------------------------------------------------------------------
INSERT INTO `reviews` (`product_id`, `user_id`, `rating`, `title`, `comment`, `created_at`) VALUES
  (7,  2, 5, 'Excellent machine for the price', 'Been using it for four months now. The keyboard is comfortable and the battery still lasts a full working day. Runs cool even with a dozen browser tabs open.', DATE_SUB(NOW(), INTERVAL 200 DAY)),
  (7,  4, 4, 'Great, but the speakers are weak', 'Performance and screen are both very good. The only letdown is the built-in speakers, which sound thin. Everything else is solid.', DATE_SUB(NOW(), INTERVAL 150 DAY)),
  (2,  5, 5, 'Noise cancellation is genuinely good', 'Wore these on a long flight and the engine drone almost disappeared. Comfortable for hours at a time.', DATE_SUB(NOW(), INTERVAL 50 DAY)),
  (2,  3, 4, 'Solid sound, slightly tight fit', 'Sound quality is very good for the price. They clamp a little firmly at first but loosen up after a week.', DATE_SUB(NOW(), INTERVAL 30 DAY)),
  (14, 3, 5, 'Superb value mid-ranger', 'The display is bright and smooth, and charging is very fast. Camera is decent in daylight.', DATE_SUB(NOW(), INTERVAL 90 DAY)),
  (14, 6, 4, 'Good phone, average low-light camera', 'Everything is snappy and the battery easily lasts a day. Low-light photos are the weak point.', DATE_SUB(NOW(), INTERVAL 40 DAY)),
  (18, 2, 5, 'Typing on this is a joy', 'Swapped the switches out in ten minutes with no soldering. Feels much more solid than the price suggests.', DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (18, 5, 4, 'Loud in a shared office', 'Great build and feel, but the tactile switches are louder than I expected. Worth it if you work alone.', DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (20, 2, 4, 'Does exactly what it promises', 'Drives a 4K monitor at 60 Hz without complaints and the ethernet port is a nice bonus.', DATE_SUB(NOW(), INTERVAL 210 DAY)),
  (26, 4, 5, 'Colours are accurate out of the box', 'Required almost no calibration for photo editing. USB-C charging of the laptop through the monitor is convenient.', DATE_SUB(NOW(), INTERVAL 170 DAY)),
  (21, 4, 5, 'Fast and tiny', 'Transfers a 20 GB folder in well under a minute. Stays cool during long copies.', DATE_SUB(NOW(), INTERVAL 160 DAY)),
  (28, 5, 5, 'Lightweight and precise', 'The sensor tracks perfectly and the honeycomb shell keeps it light. Software is easy to configure.', DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (33, 3, 4, 'Great for the price point', '144 Hz makes a real difference. Slight backlight bleed in the corners but not noticeable in games.', DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (1,  4, 5, 'Picture quality is outstanding', 'HDR content looks fantastic and the smart interface is quick. Setup took about ten minutes.', DATE_SUB(NOW(), INTERVAL 130 DAY)),
  (4,  6, 4, 'Good battery, decent tracking', 'Easily lasts a week between charges. Sleep tracking is roughly accurate compared to my old band.', DATE_SUB(NOW(), INTERVAL 70 DAY)),
  (35, 5, 4, 'Maps the house well', 'Navigation is reliable and it avoids the rug edges. The dock needs emptying about once a week.', DATE_SUB(NOW(), INTERVAL 35 DAY)),
  (40, 6, 5, 'Comfortable straight away', 'No break-in period needed. Grip is excellent on wet trails.', DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (42, 3, 3, 'Fine for the price', 'Fabric is soft but the fit runs slightly large. Order a size down if you prefer a closer cut.', DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (13, 5, 5, 'Best phone I have owned', 'The camera system is outstanding in every lighting condition and the screen is superb outdoors.', DATE_SUB(NOW(), INTERVAL 80 DAY)),
  (29, 6, 4, 'Comfortable for long sessions', 'Ear cushions stay comfortable for several hours. The microphone is clear on calls.', DATE_SUB(NOW(), INTERVAL 60 DAY)),
  (12, 4, 4, 'Perfect secondary machine', 'Starts in seconds and handles browsing and documents without trouble. Not for heavy software.', DATE_SUB(NOW(), INTERVAL 100 DAY)),
  (23, 2, 5, 'Replaced three chargers', 'Charges my laptop, phone and earbuds from a single plug. Barely gets warm.', DATE_SUB(NOW(), INTERVAL 55 DAY)),
  (38, 6, 4, 'Boils quickly and quietly', 'Does the job with no fuss. The lid is a little stiff to open at first.', DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (8,  3, 5, 'Handles everything I throw at it', 'Runs current titles at high settings without the fans becoming distracting. The screen is excellent.', DATE_SUB(NOW(), INTERVAL 75 DAY)),
  (27, 5, 4, 'Reliable travel companion', 'Charges my phone about four times over. Slightly heavy, but that is expected at this capacity.', DATE_SUB(NOW(), INTERVAL 28 DAY));

-- ---------------------------------------------------------------------------
-- wishlist
-- ---------------------------------------------------------------------------
INSERT INTO `wishlist` (`user_id`, `product_id`, `created_at`) VALUES
  (2, 13, DATE_SUB(NOW(), INTERVAL 30 DAY)),
  (2, 35, DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (3, 8,  DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (4, 11, DATE_SUB(NOW(), INTERVAL 14 DAY)),
  (4, 16, DATE_SUB(NOW(), INTERVAL 9 DAY)),
  (5, 33, DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (6, 45, DATE_SUB(NOW(), INTERVAL 3 DAY));

-- ---------------------------------------------------------------------------
-- transactions  (simulated wallet ledger)
-- ---------------------------------------------------------------------------
INSERT INTO `transactions` (`user_id`, `order_id`, `type`, `amount`, `balance_after`, `description`, `reference`, `created_at`) VALUES
  (1, NULL, 'DEPOSIT',  25000.00, 25000.00, 'Wallet opened',                        'TXN-OPEN-0001', DATE_SUB(NOW(), INTERVAL 400 DAY)),
  (2, NULL, 'DEPOSIT', 100000.00,100000.00, 'Wallet opened',                        'TXN-OPEN-0002', DATE_SUB(NOW(), INTERVAL 320 DAY)),
  (3, NULL, 'DEPOSIT',  50000.00, 50000.00, 'Wallet opened',                        'TXN-OPEN-0003', DATE_SUB(NOW(), INTERVAL 275 DAY)),
  (4, NULL, 'DEPOSIT',  50000.00, 50000.00, 'Wallet opened',                        'TXN-OPEN-0004', DATE_SUB(NOW(), INTERVAL 210 DAY)),
  (5, NULL, 'DEPOSIT',  30000.00, 30000.00, 'Wallet opened',                        'TXN-OPEN-0005', DATE_SUB(NOW(), INTERVAL 150 DAY)),
  (6, NULL, 'DEPOSIT',  20000.00, 20000.00, 'Wallet opened',                        'TXN-OPEN-0006', DATE_SUB(NOW(), INTERVAL  90 DAY)),

  (2, 1, 'PURCHASE', 77998.00, 22002.00, 'Payment for order ORD-2026-100001', 'TXN-PAY-100001', DATE_SUB(NOW(), INTERVAL 240 DAY)),
  (2, 2, 'PURCHASE',  9196.00, 12806.00, 'Payment for order ORD-2026-100002', 'TXN-PAY-100002', DATE_SUB(NOW(), INTERVAL  12 DAY)),

  (3, 3, 'PURCHASE', 29298.00, 20702.00, 'Payment for order ORD-2026-100003', 'TXN-PAY-100003', DATE_SUB(NOW(), INTERVAL   6 DAY)),

  (4, 5, 'PURCHASE', 36498.00, 13502.00, 'Payment for order ORD-2026-100005', 'TXN-PAY-100005', DATE_SUB(NOW(), INTERVAL 180 DAY)),

  (5, 6, 'PURCHASE', 18999.00, 11001.00, 'Payment for order ORD-2026-100006', 'TXN-PAY-100006', DATE_SUB(NOW(), INTERVAL 120 DAY)),
  (5, 6, 'REFUND',   18999.00, 30000.00, 'Refund for cancelled order ORD-2026-100006', 'TXN-REF-100006', DATE_SUB(NOW(), INTERVAL 118 DAY)),
  (5, 7, 'PURCHASE', 13997.00, 16003.00, 'Payment for order ORD-2026-100007', 'TXN-PAY-100007', DATE_SUB(NOW(), INTERVAL  60 DAY));

-- ---------------------------------------------------------------------------
-- Refresh the denormalised rating cache on products
-- ---------------------------------------------------------------------------
UPDATE `products` p
LEFT JOIN (
  SELECT `product_id`, COUNT(*) AS total, ROUND(AVG(`rating`), 2) AS average
  FROM `reviews`
  GROUP BY `product_id`
) r ON r.`product_id` = p.`id`
SET p.`review_count` = COALESCE(r.total, 0),
    p.`rating`       = COALESCE(r.average, 0.00);
