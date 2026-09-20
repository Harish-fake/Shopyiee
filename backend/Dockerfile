# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
#  ShopSphere API - Node.js + Express
# ---------------------------------------------------------------------------
FROM node:22-alpine AS dependencies

WORKDIR /app

# Install dependencies first so that Docker can cache this layer across
# application-code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

# curl is used by the container healthcheck; tini reaps zombies and forwards
# signals so `docker compose stop` shuts the API down cleanly.
RUN apk add --no-cache curl tini

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Run as an unprivileged user.
RUN addgroup -S shopsphere \
 && adduser -S shopsphere -G shopsphere \
 && chown -R shopsphere:shopsphere /app
USER shopsphere

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=6 \
  CMD curl -fsS http://127.0.0.1:5000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
