const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { getAdminDashboard, getStudentAnalytics } = require('../services/analyticsService');
const { ROLES } = require('../config/constants');

/**
 * GET /api/dashboard
 * Admin sees full analytics; student sees their own dashboard.
 */
const getDashboard = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.ADMIN) {
      const data = await getAdminDashboard();
      return ApiResponse.ok(res, 'Admin dashboard', data);
    }

    // Student dashboard
    const data = await getStudentAnalytics(req.user._id);
    return ApiResponse.ok(res, 'Student dashboard', data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/students/:id
 * Admin only: individual student analytics.
 */
const getStudentDashboard = async (req, res, next) => {
  try {
    const data = await getStudentAnalytics(req.params.id);
    return ApiResponse.ok(res, 'Student analytics', data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/health
 */
const getHealth = (req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;
  const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbStatus = stateMap[dbState] ?? 'unknown';
  const isHealthy = dbState === 1;

  return res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: { status: dbStatus, host: mongoose.connection.host ?? null },
  });
};

module.exports = { getDashboard, getStudentDashboard, getHealth };
