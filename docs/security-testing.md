# Security testing guide

> **Audience: developers and application-security engineers.**
>
> This document is not part of the storefront and is never served to customers.
> The running application contains no reference to it, no vulnerability badge,
> no warning banner and no "security lab" page. An ordinary visitor sees an
> ordinary shopping site.

ShopSphere is a deliberately imperfect e-commerce application. Seven classes of
application-level flaw are implemented on purpose, each with a hardened
counterpart sitting next to it in the source tree so the two can be compared
directly. The project exists so that the flaws can be found and fixed with the
same tools used against a real deployment: browser DevTools, Postman, OWASP ZAP
or Burp Suite.

---

## 1. Ground rules

### 1.1 Scope of the flaws

Every flaw is **application-level**: an unsafe SQL string, a missing ownership
predicate, an unencoded echo, a trusted price. The project deliberately does
**not** contain, and must never be extended to contain:

| Not present | Why |
| --- | --- |
| Reverse shells, RCE, OS command injection | Out of scope; the point is to practise web-layer testing |
| Malware, persistence, privilege escalation on the host | Same |
| Credential theft, keylogging, session hijacking tooling | Same |
| Real payment processing, banking APIs, card data | All money is a MySQL-simulated wallet |
| Cryptocurrency transactions | Same |
| Data exfiltration from external systems | The app only ever reads its own database |
| Arbitrary file read/write/delete | No filesystem access is reachable from any endpoint |
| Destructive database operations | Blocked by three independent safety rails (§1.2) |

### 1.2 Safety rails around the SQL injection flaw

The injectable search endpoint is the only place a raw string reaches a SQL
statement. It is fenced in by three separate mechanisms, so the flaw stays a
*detection and inference* exercise rather than a data-destruction exercise:

1. **Keyword denylist** — `assertReadOnly()` in
   `backend/vulnerabilities/vulnerableSearch.js` rejects any term containing
   `drop`, `delete`, `truncate`, `update`, `insert`, `replace`, `alter`,
   `create`, `grant`, `revoke`, `rename`, `load_file`, `outfile`, `dumpfile`,
   `shutdown`, `sleep`, `benchmark`, `information_schema` or `into`, and answers
   `400 BAD_REQUEST`.
2. **Stacked queries disabled** — the application pool in `backend/config/db.js`
   is created without `multipleStatements`, so a `;` cannot introduce a second
   statement even if it survived the denylist.
3. **Least-privilege database account** — the application connects as
   `shop_app`, which holds only `SELECT, INSERT, UPDATE, DELETE` on
   `shopping_store`. It has no `DROP`, no `TRUNCATE`, no `CREATE`, no `GRANT`
   and no access to any other schema. `DROP TABLE users` would be refused by
   MySQL itself.

Boolean-based, `UNION`-based and error-based injection all remain fully
demonstrable, which is what a scanner needs to see.

### 1.3 All data is fabricated

Products, customers, orders, reviews, wallet balances and the transaction ledger
are invented. The two demo passwords are published in the README on purpose so
the project can be evaluated; they must never be reused anywhere else.

---

## 2. Environment modes

`APP_MODE` decides which implementation is wired up.

| Mode | Vulnerable implementations | Hardened implementations | Intended use |
| --- | --- | --- | --- |
| `development` | **Live** | Available at their own routes | Local development and manual testing |
| `testing` | **Live** | Available at their own routes | Automated suites |
| `secure` | Not loaded at all | Everything, including `POST /api/checkout` | The configuration that would be deployed |

```
npm start              # APP_MODE from .env (development by default)
APP_MODE=secure npm start
npm test               # exercises the vulnerable paths
npm run test:secure    # exercises the hardened paths
```

The **storefront is byte-for-byte identical in every mode**. Only the server
changes behaviour, so a tester cannot tell from the UI which implementation is
answering.

In `secure` mode the start-up sequence additionally refuses to run unless
`SESSION_SECRET` is at least 32 characters and is not a placeholder.

---

## 3. Endpoint map

### 3.1 Vulnerable routes

