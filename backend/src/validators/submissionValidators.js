const { body } = require('express-validator');

const createSubmissionValidator = [
  body('homeworkId').isMongoId().withMessage('Valid homework ID is required'),
  body('submittedSolution')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Solution text too long'),
  body('pgnText').optional().trim(),
  body('moveSequence')
    .optional()
    .isArray()
    .withMessage('moveSequence must be an array'),
  body('moveSequence.*')
    .optional()
    .isString()
    .trim()
    .withMessage('Each move must be a string'),
];

module.exports = { createSubmissionValidator };
