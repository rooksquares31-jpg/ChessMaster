const express = require('express');
const router = express.Router();

const {
  getDashboard,
  getStudentDashboard,
} = require('../controllers/dashboardController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);

// GET /api/dashboard                — role-aware (admin vs student)
router.get('/', getDashboard);

// GET /api/dashboard/students/:id  — admin only: individual student analytics
router.get('/students/:id', adminOnly, getStudentDashboard);

module.exports = router;
