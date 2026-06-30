const express = require('express');
const router  = express.Router();
const {
  createClassroom, getClassrooms, getClassroomById,
  joinByCode, updateClassroom, deleteClassroom, addStudents,
} = require('../controllers/classroomController');
const { protect, adminOnly } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

router.use(protect);

// ── IMPORTANT: specific routes MUST come before /:id ──────────

// POST /api/classrooms/join  — ANY authenticated user (student or admin)
// Must be BEFORE /:id route or Express will treat "join" as an ID
router.post(
  '/join',
  [body('code').trim().notEmpty().withMessage('Code is required')],
  validate,
  joinByCode
);

// POST /api/classrooms  — Admin: create classroom
router.post(
  '/',
  adminOnly,
  [body('title').trim().notEmpty().withMessage('Title is required')],
  validate,
  createClassroom
);

// GET  /api/classrooms  — List (admin sees own, student sees invited)
router.get('/', getClassrooms);

// ── Parameterized routes AFTER specific ones ───────────────────

// GET  /api/classrooms/:id
router.get('/:id', getClassroomById);

// PUT  /api/classrooms/:id  — Admin: update / change status
router.put('/:id', adminOnly, updateClassroom);

// DELETE /api/classrooms/:id  — Admin: delete
router.delete('/:id', adminOnly, deleteClassroom);

// POST /api/classrooms/:id/invite  — Admin: add students later
router.post('/:id/invite', adminOnly, addStudents);

module.exports = router;
