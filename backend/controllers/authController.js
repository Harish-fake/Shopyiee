'use strict';

/** Account endpoints: register, sign in, sign out, profile, password. */

const authService = require('../services/authService');
const walletService = require('../services/walletService');
const { establishSession } = require('../middleware/auth');
const { issueToken } = require('../middleware/csrf');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { unauthorized } = require('../utils/errors');
const logger = require('../utils/logger');

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const user = await authService.register({ name, email, password, phone });
  establishSession(req, user);

  res.status(201).json({
    success: true,
    data: { user, csrfToken: req.session.csrfToken ?? null },
  });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await authService.authenticate({ email, password });

  // Issue a fresh session identifier on privilege change to guard against
  // session fixation.
  await new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve()))
  );

  establishSession(req, user);

  res.json({ success: true, data: { user, csrfToken: req.session.csrfToken ?? null } });
});

/** POST /api/auth/logout */
const logout = asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? null;

  await new Promise((resolve) => req.session.destroy(() => resolve()));

  res.clearCookie(require('../config/env').session.name, { path: '/' });
  if (userId) logger.info('Sign-out', { userId });

  res.json({ success: true, data: { message: 'You have been signed out' } });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.json({ success: true, data: { user: null } });
  }

  const [profile, balance] = await Promise.all([
    authService.findById(req.user.id),
    walletService.getBalance(req.user.id),
  ]);

  res.json({
    success: true,
    data: { user: { ...authService.mapUser(profile), walletBalance: balance } },
  });
});

/** PUT /api/auth/profile */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, city, state, postalCode } = req.body;
  const user = await authService.updateProfile({ userId: req.user.id, name, phone, address, city, state, postalCode });
  res.json({ success: true, data: { user } });
});

/** PUT /api/auth/password */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword({ userId: req.user.id, currentPassword, newPassword });

  // Invalidate every other session for this account.
  res.json({ success: true, data: { message: 'Your password has been updated' } });
});

/** GET /api/auth/csrf */
const csrf = (req, res) => issueToken(req, res);

/** GET /api/auth/session-check - used by the test suite to inspect state. */
const sessionInfo = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      authenticated: Boolean(req.user),
      user: req.user ?? null,
    },
  });
});

module.exports = {
  register,
  login,
  logout,
  me,
  updateProfile,
  changePassword,
  csrf,
  sessionInfo,
  requireAuth,
  unauthorized,
};
