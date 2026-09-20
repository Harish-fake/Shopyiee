'use strict';

/**
 * Jest setup - runs before the test framework and before any application
 * module is required, so environment overrides here take effect.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Rate limiting is exercised by its own unit test; leaving it on would make a
// suite that signs in dozens of times flaky.
process.env.ENABLE_RATE_LIMIT = process.env.ENABLE_RATE_LIMIT || 'false';

// Keep the structured request log out of the test reporter's output.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
