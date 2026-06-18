const express = require('express');
const router = express.Router();

const {
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  createStudent,
  getStudentHomework,
} = require('../controllers/studentController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerValidator, updateStudentValidator } = require('../validators/authValidators');

// All student management routes require authentication + admin role
router.use(protect, adminOnly);

// GET  /api/students          — list with search & filter
router.get('/', getStudents);

// POST /api/students          — create student account
router.post('/', registerValidator, validate, createStudent);

// GET  /api/students/:id      — single student + progress
router.get('/:id', getStudentById);

// GET  /api/students/:id/homework  — student's homework + marks (admin only)
router.get('/:id/homework', getStudentHomework);

// PUT  /api/students/:id      — update profile (incl. grade/phone/notes/status)
router.put('/:id', updateStudentValidator, validate, updateStudent);

// DELETE /api/students/:id    — permanently delete student + all their data
router.delete('/:id', deleteStudent);

module.exports = router;
