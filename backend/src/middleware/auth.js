const { verifyAccessToken } = require('../utils/jwtHelper');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, USER_STATUS } = require('../config/constants');

/**
 * protect — verifies JWT and attaches req.user.
 * Expects:  Authorization: Bearer <token>
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('No token provided'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Fetch fresh user from DB (catches deactivated accounts)
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user) return next(ApiError.unauthorized('User no longer exists'));
    if (user.status === USER_STATUS.INACTIVE) {
      return next(ApiError.forbidden('Account has been deactivated'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * authorize(...roles) — restricts route to specific roles.
 * Must be used AFTER protect.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Role '${req.user.role}' is not allowed to access this route`));
    }
    next();
  };
};

/**
 * Shorthand guards
 */
const adminOnly = authorize(ROLES.ADMIN);
const studentOnly = authorize(ROLES.STUDENT);

module.exports = { protect, authorize, adminOnly, studentOnly };
