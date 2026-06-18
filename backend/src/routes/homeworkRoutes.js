const express = require('express');
const router = express.Router();

const {
  createHomework,
  getHomework,
  getHomeworkById,
  updateHomework,
  deleteHomework,
  assignHomework,
} = require('../controllers/homeworkController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const {
  createHomeworkValidator,
  updateHomeworkValidator,
  assignHomeworkValidator,
} = require('../validators/homeworkValidators');

router.use(protect);

// POST /api/homework/assign — must be before /:id to avoid route conflict
router.post('/assign', adminOnly, assignHomeworkValidator, validate, assignHomework);

// POST /api/homework
router.post('/', adminOnly, upload.single('pgnFile'), createHomeworkValidator, validate, createHomework);

// GET /api/homework
router.get('/', getHomework);

// GET /api/homework/:id
router.get('/:id', getHomeworkById);

// PUT /api/homework/:id
router.put('/:id', adminOnly, upload.single('pgnFile'), updateHomeworkValidator, validate, updateHomework);

// DELETE /api/homework/:id
router.delete('/:id', adminOnly, deleteHomework);

module.exports = router;
