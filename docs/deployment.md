# Deployment

This guide covers putting ShopSphere online, including a **free, no-credit-card**
path. Read the first section before choosing anything.

---

## Read this first

ShopSphere is a demonstration application. Its catalogue, customers, orders and
wallet are fabricated, it processes no payments, and it stores no real personal
data. Those properties are what make it safe to run in public.

What it *does* contain, by design, is a set of deliberately weak
implementations — injection, stored and reflected script execution, broken
access control, price tampering — documented in
[security-testing.md](./security-testing.md). Publishing it on the open
internet means automated scanners will find it, typically within days.

That is fine if the instance is clearly a sandbox. It is not fine if it can be
mistaken for a real shop, because a convincing-looking storefront with a real
domain is useful to someone running a phishing campaign.

Before you point a public URL at it:

1. **Do not give it a domain that looks like a real business.** Use the
   provider's own subdomain.
2. **Restrict who can reach it.** Every option below has a way to do this, and
   they are listed with each. A password on the front door turns a public
   sandbox into a private one.
3. **Never put real data in it.** Not customer records, not real email
   addresses, not real payment details.
4. **Consider `APP_MODE=secure`.** In that mode the weak routes are not mounted
   at all and the hardened implementations serve every request. The storefront
   looks identical. If you want the application online but not exploitable,
   this is the setting you want.

If you only need it for a workshop, a review, or your own testing, prefer the
VPN or access-gateway rows in the table below over a public URL.

---

## Choose a deployment shape

The storefront talks to the API at the relative path `/api`. That is deliberate:
when both are served from **one origin**, there is no CORS to configure and the
session cookie works with no special settings. Both options below keep it that
way.

| | Option A — managed free tier | Option B — one small VM |
| --- | --- | --- |
| Cost | Free, no card | Free tier, card required to sign up |
| Services | 3 (static site, web service, database) | 1 (Docker Compose runs all 3) |
| Always on | No — API sleeps after 15 min idle | Yes |
| Cold start | ~1 minute | none |
| TLS | Included | You configure it |
| Effort | ~30 minutes | ~45 minutes |
| Best for | Sharing a link | A workshop or long-running sandbox |

**Option A** is the fastest way to a public link with no payment method.
**Option B** is more capable and has no cold start, at the cost of managing a
server.

---

## Option A — free managed hosting (no credit card)

Three free services, wired together:

| Piece | Service | Free tier |
| --- | --- | --- |
| Database | Aiven for MySQL | 1 CPU, 1 GB RAM, 1 GB disk, no time limit |
| API | Render Web Service (Docker) | 750 instance hours/month, sleeps when idle |
| Storefront | Render Static Site | Free, unlimited |

Aiven's free MySQL requires no card and has no expiry. Render's free *database*
is PostgreSQL and expires after 30 days, which is why the database lives at
Aiven instead.

### Step 1 — Create the database (Aiven)

1. Sign up at <https://aiven.io>. No payment method is required.
2. **Create service** → **MySQL** → choose the **Free** plan.
3. Pick the region closest to where you will host the API.
4. Wait for the service state to become **Running** (a few minutes).
5. Open the service's **Overview** page and note:
   - **Host** — looks like `mysql-xxxx-yourname.a.aivencloud.com`
   - **Port** — a five-digit number
   - **User** — `avnadmin`
   - **Password** — click to reveal
   - **CA certificate** — download `ca.pem`
6. Under **Databases**, create one named `shopping_store`.

Aiven creates a default database called `defaultdb`; the application expects
`shopping_store`, so this step matters.

### Step 2 — Load the schema

On your own machine, in `backend/`:

```bash
cp .env.example .env
```

Set the database values in `.env` to the Aiven ones, and enable TLS — Aiven
refuses unencrypted connections:

```ini
DB_HOST=mysql-xxxx-yourname.a.aivencloud.com
DB_PORT=12345
DB_NAME=shopping_store
DB_USER=avnadmin
DB_PASSWORD=<the password from the Aiven console>
DB_SSL=true
DB_SSL_CA=./certs/ca.pem
```

Put the downloaded `ca.pem` at `backend/certs/ca.pem`.

Aiven does not permit `CREATE USER` or `GRANT`, so skip the grants step:

```bash
npm run db:init:managed
```

That applies `schema.sql` (tables only) and `seed.sql` (the sample catalogue),
and skips `grants.sql`. You should see `products=45` at the end.

> If the connection fails, check `DB_SSL_CA` first. Without the CA the driver
> cannot verify Aiven's certificate, and with verification on it will refuse the
> connection rather than downgrade silently — which is the correct behaviour.

### Step 3 — Deploy the API (Render)

1. Sign up at <https://render.com>. No payment method is required.
2. Push this repository to GitHub (or GitLab) if you have not already.
3. **New** → **Web Service** → connect the repository.
4. Configure:
   - **Root Directory**: `backend`
   - **Runtime**: **Docker** (Render builds `backend/Dockerfile`)
   - **Instance Type**: **Free**
   - **Health Check Path**: `/api/health`
