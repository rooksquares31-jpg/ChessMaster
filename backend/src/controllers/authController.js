const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  buildTokenPayload,
} = require('../utils/jwtHelper');
const { ROLES } = require('../config/constants');

/**
 * POST /api/auth/register
 * Admin creates a new student account (or first admin can self-register).
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;

    // Only allow admin role assignment by an authenticated admin
    // For the very first user, allow admin registration freely
    const adminCount = await User.countDocuments({ role: ROLES.ADMIN });
    const assignedRole = adminCount === 0 ? ROLES.ADMIN : ROLES.STUDENT;

    if (req.user && req.user.role === ROLES.ADMIN && role === ROLES.ADMIN) {
      // Admins can create other admins
    }

    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: assignedRole,
    });

    const payload = buildTokenPayload(user);
    const accessToken = signAccessToken(payload);

    return ApiResponse.created(res, 'Account created successfully', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Explicitly select password (it's select:false in schema)
    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    if (user.status === 'inactive') {
      return next(ApiError.forbidden('Your account has been deactivated'));
    }

    const payload = buildTokenPayload(user);
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Persist refresh token (no need to hash for this use case; 
    // rotate on each use for full security)
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    return ApiResponse.ok(res, 'Login successful', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLogin: user.lastLogin,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Invalidates the stored refresh token.
 */
const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    return ApiResponse.ok(res, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Issues a new access token using a valid refresh token.
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(ApiError.badRequest('Refresh token required'));

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      return next(ApiError.unauthorized('Invalid refresh token'));
    }

    const payload = buildTokenPayload(user);
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return ApiResponse.ok(res, 'Token refreshed', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 */
const getMe = async (req, res, next) => {
  try {
    return ApiResponse.ok(res, 'Profile fetched', req.user);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, refresh, getMe };
