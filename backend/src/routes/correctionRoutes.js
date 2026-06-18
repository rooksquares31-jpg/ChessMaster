const express = require('express');
const router = express.Router();

const {
  createCorrection,
  createOfflineCorrection,
  getCorrectionById,
  updateCorrection,
} = require('../controllers/correctionController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createCorrectionValidator } = require('../validators/correctionValidators');

router.use(protect);

// POST /api/corrections/offline  — Admin only (no prior submission needed)
router.post('/offline', adminOnly, createOfflineCorrection);

// POST /api/corrections         — Admin only
router.post('/', adminOnly, createCorrectionValidator, validate, createCorrection);

// GET /api/corrections/:id      — Admin or submission's student
router.get('/:id', getCorrectionById);

// PUT /api/corrections/:id      — Admin only
router.put('/:id', adminOnly, updateCorrection);

module.exports = router;