5. Add these environment variables:

   | Key | Value |
   | --- | --- |
   | `APP_MODE` | `development` (or `secure` — see the warning at the top) |
   | `NODE_ENV` | `production` |
   | `HOST` | `0.0.0.0` |
   | `FRONTEND_ORIGIN` | the static site URL from Step 4, e.g. `https://shopsphere-web.onrender.com` |
   | `DB_HOST` | your Aiven host |
   | `DB_PORT` | your Aiven port |
   | `DB_NAME` | `shopping_store` |
   | `DB_USER` | `avnadmin` |
   | `DB_PASSWORD` | your Aiven password |
   | `DB_SSL` | `true` |
   | `DB_SSL_REJECT_UNAUTHORIZED` | `false` |
   | `SESSION_SECRET` | 48+ random bytes — see below |
   | `COOKIE_SECURE` | `true` |
   | `TRUST_PROXY` | `1` |
   | `WALLET_STARTING_BALANCE` | `10000.00` |

   **`HOST=0.0.0.0` is required.** The application binds loopback by default so
   a laptop run is not exposed to the local network. Render's router reaches the
   container from outside, so a loopback bind means the health check never
   passes and the service looks broken.

   **`TRUST_PROXY=1` is required.** Render terminates TLS in front of the
   container, so the app itself sees plain HTTP. Combined with
   `COOKIE_SECURE=true`, that combination means **no session cookie is ever
   issued** — signing in returns 200 and then every following request is
   anonymous. `TRUST_PROXY=1` lets the app read `X-Forwarded-Proto` and see the
   original HTTPS request.

   This was verified directly. With `COOKIE_SECURE=true`, a login over a
   connection the app believes is plain HTTP sets no cookie at all:

   ```
   without X-Forwarded-Proto : HTTP/1.1 200 OK        (no Set-Cookie)
   with    X-Forwarded-Proto : HttpOnly; Secure; SameSite=None
   ```

   If sign-in appears to work and then does not stick, check these two first.

   Generate the session secret locally:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   `DB_SSL_REJECT_UNAUTHORIZED=false` is a pragmatic choice here: Aiven rotates
   its CA, and a bundled copy will eventually go stale, taking the deployment
   down. The connection is still encrypted; the server certificate simply is not
   verified. For anything longer-lived, commit the CA and use `DB_SSL_CA`
   instead. The app logs a warning at start-up whenever this is set.

6. Deploy, then confirm the health check passes:

   ```bash
   curl https://<your-service>.onrender.com/api/health
   ```

### Step 4 — Deploy the storefront (Render)

