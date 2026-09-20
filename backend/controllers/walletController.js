'use strict';

/**
 * Simulated wallet endpoints.
 *
 * All figures are stored in MySQL.  Nothing in this file contacts a bank, a
 * card processor, a payment gateway or a cryptocurrency network.
 */

const walletService = require('../services/walletService');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/wallet */
const getWallet = asyncHandler(async (req, res) => {
  const [wallet, purchases] = await Promise.all([
    walletService.getWallet(req.user.id),
    walletService.getRecentPurchases(req.user.id, 5),
  ]);

  res.json({ success: true, data: { ...wallet, recentPurchases: purchases } });
});

/** GET /api/wallet/transactions */
const transactions = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;

  const result = await walletService.listTransactions(req.user.id, {
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
    type: query.type ?? null,
  });

  res.json({
    success: true,
    data: {
      items: result.items,
      total: result.total,
      balance: await walletService.getBalance(req.user.id),
    },
  });
});

/** POST /api/wallet/deposit */
const deposit = asyncHandler(async (req, res) => {
  const { amount, description } = req.body;

  const result = await walletService.deposit(
    req.user.id,
    amount,
    description ? String(description).slice(0, 200) : 'Wallet top-up'
  );

  res.status(201).json({
    success: true,
    data: { ...result, message: 'Funds added to your wallet' },
  });
});

/** GET /api/wallet/purchases */
const purchases = asyncHandler(async (req, res) => {
  const items = await walletService.getRecentPurchases(req.user.id, Number.parseInt(req.query.limit, 10) || 10);
  res.json({ success: true, data: { items } });
});

module.exports = { getWallet, transactions, deposit, purchases };