| Method | Route | Class | Implementation |
| --- | --- | --- | --- |
| `GET` | `/api/products/search` | SQL injection + reflected XSS | `vulnerabilities/vulnerableSearch.js` |
| `GET` | `/api/orders/:id` | IDOR | `services/orderService.js` → `getOrderById()` |
| `POST` | `/api/checkout` | Price / total tampering | `vulnerabilities/vulnerableCheckout.js` |
| `POST` | `/api/reviews` | Stored XSS | `vulnerabilities/vulnerableReview.js` |
| `GET` | `/api/reviews/product/:productId` | Stored XSS sink | `vulnerabilities/vulnerableReview.js` |
| `GET` | `/api/admin/users` | Broken admin authorization | `vulnerabilities/vulnerableAuthorization.js` |

`/api/products/search`, `/api/orders/:id`, `/api/checkout`, the review renderer
and `/api/admin/users` all switch to their hardened implementation automatically
when `APP_MODE=secure`.

### 3.2 Hardened routes

These are reachable in **every** mode, so both behaviours can be compared
without restarting anything.

| Method | Route | Hardened implementation |
| --- | --- | --- |
| `GET` | `/api/products/search-safe` | `secure/secureSearch.js` |
| `GET` | `/api/orders/:id/secure` | `orderService.getOrderForUser()` |
| `POST` | `/api/checkout-secure` | `secure/secureCheckout.js` |
| `GET` | `/api/admin/users-secure` | `middleware/auth.js` → `requireAdminSecure` |

Everything else in the API — cart, wishlist, wallet, profile, order
cancellation, review editing, product administration, order administration — is
written once, parameterised and hardened. There is no weak version to find.

---

## 4. Finding 1 — SQL injection

**Route** `GET /api/products/search?q=`
**Parameter** `q` (also `categoryId`, `minPrice`, `maxPrice`)
**Source** `backend/vulnerabilities/vulnerableSearch.js`
**CWE** CWE-89

### Root cause

Filter values are concatenated into the statement with template literals instead
of being bound as parameters.

```js
// backend/vulnerabilities/vulnerableSearch.js
let sql = `${BASE_SELECT} WHERE p.is_active = 1`;

if (q) {
  const term = assertReadOnly(q, 'q');
  sql += ` AND (p.name LIKE '%${term}%' OR p.description LIKE '%${term}%' OR p.brand LIKE '%${term}%')`;
}

if (minPrice !== '') {
  sql += ` AND p.price >= ${assertReadOnly(minPrice, 'minPrice')}`;
}
```

The value the browser sent becomes part of the query text, so it can rewrite the
`WHERE` clause.

### Reproduce

```
GET /api/products/search?q=laptop                    -> 7 products
GET /api/products/search?q=' OR '1'='1               -> 45 products
GET /api/products/search?q='                         -> 500, generic error body
GET /api/products/search?q=x; DROP TABLE users       -> 400 BAD_REQUEST
```

The third request proves the value reaches the parser. The fourth proves the
safety rail and the least-privilege account hold.

### What the security tools show

| Tool | Observation |
| --- | --- |
| OWASP ZAP | *SQL Injection* alert on the `q` parameter; boolean payloads change the result count |
| Burp Suite | Repeater shows a 7-row response for a normal term and a 45-row response for the payload |
| Postman | Status 200 with an unexpectedly large `data.items` array; the malformed quote returns 500 |
| DevTools | The `XHR` for `/api/products/search` returns the injected result set |

### Secure implementation

`backend/secure/secureSearch.js` builds a `WHERE` clause out of `?` markers and
binds the values:

```js
function buildFilters(filters) {
  const clauses = ['p.is_active = 1'];
  const params = [];

  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    clauses.push('(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)');
    params.push(pattern, pattern, pattern);
  }

  if (minPrice !== '') {
    clauses.push('p.price >= ?');
    params.push(asMoney(minPrice, 'minPrice'));
  }

  return { where: clauses.join(' AND '), params };
}
```

Numeric filters go through `asMoney`, the sort key is checked against an
allow-list, and `LIMIT`/`OFFSET` are coerced to bounded integers. The value never
becomes SQL text, so no payload can change the statement. LIKE wildcards are
escaped as well, so `%` and `_` are treated as literal characters.

### Remediation

