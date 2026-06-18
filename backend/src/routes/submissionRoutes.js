const express = require('express');
const router = express.Router();

const {
  createSubmission,
  getSubmissions,
  getSubmissionById,
} = require('../controllers/submissionController');
const { protect, studentOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const { createSubmissionValidator } = require('../validators/submissionValidators');

router.use(protect);

// POST /api/submissions  — Student only (optional PGN file upload)
router.post('/', studentOnly, upload.single('pgnFile'), createSubmissionValidator, validate, createSubmission);

// GET /api/submissions   — Admin sees all; student sees own
router.get('/', getSubmissions);

// GET /api/submissions/:id
router.get('/:id', getSubmissionById);

module.exports = router;
