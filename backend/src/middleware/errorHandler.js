const ApiError = require('../utils/ApiError');

/**
 * Global error handler — must have exactly 4 params so Express recognises it.
 * Handles both operational ApiErrors and unexpected programming errors.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // ── Mongoose CastError (invalid ObjectId) ──────────────────────────────
  if (err.name === 'CastError') {
    error = ApiError.notFound(`Resource not found with id: ${err.value}`);
  }

  // ── Mongoose duplicate key ─────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    error = ApiError.conflict(`${field} '${value}' already exists`);
  }

  // ── Mongoose validation error ──────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Validation failed', errors);
  }

  // ── JWT errors (shouldn't reach here, but safety net) ─────────────────
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token has expired');
  }

  // ── Multer errors ──────────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = ApiError.badRequest(
      `File too large. Max size: ${process.env.MAX_FILE_SIZE_MB || 10}MB`
    );
  }

  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational === true;

  // Log non-operational (unexpected) errors
  if (!isOperational) {
    console.error('💥 Unexpected error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? error.message : 'An unexpected error occurred',
    errors: error.errors?.length ? error.errors : undefined,
    ...(process.env.NODE_ENV === 'development' && !isOperational && { stack: err.stack }),
  });
};

module.exports = errorHandler;