Parameterised queries everywhere; never build SQL from a string. Where an
identifier genuinely cannot be bound — a column name in `ORDER BY` — map it
through a fixed allow-list. Keep the application account at the lowest
privilege it needs, and keep `multipleStatements` off.

---

## 5. Finding 2 — Reflected cross-site scripting

**Route** `GET /api/products/search?q=`
**Field** `data.query`
**Sink** `frontend/src/components/SearchEcho.jsx`
**Source** `backend/vulnerabilities/vulnerableSearch.js` → `echoQuery()`
**CWE** CWE-79

### Root cause

The storefront renders "Results for …" from `data.query`. The weak
implementation echoes the search term unchanged, and the component injects it as
markup:

```js
// frontend/src/components/SearchEcho.jsx
<span dangerouslySetInnerHTML={{ __html: html }} />
```

### Reproduce

```
GET /api/products/search?q=<img src=x onerror=alert(1)>
  -> data.query === "<img src=x onerror=alert(1)>"

GET /api/products/search-safe?q=<img src=x onerror=alert(1)>
  -> data.query === "&lt;img src=x&#61;x onerror&#61;alert(1)&gt;"
```

Open `http://localhost:3000/search?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E`
and the handler fires on load.

### What the security tools show

| Tool | Observation |
| --- | --- |
| OWASP ZAP | *Cross Site Scripting (Reflected)* on the `q` parameter |
| Burp Suite | The payload is reflected verbatim inside a JSON field that the page injects as HTML |
| DevTools | Elements panel shows a live `<img>` node inside the results heading |

### Secure implementation

`secureSearch.echoQuery()` runs the value through `escapeHtml()` before it
leaves the server, so the response contains entities rather than tags. The
component is unchanged, which is the point: **output encoding at the boundary is
what stops it**, not a different renderer.

### Remediation

Encode on output, in the context the value lands in (HTML body, attribute, URL,
JavaScript). Avoid `dangerouslySetInnerHTML`; when rich text really is required,
sanitise it with an allow-list first (see Finding 3). Add a Content-Security-
Policy — this application already sends `default-src 'none'`, which blocks
inline handlers even if a payload slips through.

---

## 6. Finding 3 — Stored cross-site scripting

**Routes** `POST /api/reviews` writes; `GET /api/reviews/product/:productId` and
`GET /api/products/:id` read
**Fields** `title`, `comment` → `commentHtml`
**Sinks** `frontend/src/components/ReviewList.jsx`,
`frontend/src/pages/admin/AdminReviews.jsx`
**Source** `backend/vulnerabilities/vulnerableReview.js`
**CWE** CWE-79

### Root cause

The weak implementation stores the review text exactly as submitted and hands it
back in a field the storefront injects as HTML.

```js
// backend/vulnerabilities/vulnerableReview.js
function shapeReview(row, viewerId = null) {
  return {
    /* … */
    comment: row.comment,
    commentHtml: row.comment ?? '',   // raw markup, rendered with innerHTML
  };
}
```

Because the payload is persisted, it fires for **every** visitor who opens the
product page — including an administrator browsing the review moderation
screen. That escalation is what separates stored XSS from the reflected variant.

### Reproduce

```
POST /api/reviews
{ "productId": 7, "rating": 5, "comment": "<img src=x onerror=alert(1)>" }

GET /api/reviews/product/7
  -> items[0].commentHtml === "<img src=x onerror=alert(1)>"
```

### What the security tools show

| Tool | Observation |
| --- | --- |
| OWASP ZAP | *Persistent Cross Site Scripting* after the scanner submits a form and re-reads the page |
| Burp Suite | The payload survives a round trip through the database unchanged |
| DevTools | A live `<img>` node appears in the review list; the handler fires on every reload |

### Secure implementation

`backend/secure/secureReview.js` sanitises on write with an allow-list
(`b`, `i`, `u`, `strong`, `em`, `br`, `p`), strips every `on*` attribute,
neutralises `javascript:`, `data:` and `vbscript:` URLs, removes
`script`/`style`/`iframe`/`object`/`embed`/`svg`/`math` together with their
contents, caps the length, and **then** HTML-encodes on the way out:

