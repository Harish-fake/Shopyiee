'use strict';

/**
 * Simulated wallet: balance, ledger, top-up and recent purchases.
 *
 * The wallet is a self-contained simulation stored in MySQL. No payment
 * provider, bank or card network is involved at any point.
 */

const { newAgent, signIn, withCsrf, closePool, config } = require('./helpers/harness');
const fixtures = require('./helpers/fixtures');

let token;

afterAll(async () => {
  await fixtures.cleanup();
  await closePool();
});

async function signedInAgent(options = {}) {
  const user = await fixtures.createUser(options);
  const agent = newAgent();
  token = await signIn(agent, user.email, user.password);
  return { agent, user };
}

describe('GET /api/wallet', () => {
  it('reports the balance, a summary and the latest entries', async () => {
    const { agent } = await signedInAgent({ balance: 7500 });

    const response = await agent.get('/api/wallet');

    expect(response.status).toBe(200);
    expect(Number(response.body.data.balance)).toBeCloseTo(7500, 2);
    expect(response.body.data).toHaveProperty('summary');
    expect(response.body.data.summary).toHaveProperty('totalDeposited');
    expect(response.body.data.summary).toHaveProperty('totalSpent');
    expect(response.body.data.summary).toHaveProperty('totalRefunded');
    expect(Array.isArray(response.body.data.recentTransactions)).toBe(true);
    expect(Array.isArray(response.body.data.recentPurchases)).toBe(true);
  });

  it('refuses anonymous access', async () => {
    const response = await newAgent().get('/api/wallet');
    expect(response.status).toBe(401);
  });
});

describe('POST /api/wallet/deposit', () => {
  it('adds simulated credit and writes a ledger entry', async () => {
    const { agent, user } = await signedInAgent({ balance: 1000 });

    const response = await withCsrf(agent.post('/api/wallet/deposit').send({ amount: 2500 }), token);

    expect(response.status).toBe(201);
    expect(Number(response.body.data.balance)).toBeCloseTo(3500, 2);
    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(3500, 2);

    const ledger = await agent.get('/api/wallet/transactions');
    const deposit = ledger.body.data.items.find((entry) => entry.type === 'DEPOSIT');
    expect(deposit).toBeDefined();
    expect(Number(deposit.amount)).toBeCloseTo(2500, 2);
  });

  it('refuses a negative amount', async () => {
    const { agent, user } = await signedInAgent({ balance: 1000 });

    const response = await withCsrf(agent.post('/api/wallet/deposit').send({ amount: -5000 }), token);

    expect(response.status).toBe(400);
    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(1000, 2);
  });

  it('refuses an amount above the top-up cap', async () => {
    const { agent, user } = await signedInAgent({ balance: 1000 });

    const response = await withCsrf(agent.post('/api/wallet/deposit').send({ amount: 1000000 }), token);

    expect(response.status).toBe(400);
    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(1000, 2);
  });

  it('refuses a non-numeric amount instead of coercing it', async () => {
    const { agent, user } = await signedInAgent({ balance: 1000 });

    const response = await withCsrf(agent.post('/api/wallet/deposit').send({ amount: '1e309' }), token);

    expect(response.status).toBe(400);
    expect(await fixtures.balanceOf(user.id)).toBeCloseTo(1000, 2);
  });
});

describe('GET /api/wallet/transactions', () => {
  it('paginates and reports the current balance', async () => {
    const { agent } = await signedInAgent({ balance: 5000 });

    const response = await agent.get('/api/wallet/transactions?limit=5');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(Number(response.body.data.balance)).toBeCloseTo(5000, 2);
    expect(response.body.data).toHaveProperty('total');
  });

  it('filters by entry type', async () => {
    const { agent } = await signedInAgent({ balance: 5000 });
    await withCsrf(agent.post('/api/wallet/deposit').send({ amount: 500 }), token);

    const response = await agent.get('/api/wallet/transactions?type=DEPOSIT');

    expect(response.status).toBe(200);
    for (const entry of response.body.data.items) {
      expect(entry.type).toBe('DEPOSIT');
    }
  });

  it('rejects an unknown entry type rather than returning the whole ledger', async () => {
    const { agent } = await signedInAgent({ balance: 5000 });

    const response = await agent.get('/api/wallet/transactions?type=NOT_A_TYPE');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects an out-of-range page size', async () => {
    const { agent } = await signedInAgent({ balance: 5000 });

    const response = await agent.get('/api/wallet/transactions?limit=99999');

    expect(response.status).toBe(400);
  });
});

describe('GET /api/wallet/purchases', () => {
  it('lists recent orders for the signed-in account', async () => {
    const { agent } = await signedInAgent({ balance: 5000 });

    const response = await agent.get('/api/wallet/purchases');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
  });
});

describe('starting balance', () => {
  it('is credited to a newly registered account', async () => {
    const agent = newAgent();
    const email = `${fixtures.PREFIX}-wallet-${Date.now()}@shopsphere.test`;

    await agent.post('/api/auth/register').send({
      name: 'Wallet Tester',
      email,
      password: 'Register#2024',
    });

    const wallet = await agent.get('/api/wallet');

    expect(Number(wallet.body.data.balance)).toBeCloseTo(Number(config.wallet.startingBalance), 2);
    expect(Number(wallet.body.data.summary.totalDeposited)).toBeCloseTo(
      Number(config.wallet.startingBalance),
      2
    );
  });
});
