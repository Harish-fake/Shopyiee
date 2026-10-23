-- ---------------------------------------------------------------------------
-- Application database account
--
--   Run this AFTER database/schema.sql on a server you administer yourself
--   (a local instance, a VPS, or the MySQL container in docker-compose.yml).
--
--   It is a separate file from schema.sql because managed MySQL providers
--   (Aiven, PlanetScale, and similar) create the account for you and do not
--   permit CREATE USER or GRANT.  On those hosts, skip this file entirely.
--   See docs/deployment.md.
--
--   The password placeholder below is substituted at container start-up by
--   docker/mysql/init/01-schema-and-seed.sh using the DB_PASSWORD environment
--   variable, and by `npm run db:init` using the value from .env.
--
--   The application never connects as root.  It is granted DML only: it can
--   read and write rows, but it cannot create, alter or drop tables, and it
--   cannot grant privileges.  That limits what a query-injection flaw could
--   reach - it cannot restructure the schema or escalate itself.
-- ---------------------------------------------------------------------------

CREATE USER IF NOT EXISTS 'shop_app'@'%' IDENTIFIED BY 'change_me_app_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON `shopping_store`.* TO 'shop_app'@'%';
FLUSH PRIVILEGES;