```js
commentHtml: escapeHtml(row.comment ?? ''),
```

Sanitising on write protects new records; encoding on read also protects
anything already in the table, which is why both are applied.

### Remediation

Sanitise untrusted rich text with a maintained allow-list library, encode on
output, and store the original text separately from any rendered form. Render
reviews as text unless formatting is genuinely required.

---

## 7. Finding 4 — Price and total tampering

**Route** `POST /api/checkout`
**Fields** `items[].price`, `total`, `shippingFee`
**Source** `backend/vulnerabilities/vulnerableCheckout.js`
**CWE** CWE-602 (client-side enforcement) / CWE-472

### Root cause

The checkout request carries the prices the browser displayed. The weak
implementation believes them:

```js
// backend/vulnerabilities/vulnerableCheckout.js
const lines = items.map((item) => {
  const quantity = Number.parseInt(item.quantity, 10) || 1;
  const unitPrice = Number.parseFloat(item.price);   // <- trusted client value
  return { productId: item.productId, quantity, unitPrice, lineTotal: unitPrice * quantity };
});

const appliedTotal = total !== undefined && total !== null && total !== ''
  ? Number.parseFloat(total)                        // <- also trusted
  : computedSubtotal + Number.parseFloat(shippingFee || 0);
```

The same function debits the wallet by `appliedTotal`, writes the order with
that figure, and decrements stock **without checking that stock is available**.
A quantity larger than the shelf quantity therefore drives the row negative.

### Reproduce

A product costing ₹1,799, bought by a wallet holding ₹50,000:

```
POST /api/checkout
{ "items": [{ "productId": 19, "quantity": 1, "price": 1 }], "total": 1 }

-> 201 Created, order.total === 1, wallet debited ₹1
```

Compare the hardened route with the identical payload:

```
POST /api/checkout-secure
{ "items": [{ "productId": 19, "quantity": 1, "price": 1 }], "total": 1 }

-> 201 Created, order.subtotal === 1799, order.total === 1799 + shipping
```

### What the security tools show

| Tool | Observation |
| --- | --- |
| Burp Suite | Repeater: editing `total` to `1` produces an order worth ₹1 |
| OWASP ZAP | The parameter is accepted without server-side revalidation |
| Postman | Response `order.total` equals the value that was sent, not the catalogue price |
| DevTools | The request payload on the checkout page already contains `items[].price` and `total` |

### Secure implementation

`backend/secure/secureCheckout.js` performs the whole sequence server-side:

1. `normaliseItems()` coerces `productId` to an integer ≥ 1 and `quantity` to an
   integer between 1 and 99, folds duplicate lines, and rejects more than 50
   distinct products. **`price` and `total` from the request are discarded
   outright** — they are never read.
2. Products are loaded from MySQL by placeholder list.
3. Each product is checked for existence, `is_active` and sufficient `stock`.
4. Every line total and the order total are recomputed with
   `services/pricingService.js`.
5. Inside a transaction, the user row is re-read `FOR UPDATE` and the balance is
   confirmed.
6. The order, its line items, the stock movements, the `PURCHASE` ledger entry
   and the balance change are written as one atomic unit — a failure anywhere
   rolls the whole thing back. Stock is re-checked `FOR UPDATE` at that point, so
   two concurrent orders cannot oversell the last unit.

### Remediation

Never accept a monetary amount from the client. Send product identifiers and
quantities; let the server look up every price, compute every total, and verify
affordability and availability inside a transaction that locks the rows it
depends on.

---

## 8. Finding 5 — Privilege escalation through a client-controlled cookie

**Route** `GET /api/admin/users`
**Value** `lab_role=admin`
**Source** `backend/vulnerabilities/vulnerableAuthorization.js`
**CWE** CWE-565 / CWE-807

### Root cause

The authorization check accepts a role from two sources, and one of them is a
cookie the browser fully controls.

```js
// backend/vulnerabilities/vulnerableAuthorization.js
const sessionRole = req.session?.user?.role ?? null;
const cookieRole = req.cookies?.[LAB_ROLE_COOKIE] ?? null;   // <- untrusted

const effectiveRole = sessionRole === 'ADMIN' || cookieRole === 'admin' ? 'ADMIN' : 'USER';
```

