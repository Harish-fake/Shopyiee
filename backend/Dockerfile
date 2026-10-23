# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
#  ShopSphere API - Node.js + Express
#
#  This image is self-contained: it carries MariaDB for the deliberately
#  vulnerable sandbox so that the public demo does not depend on an external
#  managed database that can expire.  MariaDB listens on loopback only; the
#  Express API is the only exposed process.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS dependencies

WORKDIR /app

# Install dependencies first so that Docker can cache this layer across
# application-code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=5000 \
    DB_HOST=127.0.0.1 \
    DB_PORT=3306 \
    DB_NAME=shopping_store \
    DB_USER=shop_app \
    NODE_OPTIONS=--max-old-space-size=192

WORKDIR /app

# curl: container healthcheck.  tini: signal handling.  mariadb/mariadb-client:
# the bundled database.  su-exec: start the API as the unprivileged user.
RUN apk add --no-cache curl tini mariadb mariadb-client su-exec \
 && mkdir -p /var/lib/shopsphere-mysql /run/mysqld \
 && chown -R mysql:mysql /var/lib/shopsphere-mysql /run/mysqld

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN addgroup -S shopsphere \
 && adduser -S shopsphere -G shopsphere \
 && chown -R shopsphere:shopsphere /app \
 && chmod +x /app/docker-entrypoint.sh

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
  CMD curl -fsS http://127.0.0.1:5000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]