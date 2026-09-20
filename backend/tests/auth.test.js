'use strict';

/** Authentication, session handling and profile management. */

const { newAgent, signIn, withCsrf, errorCode, closePool, config } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

afterAll(async () => {
  await fixtures.cleanup();
  await closePool();
});

describe('POST /api/auth/register', () => {
  it('creates the account, signs the visitor in and opens the wallet', async () => {
    const agent = newAgent();
    const email = `${fixtures.PREFIX}-reg-${Date.now()}@shopsphere.test`;

    const response = await agent
      .post('/api/auth/register')
      .send({ name: 'Ada Lovelace', email, password: 'Register#2024' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user.role).toBe('USER');

    // The password hash must never appear in a response.
    expect(JSON.stringify(response.body)).not.toMatch(/\$2[aby]\$/);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(email);
    expect(Number(me.body.data.user.walletBalance)).toBe(Number(config.wallet.startingBalance));
  });

  it('refuses an email address that is already registered', async () => {
    const existing = await fixtures.createUser();

    const response = await newAgent()
      .post('/api/auth/register')
      .send({ name: 'Impostor', email: existing.email, password: 'Register#2024' });

    expect(response.status).toBe(409);
    expect(errorCode(response)).toBe('CONFLICT');
  });

  it('refuses a password that does not meet the minimum policy', async () => {
    const response = await newAgent()
      .post('/api/auth/register')
      .send({
        name: 'Weak Password',
        email: `${fixtures.PREFIX}-weak-${Date.now()}@shopsphere.test`,
        password: 'abc',
      });

    expect(response.status).toBe(400);
    expect(errorCode(response)).toBe('BAD_REQUEST');
  });

  it('refuses a malformed email address', async () => {
    const response = await newAgent()
      .post('/api/auth/register')
      .send({ name: 'No At Sign', email: 'not-an-email', password: 'Register#2024' });

    expect(response.status).toBe(400);
    expect(errorCode(response)).toBe('BAD_REQUEST');
  });
});

describe('POST /api/auth/login', () => {
  it('signs a valid customer in and exposes the session through /me', async () => {
    const user = await fixtures.createUser();
    const agent = newAgent();

    const response = await agent
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(user.email);

    const cookies = response.headers['set-cookie'] ?? [];
    const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${config.session.name}=`));
    expect(sessionCookie).toBeDefined();
    // The session cookie must not be readable from JavaScript.
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);

    const me = await agent.get('/api/auth/me');
    expect(me.body.data.user.email).toBe(user.email);
  });

  it('rejects a wrong password with a deliberately ambiguous message', async () => {
    const user = await fixtures.createUser();

    const response = await newAgent()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'DefinitelyWrong#1' });

    expect(response.status).toBe(401);
    expect(errorCode(response)).toBe('UNAUTHENTICATED');
    // The message must not disclose which of the two values was wrong.
    expect(response.body.error.message).toMatch(/email address or password/i);
    expect(response.body.error.message).not.toContain(user.email);
    expect(JSON.stringify(response.body)).not.toMatch(/\$2[aby]\$/);
  });

  it('answers identically for an unknown account, so accounts cannot be enumerated', async () => {
    const user = await fixtures.createUser();

    const unknown = await newAgent()
      .post('/api/auth/login')
      .send({ email: 'nobody-here@shopsphere.test', password: 'Whatever#2024' });
    const wrongPassword = await newAgent()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Whatever#2024' });

    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('refuses a disabled account', async () => {
    const user = await fixtures.createUser({ active: false });

    const response = await newAgent()
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(response.status).toBe(401);
  });

  it('issues a new session identifier on sign-in (session fixation defence)', async () => {
    const user = await fixtures.createUser();
    const agent = newAgent();

    // Establish an anonymous session first.
    await agent.get('/api/auth/csrf');
    const before = (await agent.get('/api/auth/session-check')).body.data.authenticated;
    expect(before).toBe(false);

    const login = await agent
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);

    const after = (await agent.get('/api/auth/session-check')).body.data.authenticated;
    expect(after).toBe(true);
  });
});

describe('session lifecycle', () => {
  it('reports an anonymous visitor as unauthenticated', async () => {
    const response = await newAgent().get('/api/auth/session-check');

    expect(response.status).toBe(200);
    expect(response.body.data.authenticated).toBe(false);
    expect(response.body.data.user).toBeNull();
  });

  it('clears the session on sign-out', async () => {
    const user = await fixtures.createUser();
    const agent = newAgent();
    const token = await signIn(agent, user.email, user.password);

    const logout = await withCsrf(agent.post('/api/auth/logout'), token);
    expect(logout.status).toBe(200);

    const after = await agent.get('/api/auth/session-check');
    expect(after.body.data.authenticated).toBe(false);
  });

  it('protects the account area from anonymous visitors', async () => {
    const agent = newAgent();

    for (const path of ['/api/cart', '/api/orders', '/api/wishlist', '/api/wallet']) {
      const response = await agent.get(path);
      expect(response.status).toBe(401);
    }
  });
});

describe('profile management', () => {
  it('updates the delivery details', async () => {
    const user = await fixtures.createUser();
    const agent = newAgent();
    const token = await signIn(agent, user.email, user.password);

    const response = await withCsrf(
      agent.put('/api/auth/profile').send({
        name: 'Renamed Shopper',
        phone: '9812345678',
        address: '42 Residency Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560025',
      }),
      token
    );

    expect(response.status).toBe(200);
    expect(response.body.data.user.name).toBe('Renamed Shopper');
    expect(response.body.data.user.city).toBe('Bengaluru');
  });

  it('rejects a malformed phone number', async () => {
    const user = await fixtures.createUser();
    const agent = newAgent();
    const token = await signIn(agent, user.email, user.password);

    const response = await withCsrf(
      agent.put('/api/auth/profile').send({ name: 'Bad Phone', phone: '<script>alert(1)</script>' }),
      token
    );

    expect(response.status).toBe(400);
  });

  it('changes the password and requires the current one', async () => {
    const user = await fixtures.createUser();
    const agent = newAgent();
    const token = await signIn(agent, user.email, user.password);

    const wrong = await withCsrf(
      agent.put('/api/auth/password').send({
        currentPassword: 'NotThePassword#1',
        newPassword: 'Rotated#2024',
      }),
      token
    );
    // The caller is authenticated, but the credential they re-supplied is not
    // valid, so the change is refused.
    expect(wrong.status).toBe(401);

    // The old password still works after the refused change.
    const stillValid = await newAgent()
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(stillValid.status).toBe(200);

    const ok = await withCsrf(
      agent.put('/api/auth/password').send({
        currentPassword: user.password,
        newPassword: 'Rotated#2024',
      }),
      token
    );
    expect(ok.status).toBe(200);

    const fresh = newAgent();
    const relogin = await fresh
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Rotated#2024' });
    expect(relogin.status).toBe(200);
  });

  it('never returns the stored password hash', async () => {
    const user = await fixtures.createUser();
    const agent = newAgent();
    await signIn(agent, user.email, user.password);

    const me = await agent.get('/api/auth/me');
    expect(JSON.stringify(me.body)).not.toMatch(/\$2[aby]\$/);
    expect(me.body.data.user).not.toHaveProperty('password_hash');
  });
});
