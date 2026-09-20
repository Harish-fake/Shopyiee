'use strict';

/**
 * Declarative request validation.
 *
 * A schema is an object whose keys map to the part of the request being
 * validated (`body`, `query`, `params`) and whose values are plain objects
 * mapping field names to validator functions.
 *
 *   validate({
 *     body: { email: (v) => asEmail(v, 'email'), password: (v) => asPassword(v) },
 *     query: { page: (v) => asInt(v ?? 1, 'page', { min: 1, max: 1000 }) },
 *   })
 *
 * Validators return a normalised value or throw an `ApiError`.  The collected
 * output replaces the original request property, so downstream code only ever
 * sees sanitised, correctly typed values.
 */

const { badRequest } = require('../utils/errors');

function applySchema(section, schema, source) {
  const input = source ?? {};
  const output = {};

  for (const [field, validator] of Object.entries(schema)) {
    if (typeof validator !== 'function') {
      throw new Error(`Validation schema for "${field}" must be a function`);
    }
    // `undefined` is passed through so validators can apply their own defaults.
    output[field] = validator(input[field]);
  }

  return output;
}

function validate(schemas) {
  return function validateMiddleware(req, _res, next) {
    try {
      if (schemas.body) req.body = applySchema('body', schemas.body, req.body);
      if (schemas.query) {
        // Express exposes query values as strings; validators coerce as needed.
        req.validatedQuery = applySchema('query', schemas.query, req.query);
      }
      if (schemas.params) req.params = applySchema('params', schemas.params, req.params);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** Reject requests that carry unexpected top-level fields. */
function rejectUnknownFields(allowed) {
  return function fieldGuard(req, _res, next) {
    const unknown = Object.keys(req.body || {}).filter((key) => !allowed.includes(key));
    if (unknown.length) {
      return next(badRequest(`Unexpected field(s): ${unknown.join(', ')}`));
    }
    return next();
  };
}

module.exports = { validate, rejectUnknownFields };