The cookie is never issued by the application and is never mentioned in the user
interface. It exists only so that the flaw can be exercised with a proxy or an
intercepting tool.

### Reproduce

Signed in as an ordinary customer:

```
GET /api/admin/users
  -> 403 FORBIDDEN

GET /api/admin/users
Cookie: lab_role=admin
  -> 200 OK, the full customer list

GET /api/admin/users-secure
Cookie: lab_role=admin
  -> 403 FORBIDDEN   (the hardened gate ignores it)
```

### What the security tools show

| Tool | Observation |
| --- | --- |
| Burp Suite | Adding a cookie to the request turns a 403 into a 200 |
| OWASP ZAP | *Broken Access Control* — a customer reaches an administrative resource |
| DevTools | Application → Cookies shows a value that was never set by the site |

### Secure implementation

`middleware/auth.js` resolves the identity from the server-side session and
re-reads the role from the `users` table on **every** request, so a promotion or
demotion takes effect immediately and nothing client-supplied is consulted:

```js
const row = await queryOne(
  'SELECT id, name, email, role, wallet_balance, is_active FROM users WHERE id = ? LIMIT 1',
  [sessionUser.id]
);
if (!row || !row.is_active) { req.session.destroy(() => {}); return next(); }
req.user = { id: row.id, name: row.name, email: row.email, role: row.role, /* … */ };
```

`requireAdminSecure()` then compares `req.user.role` and nothing else. When
`APP_MODE=secure`, `GET /api/admin/users` is mounted behind that same gate, so
the weak path does not exist.

### Remediation

Keep authorization state server-side. Read the role from the authoritative store
on each request (or from a signed, integrity-protected token), never from a
cookie, header, query parameter or body field. Deny by default.

---

## 9. Finding 6 — Insecure direct object reference

**Route** `GET /api/orders/:id`
**Parameter** `id`
**Source** `backend/controllers/orderController.js` → `orderService.getOrderById()`
**CWE** CWE-639

### Root cause

The lookup fetches the order by primary key with no ownership predicate, and the
controller only asks for the scoped variant in secure mode:

```js
// backend/controllers/orderController.js
const order = config.isSecureMode
  ? await orderService.getOrderForUser(orderId, req.user.id)
  : await orderService.getOrderById(orderId);
```

`getOrderById()` has no `user_id` in its `WHERE` clause, so any authenticated
customer can read any order by incrementing the identifier. The response
includes the customer's name and email, the delivery address, the line items and
the total.

### Reproduce

Signed in as `priya@example.test` (user 2), requesting an order belonging to
another customer:

```
GET /api/orders/5          -> 200 OK, another customer's name, address and total
GET /api/orders/5/secure   -> 404 NOT_FOUND
GET /api/orders/2/secure   -> 200 OK  (her own order)
```

### What the security tools show

| Tool | Observation |
| --- | --- |
| Burp Suite | Intruder over the numeric `id` returns 200 for other customers' orders |
| OWASP ZAP | *IDOR* / *Broken Access Control* on the path parameter |
| Postman | Changing the id returns a different customer's personal data |

### Secure implementation

`orderService.getOrderForUser(orderId, userId)` adds the ownership predicate, and
`secureAuthorization.requireOwnership()` generalises the pattern for `orders`,
`reviews`, `cart_items`, `wishlist` and `transactions`. It answers **404 rather
than 403** for a resource the caller does not own, so the response does not
confirm that the identifier exists.

### Remediation

Scope every query by the authenticated principal: `WHERE id = ? AND user_id = ?`.
Prefer unpredictable identifiers as defence in depth, but never rely on them.
Return 404 for resources the caller cannot see.

---

## 10. Finding 7 — Broken access control on an administrative API

**Route** `GET /api/admin/users`
**Source** `backend/routes/adminRoutes.js`
**CWE** CWE-285

### Root cause

The route table mounts one endpoint behind a mode-dependent gate while every
sibling uses the hardened one:

