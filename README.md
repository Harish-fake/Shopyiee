# ShopSphere

A full-stack e-commerce application: a React storefront, a Node.js/Express REST
API and a MySQL database. Customers browse a catalogue, search it, build a cart,
check out from a simulated wallet and track their orders. Staff manage the
catalogue, orders, customers and reviews from an administration area.

Everything in the project is self-contained. The catalogue, the customers, the
orders and the wallet ledger are all fabricated, and the wallet is a plain MySQL
table — **no payment provider, bank or card network is contacted at any point.**

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database](#database)
- [API reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Further reading](#further-reading)

---

## Overview

| | |
| --- | --- |
| Storefront | `http://localhost:3000` |
| REST API | `http://localhost:5000/api` |
| Health probe | `http://localhost:5000/api/health` |
| Database | MySQL, reachable only from the API container |
| Catalogue | 45 products across 7 categories, seeded automatically |
| Accounts | 1 administrator, 5 customers, all with fabricated data |

The storefront is a single-page React application. It talks to the API through a
same-origin `/api` prefix — the Vite dev server proxies it in development and
nginx proxies it in the container image — so the session cookie stays
first-party and no CORS pre-flight is needed in the browser.

---

## Features

### Storefront

- **Catalogue** — 45 products across Electronics, Laptops, Smartphones,
  Accessories, Gaming, Home Appliances and Fashion, each with generated
  artwork, a description, a price, a discount and a stock level.
- **Search** — keyword search across name, description and brand, with category,
  price-band and sort filters and pagination.
- **Product pages** — image, specifications, stock, quantity picker, add to
  cart, buy now, wishlist toggle, customer reviews and related products.
- **Cart** — database-backed, one row per customer/product pair, with live
  totals and free delivery above ₹5,000.
- **Checkout** — delivery details prefilled from the profile, a server-computed
  order summary and payment from the simulated wallet.
- **Wishlist** — save products, remove them, or move them straight into the cart.
- **Wallet** — balance, deposits, purchases and refunds, a filterable
  transaction ledger and recent purchases.
- **Orders** — history with statuses (Pending, Processing, Shipped, Delivered,
  Cancelled), a per-order timeline and self-service cancellation with an
  automatic refund.
- **Reviews** — rate a product 1–5, write a review, edit or delete your own; the
  product rating is recalculated from the reviews table.
- **Account** — register, sign in, sign out, update delivery details, change
  password.

### Administration

- Dashboard with totals for sales, orders, customers, products and each
  fulfilment state, plus a low-stock report.
- Product management: create, edit and retire catalogue items.
- Order management: filter by status, search, move orders through the
  fulfilment states, cancel with a refund.
- Customer list and a full wallet ledger.
- Review moderation.

### Platform

- Session-based authentication with bcrypt password hashing and a MySQL-backed
  session store.
- Role-based access control (`USER` / `ADMIN`) resolved from the database on
  every request.
- Server-side pricing: the API never trusts a price or a total from the browser.
- Transactional checkout with row locking, so stock and balances stay
  consistent.
- Structured request logging with secrets redacted.
- Docker Compose stack with the database on a private network.

---

## Tech stack

**Frontend**

| Package | Version | Purpose |
| --- | --- | --- |
| react, react-dom | 18.3.1 | UI |
| react-router-dom | 6.26.2 | Routing |
| axios | 1.7.7 | HTTP client |
| vite | 5.4.8 | Dev server and bundler |
| @vitejs/plugin-react | 4.3.1 | Fast Refresh |

Styling is hand-written CSS with custom properties — no UI framework.

**Backend**

| Package | Version | Purpose |
| --- | --- | --- |
| express | 4.19.2 | HTTP server and routing |
| mysql2 | 3.11.3 | MySQL driver (raw SQL, no ORM) |
| bcryptjs | 2.4.3 | Password hashing |
| express-session | 1.18.0 | Sessions |
| helmet | 7.1.0 | Security headers |
| express-rate-limit | 7.4.0 | Rate limiting |
| cors, cookie-parser, morgan | — | CORS, cookies, request logging |
| dotenv | 16.4.5 | Environment configuration |

**Data and tooling**

- MySQL 8.0 (InnoDB, `utf8mb4`)
- Docker and Docker Compose
- Jest 29 + Supertest 7
- Node.js 18 or newer (22 LTS recommended)

There is deliberately **no ORM**. Every query is written in SQL so that the
indexes, joins and transactions are visible in the code.

---

## Architecture

### Request flow

```
browser
   │  GET /            → static SPA
   │  XHR /api/...     → proxied
   ▼
nginx :3000  ── /api/ ──▶  Express :5000  ──▶  MySQL :3306
 (or Vite dev server)        │                  (private network)
                             ├─ middleware: helmet → cors → parsers →
                             │              session → attachUser →
                             │              rate limit → validate → csrf
                             ├─ routes  →  controllers  →  services
                             └─ notFound → errorHandler
```

The API is layered:

| Layer | Responsibility |
| --- | --- |
| `routes/` | Path definitions and per-route validation, authorization and CSRF |
| `controllers/` | HTTP concerns: read the request, call a service, shape the response |
| `services/` | Business logic and every SQL statement |
| `middleware/` | Authentication, authorization, validation, CSRF, rate limiting, errors |
| `config/` | Environment parsing and the connection pool |
| `utils/` | Validators, encoders, error types, logger, references |

### Directory layout

```
shopping-store/
├── backend/
│   ├── app.js                     Express application assembly
│   ├── server.js                  HTTP listener, startup banner, shutdown
│   ├── config/
│   │   ├── env.js                 Environment parsing and validation
│   │   └── db.js                  MySQL pool, transactions, health probe
│   ├── controllers/               One module per resource
│   ├── routes/                    Route tables
│   ├── middleware/
│   │   ├── auth.js                attachUser, requireAuth, requireAdminSecure
│   │   ├── validate.js            Declarative request validation
│   │   ├── csrf.js                Synchroniser-token protection
│   │   ├── rateLimit.js           Per-surface limiters
│   │   └── errorHandler.js        Single response shape, safe messages
│   ├── services/                  Business logic and SQL
│   ├── database/
│   │   ├── sessionStore.js        MySQL session store
│   │   └── init.js                Schema and seed bootstrap
│   ├── secure/                    Hardened implementations
│   ├── vulnerabilities/           Deliberately weak implementations
│   ├── utils/
│   ├── tests/                     Jest + Supertest suites
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/client.js          Axios instance, error normalisation
│   │   ├── components/            Navbar, footer, cards, forms, layout
│   │   ├── context/               Auth, cart and toast providers
│   │   ├── pages/                 One module per route
│   │   ├── pages/admin/           Administration screens
│   │   ├── styles/                Design tokens, components, pages
│   │   └── utils/format.js        Currency, date and label formatting
│   ├── public/images/             Generated SVG artwork
│   ├── nginx.conf                 SPA serving + /api proxy
│   ├── Dockerfile
│   └── package.json
├── database/
│   ├── schema.sql                 Tables, indexes, foreign keys, app account
│   └── seed.sql                   Sample catalogue and customers
├── docker/
│   └── mysql/init/
│       └── 01-schema-and-seed.sh  First-boot initialiser
├── docs/
│   └── security-testing.md        Developer-facing security notes
├── scripts/
│   └── generate-images.mjs        Regenerates the SVG artwork
├── docker-compose.yml
├── .env.example
└── .gitignore
```

### Data model

```
users ─┬─< cart_items >─┬─ products ─┬─< order_items
       ├─< orders ──────┘            ├─< reviews
       ├─< reviews ──────────────────┤
       ├─< wishlist ─────────────────┘
       └─< transactions

products >── categories
sessions                     (server-side session store)
```

Ten tables, all InnoDB with `utf8mb4`. `order_items` snapshots the product name,
image and unit price at purchase time, so a historical order stays accurate when
the catalogue changes. `products` is retired with a soft delete
(`is_active = 0`) so order history keeps resolving.

---

## Getting started

### Prerequisites

- Docker Desktop (or Docker Engine + Compose v2) — **or** Node.js 18+ and MySQL 8
- `git`

### Option A — Docker Compose (recommended)

```bash
git clone <repository-url> shopping-store
cd shopping-store

cp .env.example .env
```

Open `.env` and set at least these three values:

```dotenv
DB_PASSWORD=<choose a password for the application account>
DB_ROOT_PASSWORD=<choose a password for the MySQL root account>
SESSION_SECRET=<output of the command below>
```

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then bring the stack up:

```bash
docker compose up --build
```

| Service | URL | Notes |
| --- | --- | --- |
| Storefront | <http://localhost:3000> | Bound to loopback (`WEB_BIND`) |
| API | <http://localhost:5000/api> | Bound to loopback |
| MySQL | — | No published port; private network only |

Both published ports default to `127.0.0.1`, so a `docker compose up` on a laptop
does not put the shop on whatever network that laptop is joined to. Widening
this is a deliberate act: set `WEB_BIND=0.0.0.0` (or `HOST=0.0.0.0` for the API
when running it directly) and read [Deployment](#deployment) first.

The first start creates the schema, the application account and the sample
catalogue automatically — no manual SQL is required. To start over from an empty
database:

```bash
docker compose down -v && docker compose up --build
```

Useful commands:

```bash
docker compose logs -f backend      # follow API output
docker compose exec mysql \
  mysql -ushop_app -p shopping_store -e "SELECT COUNT(*) FROM products;"
docker compose down                 # stop (keeps the data volume)
```

### Option B — local development

Run MySQL yourself, then start the two Node processes.

**1. Database**

Create a database and an application account. The schema script creates both:

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p < database/schema.sql
mysql -h 127.0.0.1 -P 3306 -u root -p < database/seed.sql
```

Or let the bootstrap script do it, reading the connection details from `.env`:

```bash
cd backend
npm install
npm run db:init        # idempotent — applies schema + seed only if needed
```

**2. API**

```bash
cd backend
npm install
npm run dev            # nodemon, listens on :5000
```

Point `.env` at your local MySQL:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
```

**3. Storefront**

```bash
cd frontend
npm install
npm run dev            # Vite, listens on :3000, proxies /api to :5000
```

Open <http://localhost:3000>.

### Demo accounts

The seed data ships with two accounts so the application can be evaluated
immediately. These are **local demo credentials only** — never reuse them
anywhere else.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@shopsphere.test` | `AdminDemo#2024` |
| Customer | `priya@example.test` | `UserDemo#2024` |

To create your own account, register at <http://localhost:3000/register>. New
accounts are credited with the starting wallet balance
(`WALLET_STARTING_BALANCE`, ₹10,000 by default) so checkout can be exercised
without a top-up.

To promote an account to administrator:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

---

## Environment variables

Copy `.env.example` to `.env`. Everything has a sensible default except the
secrets, which are deliberately blank.

### Application

| Variable | Default | Description |
| --- | --- | --- |
| `APP_MODE` | `development` | `development`, `testing` or `secure`. Selects the implementation set the API uses. |
| `NODE_ENV` | `development` | Standard Node environment. |
| `PORT` | `5000` | API port. |
| `HOST` | `127.0.0.1` | Interface the API binds to. Loopback by default so a local run is not exposed to the surrounding network. Containers set `0.0.0.0`. |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed CORS origin. |

### Database

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `mysql` | Service name inside Compose; `127.0.0.1` locally. |
| `DB_PORT` | `3306` | |
| `DB_NAME` | `shopping_store` | |
| `DB_USER` | `shop_app` | Application account. **Not** root. |
| `DB_PASSWORD` | — | Required. Also used to create the account. |
| `DB_ROOT_PASSWORD` | — | Required by Compose. Used only for initialisation. |
| `DB_CONNECTION_LIMIT` | `10` | Pool size. |
| `DB_SSL` | `false` | Enable TLS for the database connection. Required by most hosted MySQL. |
| `DB_SSL_CA` | — | Path to the provider's CA certificate, used to verify the server. |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Set `false` to encrypt without verifying. Throwaway environments only; the app warns at start-up. |
| `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD` | `root` / `DB_ROOT_PASSWORD` | Credentials used by `npm run db:init`. |

### Sessions and security

| Variable | Default | Description |
| --- | --- | --- |
| `SESSION_SECRET` | — | Required. At least 32 characters in `secure` mode. |
| `SESSION_NAME` | `shop.sid` | Session cookie name. |
| `SESSION_MAX_AGE_MS` | `86400000` | Session lifetime (24 h). |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS. Also enables HSTS. |
| `COOKIE_SAMESITE` | `lax` | `lax`, `strict` or `none`. Use `none` only when the storefront and API are on different registrable domains; it requires `COOKIE_SECURE=true` and the app refuses to start otherwise. |
| `ENABLE_CSRF` | `true` | Synchroniser-token protection for state-changing requests. |
| `ENABLE_RATE_LIMIT` | `true` | Per-surface request limiting. |
| `TRUST_PROXY` | `false` | `true` behind nginx or another reverse proxy. |
| `EXPOSE_ERROR_DETAILS` | `false` | Echo the message of an unexpected failure to the client. Local debugging only. |

### Storefront data

| Variable | Default | Description |
| --- | --- | --- |
| `WALLET_STARTING_BALANCE` | `10000.00` | Credit applied to a newly registered account. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | see `.env.example` | Documented demo credentials. |

### Logging

| Variable | Default | Description |
| --- | --- | --- |
| `HTTP_LOG_FORMAT` | `dev` (`combined` in `secure`) | Morgan format. |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info` or `debug`. |

---

## Database

### Tables

| Table | Purpose |
| --- | --- |
| `users` | Accounts, role, simulated wallet balance, delivery details |
| `categories` | Seven catalogue categories |
| `products` | Catalogue items with price, stock, rating and soft-delete flag |
| `cart_items` | One row per customer/product pair |
| `orders` | Order header with status, payment status and a shipping snapshot |
| `order_items` | Line items with the name, image and price captured at purchase |
| `reviews` | One review per customer per product |
| `wishlist` | Saved products |
| `transactions` | Wallet ledger: deposits, purchases, refunds, adjustments |
| `sessions` | Server-side session store |

### Scripts

| Command | Effect |
| --- | --- |
| `npm run db:init` | Applies `schema.sql` and `seed.sql` if the database is empty. Safe to re-run. |
| `npm run db:reset` | Drops every table and reloads the sample data set. |

Both accept admin credentials from `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD`,
because the application account deliberately holds only `SELECT`, `INSERT`,
`UPDATE` and `DELETE` — it cannot create or drop anything.

### Sample data

| | Count |
| --- | --- |
| Categories | 7 |
| Products | 45 |
| Customers | 6 (1 administrator, 5 customers) |
| Orders | 8 — across Delivered, Shipped, Processing, Pending and Cancelled |
| Order line items | 14 |
| Reviews | 25 |
| Wishlist entries | 7 |
| Wallet transactions | 13 |
| Cart lines | 4 |

Product and category artwork is generated SVG, produced by
`node scripts/generate-images.mjs`. No third-party images are used, so the
project has no image licensing dependencies and works fully offline.

---

## API reference

All responses share one envelope:

```jsonc
// success
{ "success": true,  "data": { /* … */ } }

// failure
{ "success": false, "error": { "message": "…", "code": "BAD_REQUEST" } }
```

Error codes: `BAD_REQUEST` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `UNPROCESSABLE` (422), `RATE_LIMITED`
(429), `INTERNAL_ERROR` (500).

Session cookies are HTTP-only and `SameSite=Lax`. State-changing requests carry
an `X-CSRF-Token` header obtained from `GET /api/auth/csrf`.

### Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | — | Create an account and start a session |
| `POST` | `/api/auth/login` | — | Sign in |
| `POST` | `/api/auth/logout` | — | Destroy the session |
| `GET` | `/api/auth/me` | — | Current account, or `null` |
| `GET` | `/api/auth/csrf` | — | Issue a CSRF token for this session |
| `GET` | `/api/auth/session-check` | — | Authentication state |
| `PUT` | `/api/auth/profile` | user | Update name, phone and address |
| `PUT` | `/api/auth/password` | user | Change password |

### Catalogue

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/products` | Page of products. `page`, `limit`, `categoryId`, `sort` |
| `GET` | `/api/products/featured` | Featured products |
| `GET` | `/api/products/new-arrivals` | Most recently added |
| `GET` | `/api/products/top-rated` | Highest rated |
| `GET` | `/api/products/search` | Keyword search. `q`, `categoryId`, `minPrice`, `maxPrice`, `sort`, `page`, `limit` |
| `GET` | `/api/products/search-safe` | Same filters, parameterised |
| `GET` | `/api/products/:id` | Product by numeric id **or** slug, with reviews and related items |
| `GET` | `/api/categories` | Categories with product counts |
| `GET` | `/api/categories/:id` | Category by id or slug |
| `GET` | `/api/categories/:id/products` | Products inside a category |

`sort` accepts `newest`, `oldest`, `price-asc`, `price-desc`, `rating-desc` or
`name-asc`.

### Cart and wishlist

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/cart` | user | Cart with server-computed totals |
| `POST` | `/api/cart` | user | Add `{ productId, quantity }` |
| `PUT` | `/api/cart/:id` | user | Set the quantity of a line |
| `DELETE` | `/api/cart/:id` | user | Remove a line |
| `DELETE` | `/api/cart` | user | Empty the cart |
| `GET` | `/api/wishlist` | user | Saved products |
| `POST` | `/api/wishlist` | user | Save `{ productId }` |
| `DELETE` | `/api/wishlist/:productId` | user | Remove a saved product |
| `POST` | `/api/wishlist/:productId/move-to-cart` | user | Move a saved product into the cart |

### Checkout, orders and wallet

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/checkout/preview` | user | Read-only order summary, priced by the server |
| `POST` | `/api/checkout` | user | Place an order |
| `POST` | `/api/checkout-secure` | user | Place an order, always priced from MySQL |
| `GET` | `/api/orders` | user | Own orders. `page`, `limit`, `status` |
| `GET` | `/api/orders/:id` | user | Order detail |
| `GET` | `/api/orders/:id/secure` | user | Order detail, ownership-scoped |
| `POST` | `/api/orders/:id/cancel` | user | Cancel and refund |
| `GET` | `/api/wallet` | user | Balance, summary and recent activity |
| `GET` | `/api/wallet/transactions` | user | Ledger. `limit`, `offset`, `type` |
| `GET` | `/api/wallet/purchases` | user | Recent orders |
| `POST` | `/api/wallet/deposit` | user | Add simulated credit `{ amount }` |

### Reviews

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/reviews/product/:productId` | — | Reviews with the average and rating distribution |
| `GET` | `/api/reviews/mine` | user | Own reviews |
| `POST` | `/api/reviews` | user | Write `{ productId, rating, title, comment }` |
| `PUT` | `/api/reviews/:id` | user | Edit your own review |
| `DELETE` | `/api/reviews/:id` | user | Delete your own review (administrators: any) |

### Administration

Every route below requires an `ADMIN` account.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/admin/stats` | Dashboard totals and the low-stock report |
| `GET` | `/api/admin/users` | Customer list |
| `GET` | `/api/admin/users-secure` | Customer list, hardened gate |
| `GET` | `/api/admin/orders` | Orders. `page`, `limit`, `status`, `search` |
| `PUT` | `/api/admin/orders/:id/status` | Set the fulfilment status |
| `POST` | `/api/admin/orders/:id/cancel` | Cancel and refund |
| `GET` | `/api/admin/products` | Catalogue including retired items |
| `POST` | `/api/admin/products` | Create a product |
| `PUT` | `/api/admin/products/:id` | Update a product |
| `DELETE` | `/api/admin/products/:id` | Retire a product |
| `GET` | `/api/admin/inventory` | Stock levels and low-stock items |
| `GET` | `/api/admin/reviews` | All reviews |
| `DELETE` | `/api/admin/reviews/:id` | Delete any review |
| `GET` | `/api/admin/transactions` | Full wallet ledger |

### Examples

```bash
# Sign in and keep the session cookie
curl -s -c jar.txt -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"priya@example.test","password":"UserDemo#2024"}'

# Browse the catalogue
curl -s 'http://localhost:5000/api/products?limit=5&sort=price-asc'

# Search
curl -s 'http://localhost:5000/api/products/search?q=laptop'

# The signed-in account
curl -s -b jar.txt http://localhost:5000/api/auth/me
```

---

## Testing

The suites talk to the running Express application through Supertest using
cookie-persisting agents, so sessions, cookies, validation and authorization
behave exactly as they do in a browser.

```bash
cd backend
npm test              # APP_MODE=development
npm run test:secure   # APP_MODE=secure
```

Both runs execute the same 179 assertions across 13 suites and both are expected
to pass.

| Suite | Coverage |
| --- | --- |
| `routes.test.js` | Every registered route, probed once per role: no 5xx, valid envelope, writes refused without a session |
| `auth.test.js` | Registration, sign-in, session lifecycle, profile, password change |
| `products.test.js` | Listing, filtering, sorting, pagination, detail, categories, health |
| `search.test.js` | Keyword, category, price-band and sort filters on both search endpoints |
| `cart.test.js` | Add, update, remove, clear, totals, stock limits, cross-account scoping |
| `wishlist.test.js` | Save, duplicate, remove, move to cart, per-account isolation |
| `checkout.test.js` | Order placement, wallet debit, stock movement, validation, preview |
| `orders.test.js` | History, detail, cancellation with refund and stock return |
| `reviews.test.js` | Create, edit, delete, ownership, rating roll-up |
| `wallet.test.js` | Balance, ledger, top-up limits, type filter |
| `admin.test.js` | Dashboard, products, orders, customers, reviews, ledger |
| `authorization.test.js` | Role enforcement, client-supplied roles ignored, ownership |
| `security-behaviour.test.js` | Weak-versus-hardened behaviour for each documented finding |

`routes.test.js` is worth calling out: it discovers the route table by walking
Express's own router stack rather than from a hand-written list, so a new
endpoint is covered as soon as it is mounted and the suite cannot drift behind
the code. It then asserts that a customer is refused by every administrator
route, and that an administrator is never refused for who they are — which is
what would catch an inverted role check.

**The suites are non-destructive.** They never drop, truncate or delete a row
they did not create. Every fixture is tagged with a `zztest-` prefix and removed
in `afterAll`, so the sample catalogue is untouched and the suites can be run
repeatedly:

```bash
npm run db:reset   # back to the pristine sample data at any time
```

Rate limiting is disabled during the suites (a suite signs in dozens of times);
the limiter configuration itself is unchanged.

---

## Deployment

ShopSphere is intended for a **private, restricted environment**. It has not
been hardened for direct exposure to the public internet and should not be
placed there without the work described below.

For a complete walkthrough — including a free, no-credit-card deployment on
managed hosting, and a single-VM Docker Compose setup — see
[`docs/deployment.md`](docs/deployment.md). The sections below summarise the
choices that matter.

### Put the database on a private network

`docker-compose.yml` already does this: MySQL has no `ports:` block and sits on
an `internal: true` bridge network, so it is unreachable from the host and from
the internet. The API reaches it by service name (`mysql`).

Verify that nothing is listening on 3306 from outside the stack:

```bash
docker compose port mysql 3306        # prints nothing — correct
ss -ltnp | grep 3306                  # should be empty on the host
```

### Choose a reachability model

| Model | How |
| --- | --- |
| **Local machine only** | The default. Both published ports are pinned to loopback: `127.0.0.1:${API_PORT}:5000` and `${WEB_BIND:-127.0.0.1}:${WEB_PORT}:3000`. |
| **Private LAN** | Set `WEB_BIND=0.0.0.0`, keep MySQL on the internal network, and place the host behind the office firewall. |
| **VPN** | Keep the Compose ports on loopback and reach the host through WireGuard, Tailscale or an equivalent. Nothing is exposed to the internet. |
| **IP allow-list** | Terminate TLS at a reverse proxy and allow only known source addresses. |
| **Authenticated gateway** | Put the stack behind an identity-aware proxy (Cloudflare Access, oauth2-proxy, Tailscale Funnel with SSO) so every visitor authenticates before reaching nginx. |

### Harden the deployment

1. **Generate real secrets.** `SESSION_SECRET` should be at least 48 random
   bytes. `DB_PASSWORD` and `DB_ROOT_PASSWORD` should be unique and long.
   Never commit `.env` — `.gitignore` already excludes it.
2. **Serve over HTTPS.** Put nginx, Caddy or Traefik in front of port 3000 with
   a real certificate, then set `COOKIE_SECURE=true`, which also switches on
   HSTS. Set `TRUST_PROXY=true` so client IPs and rate limits are correct.
3. **Restrict the firewall.** Allow inbound traffic only to the TLS terminator.
   Never expose 3306, and keep 5000 on loopback.
4. **Keep the application account unprivileged.** `shop_app` holds only
   `SELECT`, `INSERT`, `UPDATE` and `DELETE` on one schema. Do not grant it DDL.
5. **Back up the data volume.** `shopsphere-mysql-data`, or use
   `mysqldump --single-transaction` on a schedule.
6. **Watch the logs.** `docker compose logs -f backend`. Authentication
   failures, authorization failures, checkouts and database errors are logged
   with secrets redacted; `LOG_LEVEL=info` is appropriate for production.
7. **Set `APP_MODE=secure`.** This selects the hardened implementation set,
   requires a strong `SESSION_SECRET`, and refuses to start otherwise.
8. **Keep this environment away from anything real.** It is a demonstration
   application with fabricated data. Run it on its own host, its own database
   and its own credentials — never alongside production systems or real
   customer data.

### Example: HTTPS behind Caddy on a private VPS

```caddyfile
shopsphere.internal.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

```dotenv
COOKIE_SECURE=true
TRUST_PROXY=true
APP_MODE=secure
```

```bash
docker compose up -d --build
```

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running, or `DB_HOST`/`DB_PORT` are wrong. Inside Compose use `DB_HOST=mysql`. |
| `ER_ACCESS_DENIED_ERROR` for `shop_app` | `DB_PASSWORD` does not match the account. Re-run `npm run db:reset`, which re-applies the password. |
| `db:init failed — Access denied for user 'root'` | Set `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD` to an account with DDL rights. |
| Storefront loads but every request 404s | The `/api` proxy target is wrong. Check `VITE_API_PROXY_TARGET` (defaults to `http://localhost:5000`). |
| `429 RATE_LIMITED` while testing | The limiters are working. Set `ENABLE_RATE_LIMIT=false` locally. |
| `403` on a state-changing request | The CSRF token is missing. Fetch `GET /api/auth/csrf` and send it as `X-CSRF-Token`. |
| `APP_MODE=secure requires a strong SESSION_SECRET` | Expected in `secure` mode. Generate one with the `crypto.randomBytes` command above. |
| Sign-in succeeds but the next request is anonymous | The cookie is not reaching the API. Serve the SPA and API from one origin, and set `COOKIE_SECURE=false` when not on HTTPS. |
| Schema changes have no effect inside Docker | The initialiser runs only on a fresh volume: `docker compose down -v`. |
| Port 3000 or 5000 already in use | Change `WEB_PORT` / `API_PORT` in `.env`. |

---

## Further reading

- [`docs/deployment.md`](docs/deployment.md) — step-by-step deployment: a free
  managed-hosting path with no credit card, a single-VM Docker Compose path,
  the environment variables that must change for a public deployment, TLS, and a
  troubleshooting table.
- [`docs/security-testing.md`](docs/security-testing.md) — developer-facing
  notes on the application's security posture, the implementation pairs in
  `backend/secure/` and `backend/vulnerabilities/`, how `APP_MODE` selects
  between them, and the safety rails around the exercise. **Read this before
  deploying or modifying the authorization, search or checkout code.**
- [`database/schema.sql`](database/schema.sql) — tables and indexes.
- [`database/grants.sql`](database/grants.sql) — the application account and its
  DML-only grants (self-hosted and Docker only; managed hosts create the account
  for you).
- [`database/seed.sql`](database/seed.sql) — the fabricated data set.
- [`scripts/generate-images.mjs`](scripts/generate-images.mjs) — artwork
  generation.

---

## Demo data notice

Every product, customer, order, review and wallet balance in this project is
fabricated. The wallet is a MySQL table, not a payment integration: deposits,
purchases and refunds are database writes, and no external financial service is
contacted at any point. The demo credentials in this README exist so the project
can be evaluated locally and must never be reused elsewhere.