1. **New** → **Static Site** → same repository.
2. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`
3. Under **Redirects/Rewrites**, add two rules:

   | Action | Source | Destination |
   | --- | --- | --- |
   | Rewrite | `/api/*` | `https://<your-api-service>.onrender.com/api/*` |
   | Rewrite | `/*` | `/index.html` |

   The first keeps the API same-origin, so the session cookie works with no
   special settings and there is no CORS to configure. The second is required by
   React Router: without it, reloading any deep link such as `/orders/2` returns
   404 because no such file exists on disk.

4. Deploy. Open the static site URL.

### Step 5 — Close the loop

Go back to the API service and set `FRONTEND_ORIGIN` to the static site's exact
URL (including `https://`, no trailing slash). Without it the browser blocks the
API's responses.

Then sign in at your static site URL:

```
admin@shopsphere.test / AdminDemo#2024
priya@example.test   / UserDemo#2024
```

These are documented demo accounts that ship in `seed.sql`. **Change or delete
them before sharing the URL with anyone.**

### If sign-in does not stick

The API proxy passes cookies through in most cases, but if the browser is not
retaining the session, fall back to a genuinely cross-origin setup:

1. Build the frontend with an absolute API URL. In the static site's
   **Environment** settings, add:
   `VITE_API_BASE_URL = https://<your-api-service>.onrender.com/api`
2. On the API, set `COOKIE_SAMESITE=none`.
3. Remove the `/api/*` rewrite rule.

`COOKIE_SAMESITE=none` requires `COOKIE_SECURE=true`. The application refuses to
start if you set one without the other, because browsers silently discard a
`SameSite=None` cookie that is not also `Secure` — the symptom being a sign-in
that appears to succeed and then immediately looks signed out.

### Restricting access

The free tier has no built-in password gate. To keep a public URL private:

- **Render**: put the static site behind a password using a service like
  Cloudflare Access in front of a custom domain (free tier available).
- **Simplest**: leave the URL unshared. The hostname is unguessable enough for a
  short-lived sandbox.

---

## Option B — one small VM with Docker Compose

Any VPS works. The free-forever option is **Oracle Cloud Always Free** (Ampere
A1: 4 cores, 24 GB RAM), which requires a card for identity verification but is
not charged.

This shape runs exactly what was tested locally: nginx serves the storefront and
proxies `/api` to the API, and MySQL stays on a private Docker network with no
published port.

```bash
# On a fresh Ubuntu 22.04+ VM
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER" && newgrp docker

git clone <your-repo> shopsphere && cd shopsphere
cp .env.example .env
```

Edit `.env` — at minimum:

```ini
APP_MODE=development
NODE_ENV=production
DB_PASSWORD=<generate a strong one>
DB_ROOT_PASSWORD=<generate another>
SESSION_SECRET=<48+ random bytes>
COOKIE_SECURE=false      # true once TLS is terminated in front
TRUST_PROXY=1
WEB_BIND=127.0.0.1
```

Then:

```bash
docker compose up --build -d
docker compose logs -f backend     # watch it connect to MySQL and seed
```

Open the VM's firewall for 80/443 only. Reach the app through a reverse proxy
that terminates TLS — see the Caddy example below.

### TLS with Caddy

Caddy obtains and renews certificates automatically. Create a DNS record for
your hostname first, then:

```
# /etc/caddy/Caddyfile
shop.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Set `COOKIE_SECURE=true` and `TRUST_PROXY=1` in `.env`, then
`docker compose up -d` to pick them up.

---

## Environment variables for a public deployment

These differ from the local defaults and are the ones that matter most.

| Variable | Local default | Public deployment | Why |
| --- | --- | --- | --- |
| `APP_MODE` | `development` | `secure` to disable the weak routes | `development` mounts them |
| `NODE_ENV` | `development` | `production` | Generic error bodies, combined log format |
| `HOST` | `127.0.0.1` | `0.0.0.0` in a container | A loopback bind is unreachable from the host's router |
| `COOKIE_SECURE` | `false` | `true` | Required over HTTPS |
| `COOKIE_SAMESITE` | `lax` | `lax` same-origin, `none` cross-origin | Controls whether the session cookie is sent |
| `TRUST_PROXY` | `false` | `true` behind any proxy | Otherwise `Secure` cookies are refused and rate limits see one IP |
| `SESSION_SECRET` | placeholder | 48+ random bytes | Anyone knowing it can forge a session |
| `DB_SSL` | `false` | `true` for hosted MySQL | Most providers refuse plaintext |
| `EXPOSE_ERROR_DETAILS` | `false` | `false` | A driver error can quote SQL or a connection string |
| `ENABLE_CSRF` | `true` | `true` | Leave on |
| `ENABLE_RATE_LIMIT` | `true` | `true` | Leave on |

The application refuses to start in `secure` mode if `SESSION_SECRET` is short
or still a placeholder, so a misconfigured deployment fails loudly rather than
running with a known key.

---

## Pre-flight checklist

- [ ] `SESSION_SECRET` is 48+ random bytes and is **not** the placeholder
- [ ] `DB_PASSWORD` and `DB_ROOT_PASSWORD` are not the `change_me_*` values
- [ ] `.env` is not committed — `git check-ignore .env` should print it
- [ ] `COOKIE_SECURE=true` and the site is served over HTTPS
- [ ] `TRUST_PROXY=1` if anything sits in front of the app
- [ ] The database is not reachable from the internet. Hosted MySQL: rely on the
      provider's firewall and TLS. Compose: port 3306 must have no `ports:` entry
- [ ] Demo accounts changed or removed
- [ ] `APP_MODE` is a deliberate choice
- [ ] The URL is not shared beyond the intended audience

Verify the database is not exposed:

```bash
nc -zv <database-host> 3306    # should fail from outside the provider's network
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Health check fails, service never goes live | `HOST` still `127.0.0.1` | Set `HOST=0.0.0.0` |
| Sign-in appears to succeed, then looks signed out | Cookie not sent — `SameSite` mismatch, or `COOKIE_SECURE=true` while the app believes the request is plain HTTP | Same-origin: keep `lax` and add the `/api/*` rewrite. Cross-origin: `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true`. **Always** set `TRUST_PROXY=1` behind a proxy — without it no cookie is issued at all |
| `Unable to reach the database` at start-up | Wrong credentials, or TLS not configured | Check the values, set `DB_SSL=true` and `DB_SSL_CA` |
| `self signed certificate` / `unable to verify` | Missing CA | Download `ca.pem` from the provider and point `DB_SSL_CA` at it |
| `CREATE USER ... denied` | Running `db:init` against a managed host | Use `npm run db:init:managed` |
| Reloading `/orders/2` gives 404 | SPA fallback missing | Add the `/*` → `/index.html` rewrite |
| API returns CORS errors | `FRONTEND_ORIGIN` does not match exactly | Include scheme, no trailing slash |
| First request takes ~1 minute | Free instance woke from sleep | Expected on the free tier |
| `EADDRINUSE` | Port already taken | Change `PORT` / `API_PORT` / `WEB_PORT` |
| Rate limits trigger for everyone at once | `TRUST_PROXY` off behind a proxy | Set `TRUST_PROXY=1` |

---

## Related

- [security-testing.md](./security-testing.md) — the weak implementations, how to
  exercise them, and the hardened counterparts
- [README.md](../README.md) — architecture, API reference and local setup
