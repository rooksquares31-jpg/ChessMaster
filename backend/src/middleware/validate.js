const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs after express-validator chains. If there are validation errors,
 * it formats them and throws an ApiError instead of letting the request through.
 */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((err) => ({
    field: err.path || err.param,
    message: err.msg,
  }));

  return next(ApiError.badRequest('Validation failed', errors));
};

module.exports = validate;
