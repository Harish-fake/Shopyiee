'use strict';

/**
 * Selects the review implementation for the active APP_MODE.
 *
 * Controllers talk to this module rather than to either implementation
 * directly, which keeps the business logic free of mode checks and guarantees
 * that the two variants expose an identical interface.
 *
 *   APP_MODE=development | testing  ->  vulnerabilities/vulnerableReview.js
 *   APP_MODE=secure                 ->  secure/secureReview.js
 *
 * See docs/security-testing.md.
 */

const config = require('../config/env');

function implementation() {
  return config.isSecureMode
    ? require('../secure/secureReview')
    : require('../vulnerabilities/vulnerableReview');
}

module.exports = {
  createReview: (...args) => implementation().createReview(...args),
  updateReview: (...args) => implementation().updateReview(...args),
  deleteReview: (...args) => implementation().deleteReview(...args),
  findReviewById: (...args) => implementation().findReviewById(...args),
  listReviewsForProduct: (...args) => implementation().listReviewsForProduct(...args),
  listAllReviews: (...args) => implementation().listAllReviews(...args),
  listReviewsByUser: (...args) => implementation().listReviewsByUser(...args),
  /** Exposed for diagnostics - not returned to clients. */
  activeImplementation: () => (config.isSecureMode ? 'secure' : 'development'),
};