```js
// backend/routes/adminRoutes.js
const usersGate = config.isSecureMode
  ? requireAdminSecure
  : require('../vulnerabilities/vulnerableAuthorization').requireAdminVulnerable();

router.get('/users', usersGate, /* … */ adminController.listUsers);
router.get('/stats', requireAdminSecure, adminController.stats);
```

Two problems follow. The endpoint is reachable by a customer whenever the weak
gate is active (see Finding 5), and the inconsistency itself is a maintenance
hazard — the next developer to add a route has a coin-flip chance of picking the
wrong gate.

### Reproduce

```
GET /api/admin/stats          as a customer -> 403 (hardened, always)
GET /api/admin/users          as a customer -> 403
GET /api/admin/users          as a customer + lab_role=admin -> 200
GET /api/admin/users-secure   as a customer + lab_role=admin -> 403
```

### What the security tools show

| Tool | Observation |
| --- | --- |
| Burp Suite | One endpoint in the `/api/admin` tree behaves differently from its siblings |
| OWASP ZAP | *Broken Access Control* against the user-administration path |
| DevTools | An admin-only payload is returned to a non-admin session |

### Secure implementation

`requireAdminSecure` guards every administrative route. With `APP_MODE=secure`,
`usersGate` resolves to that same function, and `GET /api/admin/users-secure`
provides a permanently hardened equivalent in every mode. Authorization failures
are logged with the user id, path and method.

### Remediation

Apply one authorization middleware to the whole administrative router
(`router.use(requireAdminSecure)`) rather than per-route, so a new endpoint
cannot be added without a gate. Add a test that walks the route table and asserts
a customer receives 403 from every administrative path.

---

## 11. Finding 8 — Weak input validation

**Where** every endpoint that accepts a body or a query string
**CWE** CWE-20

### Root cause

Handlers that read `req.body` or `req.query` directly inherit whatever type,
length and shape the client chose. The weak paths lean on this: the search
endpoint interpolates a raw string, and checkout reads `items[].price` without
checking that it is a number at all.

### Reproduce

```
GET  /api/products?limit=100000        -> 400 BAD_REQUEST
POST /api/cart  { "productId": "1 OR 1=1", "quantity": 1 }  -> 400 BAD_REQUEST
POST /api/checkout-secure { "items": [{ "productId": 1, "quantity": 0 }] } -> 400
POST /api/reviews { "rating": 99 }     -> 400 BAD_REQUEST
PUT  /api/admin/orders/1/status { "status": "TELEPORTED" } -> 400
```

### Secure implementation

`middleware/validate.js` takes a declarative schema per route and replaces the
request properties with normalised values, so a handler can rely on the shape:

```js
validate({
  body: {
    productId: (value) => asInt(value, 'productId', { min: 1 }),
    quantity:  (value) => asInt(value, 'quantity', { min: 1, max: 99 }),
  },
})
```

`utils/validators.js` supplies `asString` (with length bounds), `asEmail`,
`asPassword` (≥ 8 characters with a letter and a digit), `asInt` (with min/max),
`asMoney` (non-negative, capped, rounded to two decimals), `asEnum` and
`asSafeText` (an allow-list for address-shaped text). Rejected input never
reaches a service.

### Remediation

Validate on the server, at the boundary, against an explicit schema. Prefer
allow-lists over denylists. Enforce type, length and range. Return 400 with a
message that describes the problem without echoing internal detail.

---

## 12. Testing methodology

### 12.1 Manual

1. Start the stack (`docker compose up --build`, or `npm run dev` in each of
   `backend/` and `frontend/`).
2. Sign in as the customer account and browse the storefront — it should behave
   exactly like a normal shop.
3. Point a proxy (Burp/ZAP) at `http://localhost:3000` and work through the
   reproductions in §4–§11.
4. Switch to the administrator account and confirm the dashboard renders
   normally; confirm the customer account cannot reach it.
5. Restart with `APP_MODE=secure` and repeat. The same payloads should now fail.

### 12.2 Automated

```
cd backend
npm test            # APP_MODE=development — the weak paths are live
npm run test:secure # APP_MODE=secure     — only the hardened paths are used
```

`tests/security-behaviour.test.js` asserts the *mode-appropriate* outcome for
each finding, so one file documents both behaviours:

