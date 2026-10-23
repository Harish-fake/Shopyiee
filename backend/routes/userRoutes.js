'use strict';

/**
 * ===========================================================================
 *  INTENTIONALLY VULNERABLE - HARDCODED CREDENTIALS
 *  DO NOT USE THIS IMPLEMENTATION IN PRODUCTION
 * ===========================================================================
 *
 * This endpoint publishes plaintext demo passwords that are hardcoded in the
 * application source.  It is deliberately unauthenticated: anyone who can
 * reach the API can read working credentials for every seeded account.
 *
 * This is the "hardcoded credentials / sensitive information exposure" entry
 * in the security exercise.  The hardened alternative is to never ship
 * credentials with the application and to rotate secrets through the
 * environment (see config/env.js).
 *
 * Exposed at:
 *   GET /users        (root alias)
 *   GET /api/users    (versioned API)
 */

const express = require('express');

const router = express.Router();

/**
 * Plaintext credentials committed to source control.
 *
 * Passwords match the bcrypt hashes in database/seed.sql:
 *   admin@shopsphere.test -> AdminDemo#2024
 *   every other demo user -> UserDemo#2024
 */
const HARDCODED_USERS = [
  {
    id: 1,
    name: 'Aarav Menon',
    email: 'admin@shopsphere.test',
    password: 'AdminDemo#2024',
    role: 'ADMIN',
    walletBalance: 25000,
  },
  {
    id: 2,
    name: 'Priya Nair',
    email: 'priya@example.test',
    password: 'UserDemo#2024',
    role: 'USER',
    walletBalance: 12806,
  },
  {
    id: 3,
    name: 'Arjun Sharma',
    email: 'arjun@example.test',
    password: 'UserDemo#2024',
    role: 'USER',
    walletBalance: 20702,
  },
  {
    id: 4,
    name: 'Meera Iyer',
    email: 'meera@example.test',
    password: 'UserDemo#2024',
    role: 'USER',
    walletBalance: 13502,
  },
  {
    id: 5,
    name: 'Rohit Verma',
    email: 'rohit@example.test',
    password: 'UserDemo#2024',
    role: 'USER',
    walletBalance: 16003,
  },
  {
    id: 6,
    name: 'Sana Qureshi',
    email: 'sana@example.test',
    password: 'UserDemo#2024',
    role: 'USER',
    walletBalance: 20000,
  },
];

function sendHardcodedUsers(_req, res) {
  res.json({
    success: true,
    data: {
      source: 'hardcoded',
      description:
        'Plaintext demo credentials embedded in the application source and served without authentication.',
      count: HARDCODED_USERS.length,
      users: HARDCODED_USERS,
    },
  });
}

router.get('/', sendHardcodedUsers);

module.exports = router;
