const { body } = require('express-validator');

const createCorrectionValidator = [
  body('submissionId').isMongoId().withMessage('Valid submission ID is required'),
  body('score')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Score must be a number between 0 and 100'),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Feedback cannot exceed 5000 characters'),
  body('annotatedPgn').optional().trim(),
  body('moveAnnotations').optional().isArray().withMessage('moveAnnotations must be an array'),
  body('moveAnnotations.*.move').optional().isString().trim(),
  body('moveAnnotations.*.comment').optional().isString().trim(),
  body('moveAnnotations.*.quality')
    .optional()
    .isIn(['excellent', 'good', 'inaccuracy', 'mistake', 'blunder'])
    .withMessage('Invalid move quality'),
];

module.exports = { createCorrectionValidator };