```js
if (weakPathsLive) {
  expect(response.body.data.items.length).toBeGreaterThan(40);   // injected
} else {
  expect(response.body.data.items).toHaveLength(0);              // parameterised
}
```

The remaining suites cover authentication, catalogue, search, cart, wishlist,
checkout, orders, reviews, administration and authorization.

**The suites are non-destructive.** They never drop, truncate or delete a row
they did not create; every fixture is tagged with a `zztest-` prefix and removed
in `afterAll`, so the sample catalogue is untouched and the suites can be re-run
indefinitely. No test contains an exploit, a payload designed to damage data, or
any action outside the application's own HTTP API.

### 12.3 Reset the sample data

```
cd backend
npm run db:init     # idempotent; leaves a populated database alone
npm run db:reset    # drops every table and reloads seed.sql
```

---

## 13. Hardening already present

The following are active in every mode unless noted. They are deliberately
compatible with the vulnerable paths so that a scanner still sees normal HTTP.

| Control | Where |
| --- | --- |
| `helmet` with a restrictive CSP (`default-src 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`) | `backend/app.js` |
| `X-Powered-By` removed | `backend/app.js` |
| CORS restricted to the configured origin (permissive outside `secure` mode so local tooling works) | `backend/app.js` |
| JSON body capped at 256 kB | `backend/app.js` |
| HTTP-only, `SameSite=Lax` session cookie, `Secure` when `COOKIE_SECURE=true`, rolling expiry | `backend/app.js` |
| Sessions stored server-side in MySQL and purged every 15 minutes | `backend/database/sessionStore.js` |
| Session identifier regenerated on sign-in (fixation defence) | `backend/controllers/authController.js` |
| CSRF synchroniser token, enforced in `secure` mode | `backend/middleware/csrf.js` |
| Rate limiting on `/api`, sign-in, registration and writes | `backend/middleware/rateLimit.js` |
| bcrypt (cost 10), dummy compare on unknown accounts to prevent enumeration, generic failure message | `backend/services/authService.js` |
| Secrets redacted from logs; passwords, tokens and cookies never logged | `backend/utils/logger.js` |
| Generic error bodies; stack traces, SQL and paths logged server-side only | `backend/middleware/errorHandler.js` |
| MySQL on a private Docker network with no published port; `shop_app` holds only DML | `docker-compose.yml`, `database/schema.sql` |
| Start-up refuses a weak `SESSION_SECRET` in `secure` mode | `backend/config/env.js` |

---

## 14. Known limitations

- The keyword denylist in `vulnerableSearch.js` is a *safety rail*, not a fix. It
  narrows what the injection can do; it does not stop the injection.
- Boolean-based blind injection is intentionally still possible, so the flaw can
  be detected by a scanner.
- There is no multi-tenant model: an "account" is a single user, so
  authorization flaws are expressed as user-to-user rather than tenant-to-tenant
  boundaries.
- The wallet is a MySQL table, not a payment integration. There is no
  idempotency key on checkout, so a replayed request would create a second
  order — that is a deliberate simplification, not a modelled flaw.
- Automated tests require a reachable MySQL instance. There is no in-memory
  substitute, because the point of the project is real SQL against a real
  engine.
- Rate limiting is disabled during the automated suites (a suite signs in dozens
  of times); the limiter itself is configured in `middleware/rateLimit.js`.

---

## 15. Reporting a finding

When adding a new deliberate flaw, keep the project's conventions:

1. Put the weak implementation in `backend/vulnerabilities/` and its hardened
   counterpart in `backend/secure/`, with matching function signatures.
2. Open the weak file with the banner:

   ```js
   // INTENTIONALLY VULNERABLE FOR AUTHORIZED SECURITY TESTING
   // DO NOT USE THIS IMPLEMENTATION IN PRODUCTION
   ```

3. Never surface those comments, or the mode, through the API or the UI.
4. Gate the weak implementation on `APP_MODE` (`config.isSecureMode`).
5. Add a section to this document following §4–§11: route, parameter, root cause,
   vulnerable implementation, secure implementation, expected tool observation,
   remediation.
6. Add assertions for both behaviours to
   `backend/tests/security-behaviour.test.js`.
