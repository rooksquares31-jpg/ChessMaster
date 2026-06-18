const express = require('express');
const router = express.Router();

const { register, login, logout, refresh, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { loginValidator, registerValidator } = require('../validators/authValidators');

// POST /api/auth/register
router.post('/register', registerValidator, validate, register);

// POST /api/auth/login  (stricter rate limit)
router.post('/login', authLimiter, loginValidator, validate, login);

// POST /api/auth/logout  (requires auth)
router.post('/logout', protect, logout);

// POST /api/auth/refresh
router.post('/refresh', refresh);

// GET /api/auth/me  (requires auth)
router.get('/me', protect, getMe);

module.exports = router;
